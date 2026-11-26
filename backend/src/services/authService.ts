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
import { generateUsername, isUsernameTaken, requireUsername, usernameKey } from "../utils/username";
import { isValidDistrict, parseGeo, provinceOfDistrict } from "../utils/locations";
import { EXPERIENCE_LEVELS, GENDERS, ISportProfile } from "../models/User";
import { assertNotBlacklisted } from "./blacklistService";

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

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Account emails (welcome, sign-in alert). Sent in the background: a slow or
// failing mail server never delays or breaks sign-up/login. Skipped when SMTP
// isn't configured and for reserved test domains (demo data).
function sendAccountEmail(user: IUser, subject: string, lines: string[]) {
  if (!process.env.SMTP_HOST || /\.(test|example|invalid|localhost)$/i.test(user.email)) return;
  const site = getPrimaryClientUrl();
  const text = [`Hi ${user.name},`, "", ...lines, "", site].join("\n");
  const html =
    `<p>Hi ${escapeHtml(user.name)},</p>` +
    lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("") +
    `<p><a href="${site}">${site}</a></p>`;
  void sendEmail({ to: user.email, subject, text, html }).catch((err) =>
    console.warn(`[email] "${subject}" not sent:`, err?.message ?? err)
  );
}

function sendWelcomeEmail(user: IUser) {
  sendAccountEmail(user, "Welcome to The Arena", [
    `Your account is ready. Your username is @${user.username}.`,
    "Complete your profile, then find players and teams near you, join tournaments and book grounds.",
  ]);
}

function sendSignInAlert(user: IUser) {
  if (user.privacy?.emailNotifications === false) return;
  const when = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" });
  sendAccountEmail(user, "New sign-in to your The Arena account", [
    `Your account was just signed in to (${when}, Nepal time).`,
    "If this was you, there's nothing to do. If it wasn't, reset your password now and use \"Log out everywhere\" in Settings.",
  ]);
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  province?: string;
  district?: string;
  username?: string;
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

  const district = input.district || undefined;
  if (district) {
    if (!isValidDistrict(district)) throw new AppError(400, `Invalid district: ${district}`);
    if (province && provinceOfDistrict(district) !== province) throw new AppError(400, `${district} is not in ${province}`);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, "An account with this email already exists");
  }
  await assertNotBlacklisted({ email, phone });

  // A username is optional at sign-up: one is generated from the name and
  // can be changed later.
  let username: string;
  if (input.username !== undefined && input.username !== "") {
    username = requireUsername(input.username);
    if (await isUsernameTaken(username)) throw new AppError(409, "That username is taken");
  } else {
    username = await generateUsername(name);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let user;
  try {
    user = await User.create({
      name,
      username,
      usernameKey: usernameKey(username),
      email,
      passwordHash,
      phone,
      location,
      province: province ?? (district ? provinceOfDistrict(district) ?? undefined : undefined),
      district,
    });
  } catch (err: any) {
    // Lost a race for the same email or username.
    if (err?.code === 11000) {
      throw new AppError(409, err?.keyPattern?.usernameKey ? "That username is taken" : "An account with this email already exists");
    }
    throw err;
  }

  const token = signToken(user);
  sendWelcomeEmail(user);
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
  sendSignInAlert(user);
  return { token, user };
}

/** Sign out every session of this user, on every device. */
export async function logoutAllDevices(user: IUser) {
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  await audit({ actor: user._id, actorRole: user.role, action: "auth.logout_all", target: { type: "user", id: user._id } });
  return { message: "Signed out of all devices" };
}

function optionalDate(value: unknown, field: string): Date | null {
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new AppError(400, `${field} is not a valid date`);
  return d;
}

function parseJsonField(value: unknown, field: string): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(400, `${field} must be valid JSON`);
  }
}

function parseSportProfiles(value: unknown): ISportProfile[] {
  const list = parseJsonField(value, "sportProfiles");
  if (!Array.isArray(list)) throw new AppError(400, "sportProfiles must be an array");
  if (list.length > 10) throw new AppError(400, "At most 10 sport profiles");
  const seen = new Set<string>();
  return list.map((raw: any) => {
    if (!raw || !isValidSportSlug(raw.sport)) throw new AppError(400, `Invalid sport slug: ${raw?.sport}`);
    if (seen.has(raw.sport)) throw new AppError(400, `Duplicate sport: ${raw.sport}`);
    seen.add(raw.sport);
    const experienceLevel = raw.experienceLevel || undefined;
    if (experienceLevel && !(EXPERIENCE_LEVELS as readonly string[]).includes(experienceLevel)) {
      throw new AppError(400, `experienceLevel must be one of: ${EXPERIENCE_LEVELS.join(", ")}`);
    }
    return { sport: raw.sport, position: optionalString(raw.position, "position", 40), experienceLevel };
  });
}

function parseBool(value: unknown, field: string): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new AppError(400, `${field} must be true or false`);
}

export const PRIVACY_KEYS = ["showEmail", "showPhone", "showLocation", "showAge", "discoverable", "emailNotifications"] as const;

export async function updateMe(user: IUser, updates: Record<string, any>) {
  if (updates.name !== undefined) user.name = requireString(updates.name, "name", { max: 80 });
  if (updates.phone !== undefined) {
    user.phone = optionalString(updates.phone, "phone", 20);
    if (user.phone) await assertNotBlacklisted({ phone: user.phone }, user._id);
  }
  if (updates.photo !== undefined) user.photo = updates.photo;
  if (updates.location !== undefined) user.location = optionalString(updates.location, "location", 120);
  if (updates.province !== undefined) {
    if (updates.province && !isValidProvince(updates.province)) {
      throw new AppError(400, `Invalid province: ${updates.province}`);
    }
    user.province = updates.province || undefined;
  }
  if (updates.district !== undefined) {
    if (updates.district && !isValidDistrict(updates.district)) throw new AppError(400, `Invalid district: ${updates.district}`);
    user.district = updates.district || undefined;
    // The district decides the province, so the two can't disagree.
    if (user.district) user.province = provinceOfDistrict(user.district) ?? user.province;
  }
  if (user.district && user.province && provinceOfDistrict(user.district) !== user.province) {
    throw new AppError(400, `${user.district} is not in ${user.province}`);
  }
  if (updates.municipality !== undefined) user.municipality = optionalString(updates.municipality, "municipality", 80);
  if (updates.lat !== undefined || updates.lng !== undefined) {
    const geo = parseGeo(updates.lat, updates.lng);
    if (geo !== undefined) user.geo = geo ?? undefined;
  }
  if (updates.bio !== undefined) user.bio = optionalString(updates.bio, "bio", 500);
  if (updates.dateOfBirth !== undefined) {
    const dob = optionalDate(updates.dateOfBirth, "dateOfBirth");
    if (dob) {
      const age = (Date.now() - dob.getTime()) / (365.25 * 86_400_000);
      if (age < 5 || age > 100) throw new AppError(400, "dateOfBirth must give an age between 5 and 100");
    }
    user.dateOfBirth = dob;
  }
  if (updates.gender !== undefined) {
    const g = updates.gender || null;
    if (g && !(GENDERS as readonly string[]).includes(g)) throw new AppError(400, `gender must be one of: ${GENDERS.join(", ")}`);
    user.gender = g;
  }
  if (updates.sportPreferences !== undefined) {
    const prefs = Array.isArray(updates.sportPreferences) ? updates.sportPreferences : [updates.sportPreferences];
    for (const p of prefs) {
      if (!isValidSportSlug(p)) {
        throw new AppError(400, `Invalid sport slug: ${p}`);
      }
    }
    user.sportPreferences = [...new Set(prefs as string[])];
  }
  if (updates.sportProfiles !== undefined) {
    user.sportProfiles = parseSportProfiles(updates.sportProfiles) as any;
    // Every sport with a profile counts as a preferred sport.
    user.sportPreferences = [...new Set([...(user.sportPreferences ?? []), ...user.sportProfiles.map((p) => p.sport)])];
  }
  if (updates.privacy !== undefined) {
    const privacy: any = parseJsonField(updates.privacy, "privacy");
    if (!privacy || typeof privacy !== "object") throw new AppError(400, "privacy must be an object");
    for (const key of PRIVACY_KEYS) {
      if (privacy[key] !== undefined) (user.privacy as any)[key] = parseBool(privacy[key], `privacy.${key}`);
    }
  }
  await user.save();
  return user;
}

/** Change password while signed in. Signs out every other session. */
export async function changePassword(user: IUser, input: { currentPassword?: unknown; newPassword?: unknown }) {
  if (typeof input.currentPassword !== "string" || !input.currentPassword) {
    throw new AppError(400, "currentPassword is required");
  }
  const newPassword = requireNewPassword(input.newPassword);
  const dbUser = await User.findById(user._id).select("+passwordHash +tokenVersion");
  if (!dbUser) throw new AppError(404, "User not found");
  const ok = input.currentPassword.length <= 128 && (await bcrypt.compare(input.currentPassword, dbUser.passwordHash));
  if (!ok) throw new AppError(400, "Current password is incorrect");
  if (await bcrypt.compare(newPassword, dbUser.passwordHash)) {
    throw new AppError(400, "New password must be different from the current one");
  }
  dbUser.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  dbUser.passwordChangedAt = new Date();
  dbUser.tokenVersion = (dbUser.tokenVersion ?? 0) + 1;
  await dbUser.save();
  await audit({ actor: user._id, actorRole: user.role, action: "auth.password_changed", target: { type: "user", id: user._id } });
  // A fresh token for this device; every other session is now invalid.
  return { token: signToken(dbUser), message: "Password changed. Other devices have been signed out." };
}

export async function changeUsername(user: IUser, value: unknown) {
  const username = requireUsername(value);
  if (user.username === username) return user;
  if (await isUsernameTaken(username, user._id)) throw new AppError(409, "That username is taken");
  const before = user.username ?? null;
  user.username = username;
  user.usernameKey = usernameKey(username);
  try {
    await user.save();
  } catch (err: any) {
    if (err?.code === 11000) throw new AppError(409, "That username is taken");
    throw err;
  }
  await audit({
    actor: user._id,
    actorRole: user.role,
    action: "user.username_changed",
    target: { type: "user", id: user._id },
    before: { username: before },
    after: { username },
  });
  return user;
}

export async function usernameAvailable(value: unknown, exceptUserId?: unknown) {
  try {
    const username = requireUsername(value);
    return { username, available: !(await isUsernameTaken(username, exceptUserId)) };
  } catch (err: any) {
    return { username: typeof value === "string" ? value : "", available: false, reason: err?.message ?? "Invalid username" };
  }
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
