import { Schema, model, Document, Types } from "mongoose";

// In-app notification for one user. Written only through
// services/notificationService.ts. Old notifications expire after 180 days.
export const NOTIFICATION_TYPES = [
  "team.invitation",
  "team.join_request",
  "team.join_response",
  "team.role_changed",
  "team.removed",
  "challenge.received",
  "challenge.accepted",
  "challenge.declined",
  "challenge.countered",
  "challenge.cancelled",
  "match.reminder",
  "match.report_submitted",
  "match.report_confirmed",
  "match.report_disputed",
  "match.result_verified",
  "tournament.registration",
  "tournament.registration_response",
  "tournament.review",
  "tournament.update",
  "booking.confirmed",
  "booking.cancelled",
  "order.placed",
  "order.status",
  "subscription.expiring",
  "subscription.status",
  "payment.status",
  "merchant.review",
  "product.review",
  "ground.review",
  "account.status",
  "staff.access",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  entity?: { type: string; id: Types.ObjectId | null };
  actor?: Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, maxlength: 1000 },
    link: { type: String, maxlength: 300 },
    entity: {
      type: { type: String },
      id: { type: Schema.Types.ObjectId, default: null },
    },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, readAt: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export const Notification = model<INotification>("Notification", notificationSchema);
