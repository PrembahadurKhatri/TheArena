import { AppError } from "./AppError";

// Escape user text before using it inside a $regex, so searches are literal
// and a crafted pattern can't cause catastrophic backtracking (ReDoS).
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Query-string values can arrive as arrays (?search=a&search=b). Take a
// single trimmed string or nothing.
export function queryString(value: unknown, maxLength = 100): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim().slice(0, maxLength);
  return trimmed || undefined;
}

export function searchRegex(value: unknown) {
  const s = queryString(value);
  return s ? { $regex: escapeRegex(s), $options: "i" } : undefined;
}

export function requireString(value: unknown, field: string, { min = 1, max = 200 } = {}): string {
  if (typeof value !== "string") throw new AppError(400, `${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new AppError(400, `${field} must be at least ${min} characters`);
  if (trimmed.length > max) throw new AppError(400, `${field} must be at most ${max} characters`);
  return trimmed;
}

export function optionalString(value: unknown, field: string, max = 1000): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new AppError(400, `${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new AppError(400, `${field} must be at most ${max} characters`);
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireEmail(value: unknown): string {
  const email = requireString(value, "email", { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError(400, "Please enter a valid email address");
  return email;
}

export const MIN_PASSWORD_LENGTH = 8;

export function requireNewPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (value.length > 128) throw new AppError(400, "Password must be at most 128 characters");
  return value;
}

export function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}
