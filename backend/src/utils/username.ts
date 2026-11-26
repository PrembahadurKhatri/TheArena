import crypto from "crypto";
import { User } from "../models/User";
import { AppError } from "./AppError";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9_.]{1,18}[a-zA-Z0-9])?$/;

// Handles that would look official or collide with app routes.
const RESERVED = new Set([
  "admin", "administrator", "arena", "thearena", "support", "help", "root", "staff", "system",
  "me", "my", "api", "new", "create", "edit", "settings", "official", "moderator", "null", "undefined",
]);

export function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}

/** Validates a requested username and returns it trimmed. Case is kept for display. */
export function requireUsername(value: unknown): string {
  if (typeof value !== "string") throw new AppError(400, "username is required");
  const u = value.trim();
  if (u.length < 3 || u.length > 20) throw new AppError(400, "Username must be 3 to 20 characters");
  if (!USERNAME_RE.test(u) || u.includes("..")) {
    throw new AppError(400, "Username can use letters, numbers, _ and . and must start and end with a letter or number");
  }
  if (RESERVED.has(u.toLowerCase())) throw new AppError(400, "That username is reserved");
  return u;
}

export async function isUsernameTaken(username: string, exceptUserId?: unknown): Promise<boolean> {
  const query: Record<string, unknown> = { usernameKey: usernameKey(username) };
  if (exceptUserId) query._id = { $ne: exceptUserId };
  return !!(await User.exists(query));
}

/** A free username derived from a display name, e.g. "Ram Thapa" -> "ramthapa4821". */
export async function generateUsername(name: string): Promise<string> {
  const base = (name || "player")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 14) || "player";
  const stem = base.length >= 3 ? base : `${base}player`.slice(0, 14);
  for (let i = 0; i < 20; i++) {
    const candidate = `${stem}${crypto.randomInt(1000, 10000)}`;
    if (!RESERVED.has(candidate) && !(await isUsernameTaken(candidate))) return candidate;
  }
  return `player${crypto.randomInt(100000, 1000000)}`;
}
