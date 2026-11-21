import bcrypt from "bcrypt";
import crypto from "crypto";
import { User, IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { signToken } from "../utils/jwt";
import { sendEmail } from "../utils/sendEmail";
import { isValidSportSlug } from "../utils/sports";
import { isValidProvince } from "../utils/provinces";
import { getPrimaryClientUrl } from "../config/env";
import { requireEmail, requireNewPassword, requireString, optionalString } from "../utils/validation";
import { audit } from "./auditService";

// bcrypt cost for new and changed passwords. Hashes made with the old cost
// (10) still verify; they're upgraded on the user's next successful login.
const SALT_ROUNDS = 12;

// Compared against when the email doesn't exist, so a login attempt takes
// the same time either way and can't be used to discover registered emails.
const DUMMY_HASH = bcrypt.hashSync("arena-timing-equaliser", SALT_ROUNDS);

function blockedError(status: string) {
  return new AppError(
    403,
    status === "banned"
      ? "This account has been banned. Contact support if you think this is a mistake."
      : "This account is suspended. Contact support for help."
  );
}

// Reset tokens are emailed in plain form but stored only as a SHA-256 hash,
// so a database leak doesn't hand out working reset links.
function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  province?: string;
}) {
  const name = requireString(input.name, "name", { max: 80 });
  const email = requireEmail(input.email);
  const password = requireNewPassword(input.password);
  const phone = optionalString(input.phone, "phone", 20);
  const location = optionalString(input.location, "location", 120);
  const province = input.province || undefined;
  if (province && !isValidProvince(province)) {
    throw new AppError(400, `Invalid province: ${province}`);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name,
    email,
    passwordHash,
    phone,
    location,
    province,
  });

  const token = signToken(user);
  return { token, user };
}

export async function loginUser(input: { email: string; password: string }) {
  const { email, password } = input;
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    throw new AppError(400, "email and password are required");
  }

  if (password.length > 128) throw new AppError(401, "Invalid email or password");

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash +tokenVersion");
  const match = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !match) {
    throw new AppError(401, "Invalid email or password");
  }
  // Checked only after the password, so the response doesn't reveal the
  // status of accounts the caller can't log into anyway.
  if (user.status !== "active") throw blockedError(user.status);

  // Upgrade old, cheaper hashes now that we have the plain password.
  if (bcrypt.getRounds(user.passwordHash) < SALT_ROUNDS) {
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }
  user.lastLoginAt = new Date();
  await user.save();

  if (user.role === "admin") {
    await audit({ actor: user._id, actorRole: user.role, action: "auth.admin_login", target: { type: "user", id: user._id } });
  }

  const token = signToken(user);
  return { token, user };
}

/** Sign out every session of this user, on every device. */
export async function logoutAllDevices(user: IUser) {
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  await audit({ actor: user._id, actorRole: user.role, action: "auth.logout_all", target: { type: "user", id: user._id } });
  return { message: "Signed out of all devices" };
}

export async function updateMe(
  user: IUser,
  updates: {
    name?: string;
    phone?: string;
    photo?: string;
    location?: string;
    province?: string;
    sportPreferences?: string[];
  }
) {
  if (updates.name !== undefined) user.name = requireString(updates.name, "name", { max: 80 });
  if (updates.phone !== undefined) user.phone = optionalString(updates.phone, "phone", 20);
  if (updates.photo !== undefined) user.photo = updates.photo;
  if (updates.location !== undefined) user.location = optionalString(updates.location, "location", 120);
  if (updates.province !== undefined) {
    if (updates.province && !isValidProvince(updates.province)) {
      throw new AppError(400, `Invalid province: ${updates.province}`);
    }
    user.province = updates.province;
  }
  if (updates.sportPreferences !== undefined) {
    const prefs = Array.isArray(updates.sportPreferences) ? updates.sportPreferences : [updates.sportPreferences];
    for (const p of prefs) {
      if (!isValidSportSlug(p)) {
        throw new AppError(400, `Invalid sport slug: ${p}`);
      }
    }
    user.sportPreferences = prefs;
  }
  await user.save();
  return user;
}

export async function forgotPassword(email: string) {
  if (typeof email !== "string" || !email) throw new AppError(400, "email is required");
  const user = await User.findOne({ email: email.trim().toLowerCase() });

  // Always respond the same way regardless of whether the user exists,
  // to avoid leaking account existence.
  if (!user) {
    return { message: "If an account with that email exists, a reset link has been sent." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = hashResetToken(token);
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const link = `${getPrimaryClientUrl()}/reset-password/${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your The Arena password",
    text: `Reset your password using this link: ${link}`,
    html: `<p>Reset your password using this link: <a href="${link}">${link}</a></p>`,
  });

  return { message: "If an account with that email exists, a reset link has been sent." };
}

export async function resetPassword(token: string, password: string) {
  if (typeof token !== "string" || !token) {
    throw new AppError(400, "token and password are required");
  }
  const newPassword = requireNewPassword(password);

  const user = await User.findOne({
    resetPasswordToken: hashResetToken(token),
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(400, "Invalid or expired reset token");
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();
  // A reset usually means the old password may be known to someone else:
  // sign out every existing session.
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  await audit({ actor: user._id, actorRole: user.role, action: "auth.password_reset", target: { type: "user", id: user._id } });

  return { message: "Password has been reset successfully" };
}
