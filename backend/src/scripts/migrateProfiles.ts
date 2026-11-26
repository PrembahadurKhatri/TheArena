// Profiles & sports migration (master plan Phase 1). Additive and
// idempotent: safe to run more than once.
//
//   npm run migrate:profiles -- --dry-run
//   npm run migrate:profiles
//   npm run build && npm run migrate:profiles:prod
//
//  1. Gives every user without a username a generated one (they can change it).
//  2. Stores default privacy settings on users created before they existed.
//  3. Marks existing sports active and fills roster sizes/positions via seed
//     defaults where missing (run `npm run seed` for the full set).
//  4. Builds the new indexes (unique username, 2dsphere).
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import { Sport } from "../models/Sport";
import { Notification } from "../models/Notification";
import { Announcement } from "../models/Announcement";
import { Blacklist } from "../models/Blacklist";
import { audit } from "../services/auditService";
import { generateUsername, usernameKey } from "../utils/username";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const tag = dryRun ? " (dry run)" : "";

  const noUsername = await User.find({ $or: [{ usernameKey: { $exists: false } }, { usernameKey: null }] }).select("name email");
  const noPrivacy = await User.countDocuments({ "privacy.discoverable": { $exists: false } });
  const sportsNoActive = await Sport.countDocuments({ active: { $exists: false } });
  console.log(`[migrate:profiles] users without username: ${noUsername.length}, without privacy: ${noPrivacy}, sports without active flag: ${sportsNoActive}${tag}`);
  if (dryRun) return;

  await Promise.all([User.syncIndexes(), Sport.syncIndexes(), Notification.syncIndexes(), Announcement.syncIndexes(), Blacklist.syncIndexes()]);

  let named = 0;
  for (const u of noUsername) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = await generateUsername(u.name);
      try {
        await User.updateOne({ _id: u._id, $or: [{ usernameKey: { $exists: false } }, { usernameKey: null }] }, { $set: { username, usernameKey: usernameKey(username) } });
        named += 1;
        break;
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
    }
  }
  const priv = await User.updateMany(
    { "privacy.discoverable": { $exists: false } },
    { $set: { privacy: { showEmail: false, showPhone: false, showLocation: true, showAge: false, discoverable: true } } }
  );
  const sports = await Sport.updateMany({ active: { $exists: false } }, { $set: { active: true } });

  await audit({
    actor: null,
    action: "system.migration",
    target: { type: "migration", id: "profiles" },
    after: { usernamesGenerated: named, privacyDefaulted: priv.modifiedCount, sportsActivated: sports.modifiedCount },
  });
  console.log(`[migrate:profiles] done: ${named} username(s), ${priv.modifiedCount} privacy default(s), ${sports.modifiedCount} sport(s) activated`);
}

main()
  .catch((err) => {
    console.error("[migrate:profiles] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
