import { Schema, model, Document, Types } from "mongoose";

// Platform-wide message from staff. Stored once and read by everyone in the
// audience — not copied into each user's notifications.
export const ANNOUNCEMENT_AUDIENCES = ["all", "players", "merchants", "ground_owners"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export interface IAnnouncement extends Document {
  _id: Types.ObjectId;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  publishedAt: Date;
  expiresAt: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    audience: { type: String, enum: ANNOUNCEMENT_AUDIENCES, default: "all" },
    publishedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

announcementSchema.index({ publishedAt: -1 });

export const Announcement = model<IAnnouncement>("Announcement", announcementSchema);
