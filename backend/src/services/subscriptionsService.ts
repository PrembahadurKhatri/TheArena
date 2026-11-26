import { Types } from "mongoose";
import { Plan, IPlan, PLAN_AUDIENCES, PLAN_INTERVALS, ENTITLEMENT_KEYS, PlanAudience, PlanEntitlements } from "../models/Plan";
import { Subscription, ISubscription, SubscriberType } from "../models/Subscription";
import { Payment, IPayment } from "../models/Payment";
import { User, IUser } from "../models/User";
import { Team } from "../models/Team";
import { Store } from "../models/Store";
import { AppError } from "../utils/AppError";
import { isObjectIdString, optionalString, queryString, requireString } from "../utils/validation";
import { Page, pageMeta } from "../utils/pagination";
import { isTestPaymentsEnabled } from "../config/env";
import { notify } from "./notificationService";
import { audit } from "./auditService";
import { canManageRoster, roleIn } from "./teamsService";

const DAY = 86_400_000;
const INTERVAL_MS: Record<string, number> = { month: 30 * DAY, year: 365 * DAY };

// ---------------------------------------------------------------- plans

const envPrice = (key: string, fallback: number) => Number(process.env[key]) || fallback;

/** Built-in plans, created once (never overwriting staff edits). */
export function defaultPlans(): Partial<IPlan>[] {
  return [
    { code: "player_free", audience: "player", name: "Free", price: 0, interval: "none", isFree: true, sortOrder: 0,
      entitlements: { maxOwnedTeams: 1, advancedMatchmaking: false, maxSearchRadiusKm: 10, advancedStats: false, profileBadge: false, bookingDiscountPct: 0, canOrganizeTournaments: false },
      features: ["Own 1 team", "Basic profile and matchmaking", "Basic statistics", "Join public tournaments"] },
    { code: "player_premium_monthly", audience: "player", name: "Premium (monthly)", price: envPrice("MEMBERSHIP_MONTHLY_PRICE", 299), interval: "month", sortOrder: 1,
      entitlements: { maxOwnedTeams: null, advancedMatchmaking: true, maxSearchRadiusKm: 100, advancedStats: true, profileBadge: true, bookingDiscountPct: 10, canOrganizeTournaments: true },
      features: ["Unlimited teams", "Advanced matchmaking filters", "Detailed sport statistics", "Premium badge", "Host tournaments", "10% off ground bookings"] },
    { code: "player_premium_yearly", audience: "player", name: "Premium (yearly)", price: envPrice("MEMBERSHIP_YEARLY_PRICE", 2999), interval: "year", sortOrder: 2,
      entitlements: { maxOwnedTeams: null, advancedMatchmaking: true, maxSearchRadiusKm: 100, advancedStats: true, profileBadge: true, bookingDiscountPct: 10, canOrganizeTournaments: true },
      features: ["Everything in monthly Premium", "Two months free"] },
    { code: "team_free", audience: "team", name: "Free team", price: 0, interval: "none", isFree: true, sortOrder: 0,
      entitlements: { teamAnalytics: false, teamBadge: false, featuredTeam: false }, features: ["Basic team management", "Team record", "Challenge other teams"] },
    { code: "team_premium_monthly", audience: "team", name: "Premium team", price: envPrice("TEAM_PREMIUM_PRICE", 499), interval: "month", sortOrder: 1,
      entitlements: { teamAnalytics: true, teamBadge: true, featuredTeam: true }, features: ["Team analytics", "Premium team badge", "Listed first in team search"] },
    { code: "merchant_basic", audience: "merchant", name: "Merchant Basic", price: 0, interval: "none", isFree: true, sortOrder: 0,
      entitlements: { maxProducts: 20, featuredStore: false, salesReports: false }, features: ["Up to 20 products", "Order management"] },
    { code: "merchant_pro_monthly", audience: "merchant", name: "Merchant Pro", price: envPrice("MERCHANT_PRO_PRICE", 999), interval: "month", sortOrder: 1,
      entitlements: { maxProducts: 500, featuredStore: true, salesReports: true }, features: ["Up to 500 products", "Featured shop", "Sales reports"] },
  ];
}

export async function ensureDefaultPlans() {
  let created = 0;
  for (const p of defaultPlans()) {
    const res = await Plan.updateOne({ code: p.code }, { $setOnInsert: { ...p, active: true } }, { upsert: true });
    created += res.upsertedCount;
  }
  return created;
}

export function toPlanJSON(p: any) {
  return {
    id: p._id.toString(),
    code: p.code,
    audience: p.audience,
    name: p.name,
    description: p.description ?? null,
    price: p.price,
    interval: p.interval,
    entitlements: p.entitlements ?? {},
    features: p.features ?? [],
    active: p.active !== false,
    isFree: !!p.isFree,
    sortOrder: p.sortOrder ?? 0,
  };
}

export async function listPlans(audience?: string, includeInactive = false) {
  await ensureDefaultPlans();
  const q: any = includeInactive ? {} : { active: true };
  if (audience && (PLAN_AUDIENCES as readonly string[]).includes(audience)) q.audience = audience;
  return (await Plan.find(q).sort({ audience: 1, sortOrder: 1, price: 1 }).lean()).map(toPlanJSON);
}

function parseEntitlements(input: unknown): PlanEntitlements {
  if (!input || typeof input !== "object") throw new AppError(400, "entitlements must be an object");
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const kind = (ENTITLEMENT_KEYS as Record<string, string>)[k];
    if (!kind) throw new AppError(400, `Unknown entitlement: ${k}`);
    if (kind === "boolean") {
      if (typeof v !== "boolean") throw new AppError(400, `${k} must be true or false`);
      out[k] = v;
    } else {
      if (kind === "numberOrNull" && v === null) {
        out[k] = null;
        continue;
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100000) throw new AppError(400, `${k} must be a number`);
      out[k] = n;
    }
  }
  return out as PlanEntitlements;
}

export async function createPlan(actor: IUser, input: Record<string, any>) {
  const code = requireString(input.code, "code", { min: 3, max: 40 }).toLowerCase();
  if (await Plan.exists({ code })) throw new AppError(409, "A plan with this code exists");
  if (!(PLAN_AUDIENCES as readonly string[]).includes(input.audience)) throw new AppError(400, `audience must be one of: ${PLAN_AUDIENCES.join(", ")}`);
  if (!(PLAN_INTERVALS as readonly string[]).includes(input.interval ?? "month")) throw new AppError(400, `interval must be one of: ${PLAN_INTERVALS.join(", ")}`);
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) throw new AppError(400, "price must be 0 or more");
  const plan = await Plan.create({
    code,
    audience: input.audience,
    name: requireString(input.name, "name", { min: 2, max: 60 }),
    description: optionalString(input.description, "description", 500),
    price,
    interval: input.interval ?? "month",
    isFree: price === 0,
    entitlements: parseEntitlements(input.entitlements ?? {}),
    features: Array.isArray(input.features) ? input.features.map((f: unknown) => String(f).slice(0, 120)).slice(0, 12) : [],
    sortOrder: Number(input.sortOrder) || 0,
    active: input.active !== false,
  });
  await audit({ actor: actor._id, actorRole: actor.role, action: "plan.created", target: { type: "plan", id: plan._id }, after: toPlanJSON(plan) });
  return toPlanJSON(plan);
}

export async function updatePlan(actor: IUser, id: string, input: Record<string, any>) {
  if (!isObjectIdString(id)) throw new AppError(404, "Plan not found");
  const plan = await Plan.findById(id);
  if (!plan) throw new AppError(404, "Plan not found");
  const before = toPlanJSON(plan);
  if (input.code !== undefined && input.code !== plan.code) throw new AppError(400, "A plan's code can't change");
  if (input.audience !== undefined && input.audience !== plan.audience) throw new AppError(400, "A plan's audience can't change");
  if (input.name !== undefined) plan.name = requireString(input.name, "name", { min: 2, max: 60 });
  if (input.description !== undefined) plan.description = optionalString(input.description, "description", 500);
  if (input.price !== undefined) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) throw new AppError(400, "price must be 0 or more");
    plan.price = price;
  }
  if (input.entitlements !== undefined) {
    plan.entitlements = parseEntitlements(input.entitlements);
    plan.markModified("entitlements");
  }
  if (input.features !== undefined) plan.features = Array.isArray(input.features) ? input.features.map((f: unknown) => String(f).slice(0, 120)).slice(0, 12) : [];
  if (input.active !== undefined) plan.active = input.active === true;
  if (input.sortOrder !== undefined) plan.sortOrder = Number(input.sortOrder) || 0;
  await plan.save();
  await audit({ actor: actor._id, actorRole: actor.role, action: "plan.updated", target: { type: "plan", id: plan._id }, before, after: toPlanJSON(plan) });
  // Existing subscriptions keep their snapshot; only new purchases see this.
  return toPlanJSON(plan);
}

// ---------------------------------------------------------------- subscribing

const AUDIENCE_SUBSCRIBER: Record<PlanAudience, SubscriberType> = { player: "user", team: "team", merchant: "store" };

/** The subscriber for a plan, and a check that the caller may pay for it. */
async function resolveSubscriber(user: IUser, plan: IPlan, subscriberId: unknown) {
  if (plan.audience === "player") return { type: "user" as const, id: user._id, name: user.name };
  if (!isObjectIdString(subscriberId)) throw new AppError(400, plan.audience === "team" ? "teamId is required for a team plan" : "storeId is required for a merchant plan");
  if (plan.audience === "team") {
    const team = await Team.findById(subscriberId);
    if (!team) throw new AppError(404, "Team not found");
    if (!canManageRoster(roleIn(team, user._id)) || !team.owner.equals(user._id)) throw new AppError(403, "Only the team owner can subscribe the team");
    return { type: "team" as const, id: team._id, name: team.name };
  }
  const store = await Store.findById(subscriberId);
  if (!store) throw new AppError(404, "Store not found");
  if (!store.owner.equals(user._id)) throw new AppError(403, "Only the store owner can subscribe the store");
  return { type: "store" as const, id: store._id, name: store.name };
}

export async function activeSubscription(type: SubscriberType, id: Types.ObjectId | string) {
  return Subscription.findOne({ subscriberType: type, subscriber: id, status: "active", endAt: { $gt: new Date() } }).sort({ endAt: -1 });
}

/**
 * Start a subscription: creates it as pending with a pending payment.
 * method "manual" = pay outside The Arena and submit a reference for staff
 * to verify; "test" = sandbox confirm (only when PAYMENT_MODE=test).
 */
export async function subscribe(user: IUser, input: { planCode?: unknown; subscriberId?: unknown; method?: unknown }) {
  const plan = await Plan.findOne({ code: String(input.planCode ?? "").toLowerCase(), active: true });
  if (!plan) throw new AppError(404, "Plan not found");
  if (plan.isFree || plan.price === 0) throw new AppError(400, "Free plans need no subscription");
  const method = input.method === "test" ? "test" : "manual";
  if (method === "test" && !isTestPaymentsEnabled()) throw new AppError(503, "Online payments are not enabled yet. Use manual payment.");
  const sub = await resolveSubscriber(user, plan, input.subscriberId);

  // One unpaid subscription at a time per subscriber: reuse it.
  const pending = await Subscription.findOne({ subscriberType: sub.type, subscriber: sub.id, status: "pending", planCode: plan.code });
  if (pending) {
    const payment = await Payment.findOne({ _id: { $in: pending.payments }, status: "pending" });
    if (payment) return { subscription: pending, payment };
  }
  const current = await activeSubscription(sub.type, sub.id);
  const subscription = await Subscription.create({
    subscriberType: sub.type,
    subscriber: sub.id,
    owner: user._id,
    plan: plan._id,
    planCode: plan.code,
    planSnapshot: { name: plan.name, price: plan.price, interval: plan.interval, entitlements: plan.entitlements ?? {} },
    status: "pending",
    replaces: current && current.planCode !== plan.code ? current._id : null,
  });
  const payment = await Payment.create({
    user: user._id,
    type: "subscription",
    refId: subscription._id,
    amount: plan.price,
    status: "pending",
    provider: method === "test" ? "TEST" : "MANUAL",
  });
  await Subscription.updateOne({ _id: subscription._id }, { $push: { payments: payment._id } });
  return { subscription: await Subscription.findById(subscription._id), payment };
}

/** Refresh the cached plan benefits on the subscriber (read synchronously everywhere). */
async function writeCache(type: SubscriberType, id: Types.ObjectId) {
  const active = await activeSubscription(type, id);
  const ent = active?.planSnapshot?.entitlements ?? null;
  const until = active?.endAt ?? null;
  const code = active?.planCode ?? null;
  if (type === "user") {
    await User.updateOne(
      { _id: id },
      { $set: { planCode: code, planEntitlements: ent, isPremium: !!active, ...(active ? { membershipExpiresAt: until } : {}) } }
    );
  } else if (type === "team") {
    await Team.updateOne({ _id: id }, { $set: { planCode: code, planEntitlements: ent, premiumUntil: until } });
  } else {
    await Store.updateOne({ _id: id }, { $set: { planCode: code, planEntitlements: ent, premiumUntil: until } });
  }
}

/** Activate after a verified payment. Renewals of the same plan stack; upgrades end the old plan now. */
export async function activateSubscription(subscriptionId: Types.ObjectId | string) {
  const s = await Subscription.findById(subscriptionId);
  if (!s || s.status !== "pending") return s;
  const now = new Date();
  const current = await activeSubscription(s.subscriberType, s.subscriber);
  let base = now;
  if (current && current.planCode === s.planCode && current.endAt) base = current.endAt;
  const length = INTERVAL_MS[s.planSnapshot.interval] ?? INTERVAL_MS.month;
  const updated = await Subscription.findOneAndUpdate(
    { _id: s._id, status: "pending" },
    { $set: { status: "active", startAt: now, endAt: new Date(base.getTime() + length) } },
    { new: true }
  );
  if (!updated) return s;
  if (current) {
    // Same plan: the old period is folded into the new end date. Different plan: replaced now.
    await Subscription.updateOne(
      { _id: current._id },
      { $set: { status: current.planCode === s.planCode ? "expired" : "cancelled", cancelledAt: now, cancelReason: current.planCode === s.planCode ? "Renewed" : `Replaced by ${s.planSnapshot.name}` } }
    );
  }
  await writeCache(s.subscriberType, s.subscriber);
  await notify(s.owner, {
    type: "subscription.status",
    title: `${s.planSnapshot.name} is active`,
    body: `Until ${updated.endAt!.toLocaleDateString()}`,
    link: "/membership",
    entity: { type: "subscription", id: s._id },
  });
  return updated;
}

/** Legacy membership checkout (monthly/yearly): record it as a Premium subscription too. */
export async function activateMembershipPayment(user: IUser, plan: "monthly" | "yearly", payment: IPayment) {
  await ensureDefaultPlans();
  const p = await Plan.findOne({ code: plan === "monthly" ? "player_premium_monthly" : "player_premium_yearly" });
  if (!p) return;
  const s = await Subscription.create({
    subscriberType: "user",
    subscriber: user._id,
    owner: user._id,
    plan: p._id,
    planCode: p.code,
    planSnapshot: { name: p.name, price: payment.amount, interval: p.interval, entitlements: p.entitlements ?? {} },
    status: "pending",
    payments: [payment._id],
  });
  return activateSubscription(s._id);
}

/** Cancel: a pending one is dropped now; an active one runs to the end of its period. */
export async function cancelSubscription(user: IUser, id: string) {
  if (!isObjectIdString(id)) throw new AppError(404, "Subscription not found");
  const s = await Subscription.findById(id);
  if (!s || !s.owner.equals(user._id)) throw new AppError(404, "Subscription not found");
  if (s.status === "pending") {
    await Subscription.updateOne({ _id: s._id }, { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Cancelled before payment" } });
    await Payment.updateMany({ _id: { $in: s.payments }, status: "pending" }, { $set: { status: "cancelled" } });
  } else if (s.status === "active") {
    await Subscription.updateOne({ _id: s._id }, { $set: { cancelAtPeriodEnd: true, cancelledAt: new Date() } });
  } else {
    throw new AppError(400, `This subscription is already ${s.status}`);
  }
  return Subscription.findById(s._id);
}

/** Staff end a subscription immediately (e.g. after a refund). */
export async function endSubscriptionNow(actor: IUser | null, id: Types.ObjectId | string, reason: string) {
  const s = await Subscription.findById(id);
  if (!s || (s.status !== "active" && s.status !== "pending")) return s;
  await Subscription.updateOne({ _id: s._id }, { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason, endAt: new Date() } });
  await writeCache(s.subscriberType, s.subscriber);
  if (actor) await audit({ actor: actor._id, actorRole: actor.role, action: "subscription.ended", target: { type: "subscription", id: s._id }, reason });
  return Subscription.findById(s._id);
}

export async function mySubscriptions(user: IUser) {
  return Subscription.find({ owner: user._id }).sort({ createdAt: -1 }).limit(50).populate("payments");
}

export async function adminListSubscriptions(query: Record<string, unknown>, p: Page) {
  const filter: any = {};
  const status = queryString(query.status);
  if (status) filter.status = status;
  const type = queryString(query.subscriberType);
  if (type) filter.subscriberType = type;
  const [items, total] = await Promise.all([
    Subscription.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("owner", "name email").populate("payments"),
    Subscription.countDocuments(filter),
  ]);
  return { subscriptions: items, ...pageMeta(p, total) };
}

// ---------------------------------------------------------------- sweeper

const REMINDER_DAYS = [7, 1];

/** Expire subscriptions past their end; remind owners 7 days and 1 day before. */
export async function sweepSubscriptions() {
  const now = new Date();
  const due = await Subscription.find({ status: "active", endAt: { $lte: now } }).limit(500);
  for (const s of due) {
    const res = await Subscription.updateOne({ _id: s._id, status: "active" }, { $set: { status: "expired" } });
    if (!res.modifiedCount) continue;
    await writeCache(s.subscriberType, s.subscriber);
    await notify(s.owner, { type: "subscription.expiring", title: `${s.planSnapshot.name} has ended`, body: "Renew any time from the membership page.", link: "/membership", entity: { type: "subscription", id: s._id } });
  }
  for (const days of REMINDER_DAYS) {
    const soon = await Subscription.find({
      status: "active",
      cancelAtPeriodEnd: false,
      endAt: { $gt: now, $lte: new Date(now.getTime() + days * DAY) },
      remindersSent: { $ne: days },
    }).limit(500);
    for (const s of soon) {
      await Subscription.updateOne({ _id: s._id }, { $addToSet: { remindersSent: days } });
      await notify(s.owner, {
        type: "subscription.expiring",
        title: `${s.planSnapshot.name} ends in ${days === 1 ? "a day" : `${days} days`}`,
        link: "/membership",
        entity: { type: "subscription", id: s._id },
      });
    }
  }
  return due.length;
}

export function toSubscriptionJSON(s: any) {
  return {
    id: s._id.toString(),
    subscriberType: s.subscriberType,
    subscriberId: s.subscriber.toString(),
    planCode: s.planCode,
    plan: s.planSnapshot,
    status: s.status,
    startAt: s.startAt,
    endAt: s.endAt,
    cancelAtPeriodEnd: !!s.cancelAtPeriodEnd,
    cancelReason: s.cancelReason ?? null,
    owner: s.owner && s.owner.name ? { id: s.owner._id.toString(), name: s.owner.name, email: s.owner.email } : undefined,
    payments: (s.payments ?? []).filter((p: any) => p && p._id).map((p: any) => ({ id: p._id.toString(), amount: p.amount, status: p.status, provider: p.provider, reference: p.reference ?? null, createdAt: p.createdAt })),
    createdAt: s.createdAt,
  };
}

export type { ISubscription };
