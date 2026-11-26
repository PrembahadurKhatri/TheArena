import { Schema, model, Document, Types } from "mongoose";

// pending_payment  – held while the online payment is made (expires after BOOKING_HOLD_MINUTES)
// confirmed        – paid online
// confirmed_unpaid – pay at the venue; the slot is held, the owner marks it paid or no-show
// blocked          – the owner closed the slot (maintenance, private event)
// completed / no_show – after the slot, set by the owner
// cancelled        – by the user, the owner, or because the hold expired
export type BookingStatus = "pending_payment" | "confirmed" | "confirmed_unpaid" | "blocked" | "completed" | "no_show" | "cancelled";
export const BOOKING_STATUSES: BookingStatus[] = ["pending_payment", "confirmed", "confirmed_unpaid", "blocked", "completed", "no_show", "cancelled"];
// Statuses that occupy the slot (pending_payment only while its hold lasts).
export const HOLDING_STATUSES: BookingStatus[] = ["confirmed", "confirmed_unpaid", "blocked"];

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
  source: "direct" | "challenge" | "owner";
  challenge: Types.ObjectId | null;
  paymentMethod: "online" | "pay_at_venue";
  cancelledAt: Date | null;
  cancelledBy: Types.ObjectId | null;
  cancelReason?: string | null;
  note?: string;
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
    status: { type: String, enum: BOOKING_STATUSES, default: "pending_payment" },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    source: { type: String, enum: ["direct", "challenge", "owner"], default: "direct" },
    challenge: { type: Schema.Types.ObjectId, ref: "Challenge", default: null },
    paymentMethod: { type: String, enum: ["online", "pay_at_venue"], default: "online" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelReason: { type: String, default: null, maxlength: 300 },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// Overlap checks query by ground + date + status.
groundBookingSchema.index({ ground: 1, date: 1, status: 1 });
groundBookingSchema.index({ user: 1, createdAt: -1 });
groundBookingSchema.index({ status: 1, createdAt: 1 });

export const GroundBooking = model<IGroundBooking>("GroundBooking", groundBookingSchema);
