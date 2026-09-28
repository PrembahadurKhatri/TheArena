import { Schema, model, Document, Types } from "mongoose";
import { MembershipPlan } from "./Payment";

export interface IMembership extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  plan: MembershipPlan;
  startedAt: Date;
  expiresAt: Date;
  payment: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["monthly", "yearly"], required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
  },
  { timestamps: true }
);

export const Membership = model<IMembership>("Membership", membershipSchema);
