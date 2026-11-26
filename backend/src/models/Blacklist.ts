import { Schema, model, Document, Types } from "mongoose";

// Emails and phone numbers that may not be used to register or be added to a
// profile. Stored as SHA-256 of the normalized value: the list is a check,
// not a contact list.
export type BlacklistKind = "email" | "phone";

export interface IBlacklist extends Document {
  _id: Types.ObjectId;
  kind: BlacklistKind;
  valueHash: string;
  hint: string; // e.g. "r***@gmail.com", for staff to recognise the entry
  reason?: string;
  user: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
}

const blacklistSchema = new Schema<IBlacklist>(
  {
    kind: { type: String, enum: ["email", "phone"], required: true },
    valueHash: { type: String, required: true },
    hint: { type: String, required: true },
    reason: { type: String, maxlength: 500 },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

blacklistSchema.index({ kind: 1, valueHash: 1 }, { unique: true });
blacklistSchema.index({ user: 1 });

export const Blacklist = model<IBlacklist>("Blacklist", blacklistSchema);
