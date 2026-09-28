import { Schema, model, Document, Types } from "mongoose";

export type PaymentType = "ground_booking" | "membership";
export type PaymentStatus = "pending" | "success" | "failed";
export type MembershipPlan = "monthly" | "yearly";

export interface IPayment extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: PaymentType;
  refId?: Types.ObjectId | null;
  plan?: MembershipPlan | null;
  amount: number;
  status: PaymentStatus;
  provider: "TEST";
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["ground_booking", "membership"], required: true },
    refId: { type: Schema.Types.ObjectId, default: null },
    plan: { type: String, enum: ["monthly", "yearly"], default: null },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    provider: { type: String, enum: ["TEST"], default: "TEST" },
  },
  { timestamps: true }
);

export const Payment = model<IPayment>("Payment", paymentSchema);
