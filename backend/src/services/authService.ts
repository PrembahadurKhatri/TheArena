import bcrypt from "bcrypt";
import crypto from "crypto";
import { User, IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { signToken } from "../utils/jwt";
import { sendEmail } from "../utils/sendEmail";
import { isValidSportSlug } from "../utils/sports";
import { isValidProvince } from "../utils/provinces";

const SALT_ROUNDS = 10;

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  province?: string;
}) {
  const { name, email, password, phone, location, province } = input;
  if (!name || !email || !password) {
    throw new AppError(400, "name, email and password are required");
  }
  if (province && !isValidProvince(province)) {
    throw new AppError(400, `Invalid province: ${province}`);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    phone,
    location,
    province,
  });

  const token = signToken(user._id, user.role);
  return { token, user };
}

export async function loginUser(input: { email: string; password: string }) {
  const { email, password } = input;
  if (!email || !password) {
    throw new AppError(400, "email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = signToken(user._id, user.role);
  return { token, user };
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
  if (updates.name !== undefined) user.name = updates.name;
  if (updates.phone !== undefined) user.phone = updates.phone;
  if (updates.photo !== undefined) user.photo = updates.photo;
  if (updates.location !== undefined) user.location = updates.location;
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
  if (!email) throw new AppError(400, "email is required");
  const user = await User.findOne({ email: email.toLowerCase() });

  // Always respond the same way regardless of whether the user exists,
  // to avoid leaking account existence.
  if (!user) {
    return { message: "If an account with that email exists, a reset link has been sent." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
  const link = `${clientUrl}/reset-password/${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your The Arena password",
    text: `Reset your password using this link: ${link}`,
    html: `<p>Reset your password using this link: <a href="${link}">${link}</a></p>`,
  });

  return { message: "If an account with that email exists, a reset link has been sent." };
}

export async function resetPassword(token: string, password: string) {
  if (!token || !password) {
    throw new AppError(400, "token and password are required");
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(400, "Invalid or expired reset token");
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  return { message: "Password has been reset successfully" };
}
