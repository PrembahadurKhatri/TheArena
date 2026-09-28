import { Schema, model, Document, Types } from "mongoose";

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled";

export interface IGroundBooking extends Document {
  _id: Types.ObjectId;
  ground: Types.ObjectId;
  user: Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: BookingStatus;
  payment: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const groundBookingSchema = new Schema<IGroundBooking>(
  {
    ground: { type: Schema.Types.ObjectId, ref: "Ground", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["pending_payment", "confirmed", "cancelled"], default: "pending_payment" },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
  },
  { timestamps: true }
);

export const GroundBooking = model<IGroundBooking>("GroundBooking", groundBookingSchema);
