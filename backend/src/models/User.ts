import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  photo?: string | null;
  location?: string;
  province?: string;
  isPremium: boolean;
  membershipExpiresAt: Date | null;
  role: "player" | "admin";
  sportPreferences: string[];
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String },
    photo: { type: String, default: null },
    location: { type: String, trim: true },
    province: { type: String, enum: PROVINCES },
    isPremium: { type: Boolean, default: false },
    membershipExpiresAt: { type: Date, default: null },
    role: { type: String, enum: ["player", "admin"], default: "player" },
    sportPreferences: [{ type: String, enum: SPORT_SLUG_ENUM }],
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
