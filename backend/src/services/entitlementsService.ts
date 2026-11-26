import { IUser } from "../models/User";

// The one place backend code asks "what is this user (team, store) allowed
// to do or use?". Benefits come from the active subscription's plan
// snapshot, cached on the subscriber by subscriptionsService so these checks
// stay synchronous. Free defaults apply when there is no active plan.
export interface PlayerEntitlements {
  plan: "free" | "premium";
  planCode: string | null;
  maxOwnedTeams: number; // Infinity = unlimited
  advancedMatchmaking: boolean;
  maxSearchRadiusKm: number;
  advancedStats: boolean;
  profileBadge: boolean;
  bookingDiscountPct: number;
  canOrganizeTournaments: boolean;
}

const FREE: PlayerEntitlements = {
  plan: "free",
  planCode: null,
  maxOwnedTeams: 1,
  advancedMatchmaking: false,
  maxSearchRadiusKm: 10,
  advancedStats: false,
  profileBadge: false,
  bookingDiscountPct: 0,
  canOrganizeTournaments: false,
};

// Premium from before plans existed (isPremium set with no plan snapshot).
const LEGACY_PREMIUM: PlayerEntitlements = {
  plan: "premium",
  planCode: null,
  maxOwnedTeams: Infinity,
  advancedMatchmaking: true,
  maxSearchRadiusKm: 100,
  advancedStats: true,
  profileBadge: true,
  bookingDiscountPct: 10,
  canOrganizeTournaments: true,
};

type PremiumFields = Pick<IUser, "isPremium" | "membershipExpiresAt"> & { planCode?: string | null; planEntitlements?: Record<string, unknown> | null };

export function isPremiumActive(user: PremiumFields | null | undefined): boolean {
  if (!user || !user.isPremium) return false;
  return !user.membershipExpiresAt || user.membershipExpiresAt > new Date();
}

export function getEntitlements(user: PremiumFields | null | undefined): PlayerEntitlements {
  if (!isPremiumActive(user)) return FREE;
  const snap = user!.planEntitlements;
  if (!snap) return LEGACY_PREMIUM;
  const out: PlayerEntitlements = { ...FREE, plan: "premium", planCode: user!.planCode ?? null };
  for (const k of Object.keys(FREE) as (keyof PlayerEntitlements)[]) {
    if (k === "plan" || k === "planCode") continue;
    if (snap[k] === undefined) continue;
    (out as any)[k] = k === "maxOwnedTeams" && snap[k] === null ? Infinity : snap[k];
  }
  return out;
}

/** Entitlements as JSON (Infinity isn't valid JSON). */
export function entitlementsJSON(e: PlayerEntitlements) {
  return { ...e, maxOwnedTeams: Number.isFinite(e.maxOwnedTeams) ? e.maxOwnedTeams : null };
}

const active = (s: { premiumUntil?: Date | null; planEntitlements?: Record<string, unknown> | null } | null | undefined) =>
  !!s?.planEntitlements && !!s.premiumUntil && s.premiumUntil > new Date();

export function teamEntitlements(team: { premiumUntil?: Date | null; planEntitlements?: Record<string, unknown> | null } | null | undefined) {
  const e = active(team) ? team!.planEntitlements! : {};
  return { premium: active(team), teamAnalytics: !!e.teamAnalytics, teamBadge: !!e.teamBadge, featuredTeam: !!e.featuredTeam };
}

export const MERCHANT_FREE_PRODUCTS = 20;

export function storeEntitlements(store: { premiumUntil?: Date | null; planEntitlements?: Record<string, unknown> | null } | null | undefined) {
  const e = active(store) ? store!.planEntitlements! : {};
  return {
    premium: active(store),
    maxProducts: typeof e.maxProducts === "number" ? e.maxProducts : MERCHANT_FREE_PRODUCTS,
    featuredStore: !!e.featuredStore,
    salesReports: !!e.salesReports,
  };
}
