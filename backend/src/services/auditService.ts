import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog";
import { getRequestContext } from "../middleware/requestContext";

// Never store credentials in the log, even if a caller passes a whole object.
const SECRET_KEYS = /pass(word)?|token|secret|hash|authorization/i;

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object" || depth > 4) return value;
  if (value instanceof Date || value instanceof Types.ObjectId) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

/**
 * Record an action. Audit writes must never break the request that caused
 * them, so failures are logged and swallowed.
 */
export async function audit(entry: {
  actor: Types.ObjectId | string | null;
  actorRole?: string;
  action: string;
  target?: { type: string; id?: Types.ObjectId | string | null };
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  const ctx = getRequestContext();
  try {
    await AuditLog.create({
      ...entry,
      before: redact(entry.before),
      after: redact(entry.after),
      requestId: ctx?.requestId,
      ip: ctx?.ip,
    });
  } catch (err: any) {
    console.error(`[audit] failed to record ${entry.action}:`, err?.message ?? err);
  }
}
