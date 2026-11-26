import { Setting } from "../models/Setting";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { audit } from "./auditService";

// Platform settings a Super Admin can change without a deploy. Each has a
// type, limits and a default (from the environment where one existed).
// Reads are synchronous from an in-memory cache, refreshed at startup and on
// every change.
export const SETTING_DEFS = {
  bookingHoldMinutes: { label: "Minutes an unpaid online booking holds its slot", min: 5, max: 120, default: () => Number(process.env.BOOKING_HOLD_MINUTES) || 15 },
  bookingCancelCutoffHours: { label: "Hours before the start when booking cancellation closes", min: 0, max: 72, default: () => Number(process.env.BOOKING_CANCEL_CUTOFF_HOURS) || 2 },
  reportAutoVerifyHours: { label: "Hours before an unanswered match result becomes official", min: 1, max: 336, default: () => Number(process.env.REPORT_AUTO_VERIFY_HOURS) || 72 },
  orderHoldMinutes: { label: "Minutes an unpaid online order holds its stock", min: 5, max: 240, default: () => Number(process.env.ORDER_HOLD_MINUTES) || 30 },
  maxChallengeCounters: { label: "Counter-proposals allowed per challenge", min: 1, max: 20, default: () => 5 },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;

const cache = new Map<string, number>();

export function getSetting(key: SettingKey): number {
  return cache.get(key) ?? SETTING_DEFS[key].default();
}

export async function loadSettings() {
  const rows = await Setting.find().lean();
  cache.clear();
  for (const r of rows) if (r.key in SETTING_DEFS && typeof r.value === "number") cache.set(r.key, r.value);
  return rows.length;
}

export function listSettings() {
  return (Object.keys(SETTING_DEFS) as SettingKey[]).map((key) => {
    const d = SETTING_DEFS[key];
    return { key, label: d.label, min: d.min, max: d.max, value: getSetting(key), default: d.default(), overridden: cache.has(key) };
  });
}

export async function updateSettings(actor: IUser, input: Record<string, unknown>) {
  const changes: Record<string, { from: number; to: number | null }> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!(key in SETTING_DEFS)) throw new AppError(400, `Unknown setting: ${key}`);
    const def = SETTING_DEFS[key as SettingKey];
    if (raw === null) {
      // null = back to the default
      changes[key] = { from: getSetting(key as SettingKey), to: null };
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < def.min || n > def.max) throw new AppError(400, `${key} must be from ${def.min} to ${def.max}`);
    changes[key] = { from: getSetting(key as SettingKey), to: n };
  }
  for (const [key, c] of Object.entries(changes)) {
    if (c.to === null) await Setting.deleteOne({ key });
    else await Setting.updateOne({ key }, { $set: { value: c.to, updatedBy: actor._id } }, { upsert: true });
  }
  await loadSettings();
  await audit({ actor: actor._id, actorRole: actor.role, action: "settings.updated", target: { type: "settings", id: null }, after: changes });
  return listSettings();
}
