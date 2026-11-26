import { Schema, model, Document, Types } from "mongoose";
import { PlanEntitlements } from "./Plan";

// A subscriber's plan for a period. Statuses:
//   pending    – waiting for its payment (manual payments are verified by staff)
//   active     – paid and within startAt..endAt
//   cancelled  – stopped (unpaid, rejected, replaced by an upgrade, or by staff)
//   expired    – reached endAt
// cancelAtPeriodEnd = the subscriber cancelled; it stays active until endAt.
export type SubscriptionStatus = "pending" | "active" | "cancelled" | "expired";
export type SubscriberType = "user" | "team" | "store";

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  subscriberType: SubscriberType;
  subscriber: Types.ObjectId;
  owner: Types.ObjectId; // the user who pays (the team owner, the store owner, or the user)
  plan: Types.ObjectId;
  planCode: string;
  planSnapshot: { name: string; price: number; interval: string; entitlements: PlanEntitlements };
  status: SubscriptionStatus;
  startAt: Date | null;
  endAt: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  cancelReason?: string | null;
  payments: Types.ObjectId[];
  replaces: Types.ObjectId | null;
  remindersSent: number[]; // days-before-expiry reminders already sent
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    subscriberType: { type: String, enum: ["user", "team", "store"], required: true },
    subscriber: { type: Schema.Types.ObjectId, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    planCode: { type: String, required: true },
    planSnapshot: {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      interval: { type: String, required: true },
      entitlements: { type: Schema.Types.Mixed, default: {} },
    },
    status: { type: String, enum: ["pending", "active", "cancelled", "expired"], default: "pending" },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, maxlength: 300 },
    payments: [{ type: Schema.Types.ObjectId, ref: "Payment" }],
    replaces: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    remindersSent: [{ type: Number }],
  },
  { timestamps: true, minimize: false }
);

subscriptionSchema.index({ subscriberType: 1, subscriber: 1, status: 1 });
subscriptionSchema.index({ owner: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, endAt: 1 });

export const Subscription = model<ISubscription>("Subscription", subscriptionSchema);
