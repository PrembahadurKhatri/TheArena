import crypto from "crypto";
import { Types } from "mongoose";
import { Blacklist, BlacklistKind } from "../models/Blacklist";
import { AppError } from "../utils/AppError";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Digits only, dropping Nepal's +977 / 977 country code, so formats match. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("977") && digits.length > 10 ? digits.slice(3) : digits;
}

function hashValue(kind: BlacklistKind, value: string): string {
  const normal = kind === "email" ? normalizeEmail(value) : normalizePhone(value);
  return crypto.createHash("sha256").update(`${kind}:${normal}`).digest("hex");
}

function hintFor(kind: BlacklistKind, value: string): string {
  if (kind === "email") {
    const [local, domain] = normalizeEmail(value).split("@");
    return `${(local ?? "").slice(0, 1)}***@${domain ?? ""}`;
  }
  const d = normalizePhone(value);
  return `***${d.slice(-3)}`;
}

/**
 * Rejects an email or phone on the blacklist. The message is deliberately
 * generic so it doesn't confirm which value is listed.
 */
export async function assertNotBlacklisted(values: { email?: string; phone?: string }, _exceptUser?: Types.ObjectId) {
  const or: { kind: BlacklistKind; valueHash: string }[] = [];
  if (values.email) or.push({ kind: "email", valueHash: hashValue("email", values.email) });
  if (values.phone && normalizePhone(values.phone)) or.push({ kind: "phone", valueHash: hashValue("phone", values.phone) });
  if (or.length === 0) return;
  if (await Blacklist.exists({ $or: or })) {
    throw new AppError(403, "This account can't be created or updated. Contact support if you think this is a mistake.");
  }
}

/** Add a banned user's email and phone. Idempotent. */
export async function blacklistUser(
  user: { _id: Types.ObjectId; email: string; phone?: string },
  actorId: Types.ObjectId | null,
  reason?: string
) {
  const entries: { kind: BlacklistKind; value: string }[] = [{ kind: "email", value: user.email }];
  if (user.phone && normalizePhone(user.phone)) entries.push({ kind: "phone", value: user.phone });
  for (const e of entries) {
    await Blacklist.updateOne(
      { kind: e.kind, valueHash: hashValue(e.kind, e.value) },
      { $setOnInsert: { hint: hintFor(e.kind, e.value), reason, user: user._id, createdBy: actorId } },
      { upsert: true }
    );
  }
  return entries.length;
}

/** Remove a user's entries (when a ban is lifted). */
export async function unblacklistUser(userId: Types.ObjectId) {
  const res = await Blacklist.deleteMany({ user: userId });
  return res.deletedCount;
}

export async function listBlacklist(skip: number, limit: number) {
  const [items, total] = await Promise.all([
    Blacklist.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "name username").lean(),
    Blacklist.countDocuments(),
  ]);
  return {
    items: items.map((b: any) => ({
      id: b._id.toString(),
      kind: b.kind,
      hint: b.hint,
      reason: b.reason ?? null,
      user: b.user ? { id: b.user._id.toString(), name: b.user.name, username: b.user.username ?? null } : null,
      createdAt: b.createdAt,
    })),
    total,
  };
}

export async function removeBlacklistEntry(id: string) {
  const res = await Blacklist.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new AppError(404, "Entry not found");
}
