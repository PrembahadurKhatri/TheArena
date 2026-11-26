import { Schema, model, Document, Types } from "mongoose";

// Statuses:
//   pending   – created, waiting for the money (or, for MANUAL, for staff to verify the proof)
//   paid      – money received ("success" is the same thing on older records)
//   failed    – not paid (declined, abandoned, proof rejected)
//   cancelled – the thing being paid for was cancelled before payment
//   refunded  – paid, then returned by staff
//
// Providers:
//   TEST   – sandbox: the user confirms their own payment (only when PAYMENT_MODE=test)
//   MANUAL – the user pays outside The Arena (bank transfer, eSewa/Khalti to the
//            merchant number) and submits a reference; Finance staff verify it
// No real gateway is connected yet; see docs/MASTER_PLAN.md.
export type PaymentType = "ground_booking" | "membership" | "shop_order" | "subscription";
export type PaymentStatus = "pending" | "paid" | "success" | "failed" | "cancelled" | "refunded";
export type PaymentProvider = "TEST" | "MANUAL";
export type MembershipPlan = "monthly" | "yearly";
export const PAID_STATUSES: PaymentStatus[] = ["paid", "success"];

export interface IPayment extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: PaymentType;
  refId?: Types.ObjectId | null;
  plan?: MembershipPlan | null;
  amount: number;
  status: PaymentStatus;
  provider: PaymentProvider;
  // MANUAL payments
  reference?: string | null;
  proofImage?: string | null;
  submittedAt?: Date | null;
  verifiedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  rejectionReason?: string | null;
  // Set when a paid booking or order is cancelled: staff return the money.
  refundRequested?: boolean;
  refundedBy?: Types.ObjectId | null;
  refundedAt?: Date | null;
  refundNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["ground_booking", "membership", "shop_order", "subscription"], required: true },
    refId: { type: Schema.Types.ObjectId, default: null },
    plan: { type: String, enum: ["monthly", "yearly", null], default: null },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "success", "failed", "cancelled", "refunded"], default: "pending" },
    provider: { type: String, enum: ["TEST", "MANUAL"], default: "TEST" },
    reference: { type: String, trim: true, maxlength: 100, default: null },
    proofImage: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 500 },
    refundRequested: { type: Boolean, default: false },
    refundedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    refundedAt: { type: Date, default: null },
    refundNote: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

// At most one *pending* payment per booking/order/subscription — the
// database-level guard behind duplicate-checkout prevention.
paymentSchema.index(
  { type: 1, refId: 1 },
  { unique: true, partialFilterExpression: { status: "pending", refId: { $type: "objectId" } } }
);
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, provider: 1, createdAt: 1 });
paymentSchema.index({ refundRequested: 1, status: 1 });

export const Payment = model<IPayment>("Payment", paymentSchema);
