// Tournaments migration (master plan Phase 5). Idempotent.
//
//   npm run migrate:tournaments -- --dry-run
//   npm run migrate:tournaments
//
// Tournaments created before the approval workflow keep working: "upcoming"
// ones are marked legacy (treated as already approved) and get registration
// records for their teams; every tournament gets a slug; tournament matches
// get their sport and source filled in.
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Tournament } from "../models/Tournament";
import { TournamentRegistration } from "../models/TournamentRegistration";
import { Match } from "../models/Match";
import { audit } from "../services/auditService";
import { uniqueSlug } from "../utils/names";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const all = await Tournament.find({}).select("name slug status teams organizer sport legacy");
  const legacy = all.filter((t) => t.status === "upcoming" && !t.legacy);
  const noSlug = all.filter((t) => !t.slug);
  const matchesMissing = await Match.countDocuments({ tournament: { $ne: null }, sport: { $exists: false } });
  console.log(`[migrate:tournaments] tournaments: ${all.length}, legacy upcoming: ${legacy.length}, without slug: ${noSlug.length}, matches without sport: ${matchesMissing}${dryRun ? " (dry run)" : ""}`);
  if (dryRun) return;

  await Promise.all([Tournament.syncIndexes(), TournamentRegistration.syncIndexes(), Match.syncIndexes()]);
  for (const t of noSlug) await Tournament.updateOne({ _id: t._id }, { $set: { slug: await uniqueSlug(Tournament, t.name, t._id) } });
  for (const t of all) {
    if (t.status !== "upcoming" && t.status !== "ongoing" && t.status !== "completed") continue;
    await Tournament.updateOne({ _id: t._id }, { $set: { legacy: true } });
    for (const team of t.teams) {
      await TournamentRegistration.updateOne(
        { tournament: t._id, team },
        { $setOnInsert: { requestedBy: t.organizer, status: "approved", eligibility: { ok: true, reasons: [] }, respondedAt: new Date() } },
        { upsert: true }
      );
    }
    await Match.updateMany({ tournament: t._id, sport: { $exists: false } }, { $set: { sport: t.sport, source: "tournament", mode: "team", stage: "knockout" } });
  }
  await audit({ actor: null, action: "system.migration", target: { type: "migration", id: "tournaments" }, after: { legacy: legacy.length, slugs: noSlug.length } });
  console.log("[migrate:tournaments] done");
}

main()
  .catch((err) => {
    console.error("[migrate:tournaments] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
