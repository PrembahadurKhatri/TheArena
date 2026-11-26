import { Schema, model, Document, Types } from "mongoose";

// Platform settings changed by Super Admins (settings.manage). Read through
// services/settingsService.ts, which caches them and validates each key.
export interface ISetting extends Document {
  key: string;
  value: unknown;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Setting = model<ISetting>("Setting", settingSchema);
