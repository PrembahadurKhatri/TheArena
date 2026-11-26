// Subscriptions migration (master plan Phase 7). Idempotent.
//
//   npm run migrate:subscriptions -- --dry-run
//   npm run migrate:subscriptions
//
//  1. Creates the default plan catalogue (never overwriting staff edits).
//  2. Renames payment status "success" to "paid".
//  3. Turns each user's current Premium (isPremium + membershipExpiresAt, from
//     before plans existed) into an active Premium subscription with the same
//     end date, so their benefits continue unchanged.
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import { Plan } from "../models/Plan";
import { Payment } from "../models/Payment";
import { Membership } from "../models/Membership";
import { Subscription } from "../models/Subscription";
import { audit } from "../services/auditService";
import { ensureDefaultPlans } from "../services/subscriptionsService";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const now = new Date();
  const successCount = await Payment.countDocuments({ status: "success" });
  const premiumUsers = await User.find({ isPremium: true, membershipExpiresAt: { $gt: now }, planCode: { $in: [null, undefined] } }).select("_id membershipExpiresAt");
  console.log(`[migrate:subscriptions] payments "success" -> "paid": ${successCount}, legacy Premium users: ${premiumUsers.length}${dryRun ? " (dry run)" : ""}`);
  if (dryRun) return;

  await Promise.all([Plan.syncIndexes(), Subscription.syncIndexes(), Payment.syncIndexes()]);
  const created = await ensureDefaultPlans();
  await Payment.updateMany({ status: "success" }, { $set: { status: "paid" } });

  let converted = 0;
  for (const u of premiumUsers) {
    if (await Subscription.exists({ subscriberType: "user", subscriber: u._id, status: "active" })) continue;
    const last = await Membership.findOne({ user: u._id }).sort({ expiresAt: -1 });
    const plan = await Plan.findOne({ code: last?.plan === "yearly" ? "player_premium_yearly" : "player_premium_monthly" });
    if (!plan) continue;
    await Subscription.create({
      subscriberType: "user",
      subscriber: u._id,
      owner: u._id,
      plan: plan._id,
      planCode: plan.code,
      planSnapshot: { name: plan.name, price: plan.price, interval: plan.interval, entitlements: plan.entitlements ?? {} },
      status: "active",
      startAt: last?.startedAt ?? now,
      endAt: u.membershipExpiresAt,
      payments: last ? [last.payment] : [],
    });
    await User.updateOne({ _id: u._id }, { $set: { planCode: plan.code, planEntitlements: plan.entitlements ?? {} } });
    converted += 1;
  }
  await audit({ actor: null, action: "system.migration", target: { type: "migration", id: "subscriptions" }, after: { plansCreated: created, paymentsRenamed: successCount, converted } });
  console.log(`[migrate:subscriptions] done: ${created} plan(s) created, ${converted} Premium user(s) converted`);
}

main()
  .catch((err) => {
    console.error("[migrate:subscriptions] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
