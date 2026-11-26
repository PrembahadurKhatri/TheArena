import { Types } from "mongoose";
import { Report, REPORT_REASONS, REPORT_TARGETS, ReportTarget } from "../models/Report";
import { User, IUser } from "../models/User";
import { Team } from "../models/Team";
import { Store } from "../models/Store";
import { Product } from "../models/Product";
import { Review } from "../models/Review";
import { Match } from "../models/Match";
import { Tournament } from "../models/Tournament";
import { Ground } from "../models/Ground";
import { GroundBooking } from "../models/GroundBooking";
import { Order } from "../models/Order";
import { SellerOrder } from "../models/SellerOrder";
import { Subscription } from "../models/Subscription";
import { AuditLog } from "../models/AuditLog";
import { MatchReport } from "../models/MatchReport";
import { Payment } from "../models/Payment";
import { AppError } from "../utils/AppError";
import { isObjectIdString, optionalString, queryString } from "../utils/validation";
import { Page, pageMeta } from "../utils/pagination";
import { isValidDistrict, provinceOfDistrict } from "../utils/locations";
import { audit } from "./auditService";
import { notify } from "./notificationService";

const MODELS: Record<ReportTarget, any> = { user: User, team: Team, store: Store, product: Product, review: Review, match: Match, tournament: Tournament, ground: Ground };

/** Anyone signed in can report an account or content. One open report per person per target. */
export async function fileReport(user: IUser, input: { targetType?: unknown; targetId?: unknown; reason?: unknown; details?: unknown }) {
  const targetType = String(input.targetType) as ReportTarget;
  if (!(REPORT_TARGETS as readonly string[]).includes(targetType)) throw new AppError(400, `targetType must be one of: ${REPORT_TARGETS.join(", ")}`);
  if (!isObjectIdString(input.targetId)) throw new AppError(400, "targetId is required");
  const reason = String(input.reason);
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw new AppError(400, `reason must be one of: ${REPORT_REASONS.join(", ")}`);
  if (!(await MODELS[targetType].exists({ _id: input.targetId }))) throw new AppError(404, "Not found");
  if (targetType === "user" && user._id.equals(String(input.targetId))) throw new AppError(400, "You can't report yourself");
  try {
    const r = await Report.create({ reporter: user._id, targetType, targetId: input.targetId, reason, details: optionalString(input.details, "details", 1000) });
    return { id: r._id.toString(), status: r.status };
  } catch (err: any) {
    if (err?.code === 11000) throw new AppError(409, "You've already reported this; our team is looking at it");
    throw err;
  }
}

async function describeTarget(type: ReportTarget, id: Types.ObjectId) {
  const doc: any = await MODELS[type].findById(id).lean();
  if (!doc) return { exists: false, label: "(deleted)", link: null };
  const label = doc.name ?? doc.title ?? (type === "review" ? `${doc.rating}★ review` : type === "match" ? "Match" : String(id));
  const link =
    type === "user" ? `/admin/users/${id}` : type === "team" ? `/teams/${doc.slug ?? id}` : type === "store" ? `/shop/stores/${doc.slug ?? id}` : type === "product" ? `/shop/products/${doc.slug ?? id}` : type === "match" ? `/matches/${id}` : type === "tournament" ? `/tournaments/${doc.slug ?? id}` : type === "ground" ? `/grounds/${doc.slug ?? id}` : null;
  return { exists: true, label, link };
}

export async function listReports(query: Record<string, unknown>, p: Page) {
  const filter: any = {};
  const status = queryString(query.status) ?? "open";
  if (status !== "all") filter.status = status === "open" ? { $in: ["open", "in_review"] } : status;
  const type = queryString(query.targetType);
  if (type) filter.targetType = type;
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: 1 }).skip(p.skip).limit(p.limit).populate("reporter", "name email").populate("handledBy", "name").lean(),
    Report.countDocuments(filter),
  ]);
  // How many people reported the same target: busy targets first matter more.
  const counts = await Report.aggregate([
    { $match: { status: { $in: ["open", "in_review"] }, targetId: { $in: items.map((i: any) => i.targetId) } } },
    { $group: { _id: "$targetId", n: { $sum: 1 } } },
  ]);
  const byTarget = new Map(counts.map((c: any) => [c._id.toString(), c.n]));
  const rows = await Promise.all(
    items.map(async (r: any) => ({
      id: r._id.toString(),
      targetType: r.targetType,
      targetId: r.targetId.toString(),
      target: await describeTarget(r.targetType, r.targetId),
      openReports: byTarget.get(r.targetId.toString()) ?? 0,
      reason: r.reason,
      details: r.details ?? null,
      status: r.status,
      reporter: r.reporter ? { name: r.reporter.name, email: r.reporter.email } : null,
      handledBy: r.handledBy?.name ?? null,
      resolution: r.resolution ?? null,
      createdAt: r.createdAt,
    }))
  );
  return { reports: rows, ...pageMeta(p, total) };
}

/**
 * Close a report: "actioned" (staff took action elsewhere, e.g. suspended the
 * account) or "dismissed". Resolving one closes every open report on that target.
 */
export async function resolveReport(actor: IUser, id: string, input: { status?: unknown; resolution?: unknown }) {
  if (!isObjectIdString(id)) throw new AppError(404, "Report not found");
  const r = await Report.findById(id);
  if (!r) throw new AppError(404, "Report not found");
  const status = String(input.status);
  if (!["in_review", "actioned", "dismissed"].includes(status)) throw new AppError(400, 'status must be "in_review", "actioned" or "dismissed"');
  const resolution = optionalString(input.resolution, "resolution", 1000) ?? null;
  if (status !== "in_review" && !resolution) throw new AppError(400, "Note what was decided");
  const filter = status === "in_review" ? { _id: r._id } : { targetType: r.targetType, targetId: r.targetId, status: { $in: ["open", "in_review"] } };
  const affected = await Report.find(filter).select("reporter");
  await Report.updateMany(filter, { $set: { status, resolution, handledBy: actor._id, handledAt: new Date() } });
  await audit({ actor: actor._id, actorRole: actor.role, action: `report.${status}`, target: { type: r.targetType, id: r.targetId }, reason: resolution ?? undefined });
  if (status !== "in_review") {
    await notify(affected.map((a) => a.reporter), { type: "system", title: "Thanks for your report: our team has reviewed it", body: status === "actioned" ? "We took action." : "We didn't find a rule broken." });
  }
  return { updated: affected.length };
}

// ---------------------------------------------------------------- overview

/** Headline numbers for the admin overview. Money figures are records, not settled payments. */
export async function overview() {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [
    users,
    activePlayers,
    suspended,
    banned,
    teams,
    merchants,
    pendingMerchants,
    grounds,
    pendingGrounds,
    tournaments,
    tournamentsForReview,
    matches,
    verifiedMatches,
    disputes,
    bookings,
    orders,
    deliveredRevenue,
    activeSubs,
    pendingProducts,
    openReports,
    awaitingPayments,
    activity,
  ] = await Promise.all([
    User.countDocuments({ role: "player" }),
    User.countDocuments({ role: "player", status: "active", lastLoginAt: { $gte: since30 } }),
    User.countDocuments({ status: "suspended" }),
    User.countDocuments({ status: "banned" }),
    Team.countDocuments(),
    Store.countDocuments({ status: { $in: ["approved", null] } }),
    Store.countDocuments({ status: "pending" }),
    Ground.countDocuments({ status: { $in: ["approved", null] } }),
    Ground.countDocuments({ status: "pending" }),
    Tournament.countDocuments({ status: { $nin: ["cancelled", "rejected"] } }),
    Tournament.countDocuments({ status: "under_review" }),
    Match.countDocuments({ status: { $ne: "cancelled" } }),
    Match.countDocuments({ status: "completed" }),
    MatchReport.countDocuments({ status: "disputed" }),
    GroundBooking.countDocuments({ source: { $ne: "owner" }, status: { $nin: ["cancelled", "blocked"] } }),
    Order.countDocuments({ status: { $ne: "cancelled" } }),
    SellerOrder.aggregate([{ $match: { status: "delivered" } }, { $group: { _id: null, total: { $sum: "$subtotal" } } }]),
    Subscription.aggregate([{ $match: { status: "active", endAt: { $gt: new Date() } } }, { $group: { _id: "$planCode", n: { $sum: 1 } } }]),
    Product.countDocuments({ status: "pending_review" }),
    Report.countDocuments({ status: { $in: ["open", "in_review"] } }),
    Payment.countDocuments({ status: "pending", provider: "MANUAL", submittedAt: { $ne: null } }),
    AuditLog.find().sort({ createdAt: -1 }).limit(15).populate("actor", "name").lean(),
  ]);
  return {
    totals: {
      users,
      activePlayers30d: activePlayers,
      suspendedUsers: suspended,
      bannedUsers: banned,
      teams,
      merchants,
      grounds,
      tournaments,
      matches,
      verifiedMatches,
      bookings,
      orders,
      deliveredOrderValue: deliveredRevenue[0]?.total ?? 0,
      activeSubscriptions: activeSubs.reduce((n: number, s: any) => n + s.n, 0),
      activeSubscriptionsByPlan: Object.fromEntries(activeSubs.map((s: any) => [s._id, s.n])),
    },
    pending: {
      merchants: pendingMerchants,
      products: pendingProducts,
      grounds: pendingGrounds,
      tournaments: tournamentsForReview,
      disputes,
      reports: openReports,
      manualPayments: awaitingPayments,
    },
    activity: activity.map((a: any) => ({ action: a.action, actor: a.actor?.name ?? "system", at: a.createdAt })),
  };
}

// ---------------------------------------------------------------- user edits

/** Staff correct a user's profile details (never role, status or password here). */
export async function adminEditUser(actor: IUser, id: string, input: Record<string, unknown>) {
  if (!isObjectIdString(id)) throw new AppError(404, "User not found");
  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");
  if (user.role === "admin" && !(actor.isSuperAdmin && actor.role === "admin")) throw new AppError(403, "Only a Super Admin can edit staff accounts");
  const before = { name: user.name, phone: user.phone ?? null, district: user.district ?? null, bio: user.bio ?? null };
  if (input.name !== undefined) {
    const name = optionalString(input.name, "name", 80);
    if (!name || name.length < 2) throw new AppError(400, "name must be at least 2 characters");
    user.name = name;
  }
  if (input.phone !== undefined) user.phone = optionalString(input.phone, "phone", 20);
  if (input.bio !== undefined) user.bio = optionalString(input.bio, "bio", 500);
  if (input.district !== undefined) {
    if (input.district && !isValidDistrict(input.district)) throw new AppError(400, "Invalid district");
    user.district = (input.district as string) || undefined;
    if (user.district) user.province = provinceOfDistrict(user.district) ?? user.province;
  }
  if (input.removePhoto === true) user.photo = null;
  await user.save();
  await audit({ actor: actor._id, actorRole: actor.role, action: "user.edited_by_staff", target: { type: "user", id: user._id }, before, after: { name: user.name, phone: user.phone ?? null, district: user.district ?? null, bio: user.bio ?? null, photoRemoved: input.removePhoto === true } });
  return user;
}
