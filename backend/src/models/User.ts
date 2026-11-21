import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";

// Platform-wide roles. Shop owner, team owner/captain and tournament
// organizer are not roles: they're permissions on a specific store/team/
// tournament, checked against that resource's owner fields.
export const USER_ROLES = ["player", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// suspended = temporarily blocked (reversible); banned = permanently blocked.
export const ACCOUNT_STATUSES = ["active", "suspended", "banned"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

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
  role: UserRole;
  status: AccountStatus;
  statusReason?: string | null;
  statusChangedAt?: Date | null;
  // Bumped to sign out every existing session (password reset, logout from
  // all devices, suspension). Tokens carry the version they were issued with.
  tokenVersion: number;
  lastLoginAt?: Date | null;
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
    role: { type: String, enum: USER_ROLES, default: "player" },
    status: { type: String, enum: ACCOUNT_STATUSES, default: "active" },
    statusReason: { type: String, default: null, maxlength: 500 },
    statusChangedAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date, default: null },
    sportPreferences: [{ type: String, enum: SPORT_SLUG_ENUM }],
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ status: 1, createdAt: -1 });

export const User = model<IUser>("User", userSchema);
