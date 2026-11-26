// RBAC migration (master plan Phase 1, step 1). Additive and idempotent: safe
// to run more than once.
//
//   npm run migrate:rbac -- --dry-run      (see what would change)
//   npm run migrate:rbac
//   npm run build && npm run migrate:rbac:prod
//
// What it does:
//  1. Creates the default staff role templates that don't exist yet.
//  2. If there is no active Super Admin, promotes the OLDEST active admin to
//     Super Admin. Before RBAC every admin could do everything; the oldest
//     admin is the one created by the create-admin script.
//  3. Lists the other admins. They keep staff status but hold NO permissions
//     until a Super Admin assigns them a role (fail closed).
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import { StaffRole } from "../models/StaffRole";
import { DEFAULT_STAFF_ROLES } from "../config/permissions";
import { audit } from "../services/auditService";
import { ensureDefaultStaffRoles } from "../services/staffService";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const tag = dryRun ? " (dry run)" : "";

  const existingKeys = new Set((await StaffRole.find().select("key").lean()).map((r) => r.key));
  const missingRoles = DEFAULT_STAFF_ROLES.filter((r) => !existingKeys.has(r.key)).map((r) => r.key);
  console.log(`[migrate:rbac] role templates to create: ${missingRoles.length ? missingRoles.join(", ") : "none"}${tag}`);

  const supers = await User.countDocuments({ role: "admin", isSuperAdmin: true, status: "active" });
  const admins = await User.find({ role: "admin" }).sort({ createdAt: 1 }).select("email status isSuperAdmin staffRole createdAt");
  const promote = supers === 0 ? admins.find((a) => a.status === "active") ?? null : null;
  console.log(`[migrate:rbac] admins: ${admins.length}, active Super Admins: ${supers}${tag}`);
  if (promote) console.log(`[migrate:rbac] will promote oldest active admin to Super Admin: ${promote.email}${tag}`);
  else if (supers === 0) console.log("[migrate:rbac] no active admin to promote — run `npm run create-admin` afterwards");

  const noAccess = admins.filter((a) => !a.isSuperAdmin && !a.staffRole && (!promote || !a._id.equals(promote._id)));
  for (const a of noAccess) console.log(`[migrate:rbac] staff with no permissions until a role is assigned: ${a.email}`);

  if (dryRun) return;

  await StaffRole.syncIndexes();
  await User.syncIndexes();
  const created = await ensureDefaultStaffRoles();
  // Default the new fields on older admin documents so database filters match.
  await User.updateMany({ isSuperAdmin: { $exists: false } }, { $set: { isSuperAdmin: false } });
  await User.updateMany({ staffRole: { $exists: false } }, { $set: { staffRole: null } });
  if (promote) {
    await User.updateOne({ _id: promote._id }, { $set: { isSuperAdmin: true } });
  }
  await audit({
    actor: null,
    action: "system.migration",
    target: { type: "migration", id: "rbac" },
    after: { rolesCreated: created, promotedSuperAdmin: promote ? promote.email : null, staffWithoutRole: noAccess.length },
  });
  console.log(`[migrate:rbac] done: ${created} role(s) created${promote ? `, ${promote.email} is now Super Admin` : ""}`);
}

main()
  .catch((err) => {
    console.error("[migrate:rbac] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
