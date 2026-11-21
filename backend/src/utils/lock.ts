import crypto from "crypto";
import { Schema, model } from "mongoose";
import { AppError } from "./AppError";

// A small mutex stored in MongoDB, so "check for a clash, then write" runs for
// one request at a time per key — even across several backend instances, and
// without needing replica-set transactions (local dev runs a standalone
// mongod). The unique _id is the lock: inserting it succeeds for exactly one
// caller. expiresAt lets a lock left behind by a crashed request be taken over,
// and the TTL index deletes old lock documents.
interface ILock {
  _id: string;
  owner: string;
  expiresAt: Date;
}

const lockSchema = new Schema<ILock>(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);
lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });

const Lock = model<ILock>("Lock", lockSchema);

const LOCK_TTL_MS = 15_000;
const WAIT_MS = 8_000;

async function tryAcquire(key: string, owner: string): Promise<boolean> {
  const now = new Date();
  try {
    // Take the lock if it's free (no doc) or stale (expired).
    const doc = await Lock.findOneAndUpdate(
      { _id: key, expiresAt: { $lt: now } },
      { $set: { owner, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
      { upsert: true, new: true }
    );
    return doc?.owner === owner;
  } catch (err: any) {
    // Duplicate key: someone else holds a live lock.
    if (err?.code === 11000) return false;
    throw err;
  }
}

/** Run fn while holding the named lock. Waits up to WAIT_MS for it, then gives up with 409. */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const owner = crypto.randomUUID();
  const deadline = Date.now() + WAIT_MS;
  let delay = 15;
  while (!(await tryAcquire(key, owner))) {
    if (Date.now() > deadline) {
      throw new AppError(409, "This is busy right now — please try again in a moment.");
    }
    await new Promise((r) => setTimeout(r, delay + Math.random() * delay));
    delay = Math.min(delay * 2, 200);
  }
  try {
    return await fn();
  } finally {
    await Lock.deleteOne({ _id: key, owner }).catch(() => undefined);
  }
}

/** One lock per ground per day: bookings, payment confirmation and accepted challenges all use it. */
export function groundDayLockKey(groundId: unknown, date: string): string {
  return `ground:${String(groundId)}:${date}`;
}
