// Grounds migration (master plan Phase 6). Idempotent.
//
//   npm run migrate:grounds -- --dry-run
//   npm run migrate:grounds
//
// Grounds created before Phase 6 (seeded, no owner) become approved,
// platform-managed listings with a sports list, slug and default opening
// hours (06:00–21:00 every day).
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Ground, DEFAULT_OPENING_HOURS } from "../models/Ground";
import { GroundBooking } from "../models/GroundBooking";
import { audit } from "../services/auditService";
import { uniqueSlug } from "../utils/names";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const grounds = await Ground.find({ $or: [{ slug: { $exists: false } }, { sports: { $size: 0 } }, { status: { $exists: false } }, { openingHours: { $size: 0 } }] });
  const bookings = await GroundBooking.countDocuments({ source: { $exists: false } });
  console.log(`[migrate:grounds] grounds to update: ${grounds.length}, bookings without source: ${bookings}${dryRun ? " (dry run)" : ""}`);
  if (dryRun) return;
  await Promise.all([Ground.syncIndexes(), GroundBooking.syncIndexes()]);
  for (const g of grounds) {
    const $set: Record<string, unknown> = {};
    if (!g.slug) $set.slug = await uniqueSlug(Ground, g.name, g._id);
    if (!g.sports?.length) $set.sports = [g.sport];
    if (!(g as any).status) $set.status = "approved";
    if (!g.openingHours?.length) $set.openingHours = DEFAULT_OPENING_HOURS;
    await Ground.updateOne({ _id: g._id }, { $set });
  }
  await GroundBooking.updateMany({ source: { $exists: false } }, { $set: { source: "direct", paymentMethod: "online" } });
  await audit({ actor: null, action: "system.migration", target: { type: "migration", id: "grounds" }, after: { grounds: grounds.length, bookings } });
  console.log("[migrate:grounds] done");
}

main()
  .catch((err) => {
    console.error("[migrate:grounds] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
