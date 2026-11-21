// Phase 2 data backfill. Additive and idempotent: it only fills fields that
// are missing, never overwrites or deletes anything, and is safe to run more
// than once.
//
//   npm run migrate:phase2           (development, uses backend/.env)
//   npm run build && npm run migrate:phase2:prod
//
// Why: users created before Phase 2 have no `status` / `tokenVersion`.
// The app already treats missing values as "active" / 0 (Mongoose defaults),
// but database-level filters such as the admin "status = active" list only
// match documents that actually store the field.
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { audit } from "../services/auditService";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");

  const missingStatus = await User.countDocuments({ status: { $exists: false } });
  const missingVersion = await User.countDocuments({ tokenVersion: { $exists: false } });
  console.log(`[migrate] users missing status: ${missingStatus}, missing tokenVersion: ${missingVersion}${dryRun ? " (dry run)" : ""}`);
  if (dryRun) return;

  const a = await User.updateMany({ status: { $exists: false } }, { $set: { status: "active" } });
  const b = await User.updateMany({ tokenVersion: { $exists: false } }, { $set: { tokenVersion: 0 } });
  await AuditLog.syncIndexes();
  await User.syncIndexes();
  await audit({
    actor: null,
    action: "system.migration",
    target: { type: "migration", id: "phase2" },
    after: { statusBackfilled: a.modifiedCount, tokenVersionBackfilled: b.modifiedCount },
  });
  console.log(`[migrate] done: status set on ${a.modifiedCount}, tokenVersion set on ${b.modifiedCount}`);
}

main()
  .catch((err) => {
    console.error("[migrate] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
