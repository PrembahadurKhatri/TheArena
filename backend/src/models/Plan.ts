import { Schema, model, Document } from "mongoose";

// A subscription plan, editable by staff with plans.manage. What a
// subscriber gets is copied into their Subscription when they buy it
// (planSnapshot), so editing a plan never changes existing subscriptions.
export const PLAN_AUDIENCES = ["player", "team", "merchant"] as const;
export type PlanAudience = (typeof PLAN_AUDIENCES)[number];
export const PLAN_INTERVALS = ["month", "year", "none"] as const;

/** Benefits a plan can grant. Unknown keys are rejected by the service. */
export interface PlanEntitlements {
  // player
  maxOwnedTeams?: number | null; // null = unlimited
  advancedMatchmaking?: boolean;
  maxSearchRadiusKm?: number;
  advancedStats?: boolean;
  profileBadge?: boolean;
  bookingDiscountPct?: number;
  canOrganizeTournaments?: boolean;
  // team
  teamAnalytics?: boolean;
  teamBadge?: boolean;
  featuredTeam?: boolean;
  // merchant
  maxProducts?: number;
  featuredStore?: boolean;
  salesReports?: boolean;
}

export const ENTITLEMENT_KEYS: Record<keyof PlanEntitlements, "number" | "boolean" | "numberOrNull"> = {
  maxOwnedTeams: "numberOrNull",
  advancedMatchmaking: "boolean",
  maxSearchRadiusKm: "number",
  advancedStats: "boolean",
  profileBadge: "boolean",
  bookingDiscountPct: "number",
  canOrganizeTournaments: "boolean",
  teamAnalytics: "boolean",
  teamBadge: "boolean",
  featuredTeam: "boolean",
  maxProducts: "number",
  featuredStore: "boolean",
  salesReports: "boolean",
};

export interface IPlan extends Document {
  code: string;
  audience: PlanAudience;
  name: string;
  description?: string;
  price: number; // NPR per interval
  interval: (typeof PLAN_INTERVALS)[number];
  entitlements: PlanEntitlements;
  features: string[]; // human-readable bullet points
  active: boolean;
  isFree: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z][a-z0-9_]{2,39}$/ },
    audience: { type: String, enum: PLAN_AUDIENCES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    interval: { type: String, enum: PLAN_INTERVALS, default: "month" },
    entitlements: { type: Schema.Types.Mixed, default: {} },
    features: [{ type: String, trim: true, maxlength: 120 }],
    active: { type: Boolean, default: true },
    isFree: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false }
);

planSchema.index({ audience: 1, active: 1, sortOrder: 1 });

export const Plan = model<IPlan>("Plan", planSchema);
