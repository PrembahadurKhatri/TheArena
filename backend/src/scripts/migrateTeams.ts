// Teams migration (master plan Phase 2). Idempotent.
//
//   npm run migrate:teams -- --dry-run     (lists duplicate names first)
//   npm run migrate:teams
//
// Fills nameKey (for case-insensitive unique names) and slug on teams created
// before Phase 2, then builds the unique indexes. If two existing teams share
// a name, the newer one is renamed "<name> (2)" so the unique index can be
// built; its owner is notified. Run the dry run first to see who is affected.
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Team } from "../models/Team";
import { audit } from "../services/auditService";
import { notify } from "../services/notificationService";
import { nameKey, uniqueSlug } from "../utils/names";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const teams = await Team.find({}).sort({ createdAt: 1 }).select("name nameKey slug owner createdAt");
  const seen = new Map<string, string>();
  const renames: { id: string; from: string; to: string }[] = [];
  let missing = 0;
  for (const t of teams) {
    let key = nameKey(t.name);
    if (seen.has(key)) {
      let n = 2;
      while (seen.has(nameKey(`${t.name} (${n})`))) n += 1;
      renames.push({ id: t._id.toString(), from: t.name, to: `${t.name} (${n})` });
      key = nameKey(`${t.name} (${n})`);
    }
    seen.set(key, t._id.toString());
    if (!t.nameKey || !t.slug) missing += 1;
  }
  console.log(`[migrate:teams] teams: ${teams.length}, missing key/slug: ${missing}, duplicate names to rename: ${renames.length}${dryRun ? " (dry run)" : ""}`);
  for (const r of renames) console.log(`  rename ${r.id}: "${r.from}" -> "${r.to}"`);
  if (dryRun) return;

  for (const t of teams) {
    const r = renames.find((x) => x.id === t._id.toString());
    const name = r ? r.to : t.name;
    const update: any = { nameKey: nameKey(name) };
    if (r) update.name = name;
    if (!t.slug || r) update.slug = await uniqueSlug(Team, name, t._id);
    await Team.updateOne({ _id: t._id }, { $set: update });
    if (r) {
      await notify(t.owner, {
        type: "system",
        title: `Your team was renamed to "${name}"`,
        body: "Team names are now unique, and another team already used the old name. You can change it in your team settings.",
        entity: { type: "team", id: t._id },
      });
    }
  }
  await Team.updateMany({ status: { $exists: false } }, { $set: { status: "active" } });
  await Team.updateMany({ invitations: { $exists: false } }, { $set: { invitations: [] } });
  await Team.syncIndexes();
  await audit({ actor: null, action: "system.migration", target: { type: "migration", id: "teams" }, after: { teams: teams.length, renamed: renames.length } });
  console.log(`[migrate:teams] done: ${teams.length} team(s) updated, ${renames.length} renamed`);
}

main()
  .catch((err) => {
    console.error("[migrate:teams] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
