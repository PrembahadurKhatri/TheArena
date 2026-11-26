import crypto from "crypto";
import { Model } from "mongoose";

/** Comparison key for "same name": NFKC, trimmed, single spaces, lowercase. */
export function nameKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** URL-safe slug: "Pokhara Strikers FC!" -> "pokhara-strikers-fc". */
export function slugify(text: string, max = 60): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "item";
}

/**
 * A slug not used by any other document of this model. Tries the plain slug,
 * then adds a short random suffix. The unique index is the final arbiter.
 */
export async function uniqueSlug(model: Model<any>, text: string, excludeId?: unknown): Promise<string> {
  const base = slugify(text);
  const taken = async (slug: string) => {
    const q: Record<string, unknown> = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    return !!(await model.exists(q));
  };
  if (!(await taken(base))) return base;
  for (let i = 0; i < 10; i++) {
    const candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}
