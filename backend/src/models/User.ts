import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";
import { ALL_PERMISSIONS, Permission } from "../config/permissions";
import { pointSchema } from "../utils/locations";

export const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced", "professional"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export interface ISportProfile {
  sport: string;
  position?: string;
  experienceLevel?: ExperienceLevel;
}

export interface IPrivacy {
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showAge: boolean;
  // false = hidden from the player directory and near-me search.
  discoverable: boolean;
  // Important notifications (invitations, challenges, orders, results) also by email.
  emailNotifications: boolean;
}

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
  // Public handle. usernameKey is its lowercased form, unique, so "Ram" and
  // "ram" can't both exist.
  username?: string;
  usernameKey?: string;
  email: string;
  passwordHash: string;
  phone?: string;
  photo?: string | null;
  location?: string;
  province?: string;
  district?: string;
  municipality?: string;
  geo?: { type: "Point"; coordinates: [number, number] } | null;
  dateOfBirth?: Date | null;
  gender?: (typeof GENDERS)[number] | null;
  bio?: string;
  sportProfiles: ISportProfile[];
  privacy: IPrivacy;
  passwordChangedAt?: Date | null;
  // Cache of the active player subscription (written only by subscriptionsService).
  planCode?: string | null;
  planEntitlements?: Record<string, unknown> | null;
  isPremium: boolean;
  membershipExpiresAt: Date | null;
  role: UserRole;
  // Staff (role "admin") only. A Super Admin holds every permission; other
  // staff get their StaffRole's permissions plus grants, minus revokes.
  isSuperAdmin: boolean;
  staffRole: Types.ObjectId | null;
  permissionOverrides: { grant: Permission[]; revoke: Permission[] };
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
    username: { type: String, trim: true },
    usernameKey: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String },
    photo: { type: String, default: null },
    location: { type: String, trim: true },
    province: { type: String, enum: PROVINCES },
    district: { type: String, trim: true },
    municipality: { type: String, trim: true, maxlength: 80 },
    geo: { type: pointSchema, default: undefined },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: [...GENDERS, null], default: null },
    bio: { type: String, trim: true, maxlength: 500 },
    sportProfiles: [
      {
        _id: false,
        sport: { type: String, required: true, validate: sportValidator },
        position: { type: String, trim: true, maxlength: 40 },
        experienceLevel: { type: String, enum: EXPERIENCE_LEVELS },
      },
    ],
    privacy: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showLocation: { type: Boolean, default: true },
      showAge: { type: Boolean, default: false },
      discoverable: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
    },
    passwordChangedAt: { type: Date, default: null },
    planCode: { type: String, default: null },
    planEntitlements: { type: Schema.Types.Mixed, default: null },
    isPremium: { type: Boolean, default: false },
    membershipExpiresAt: { type: Date, default: null },
    role: { type: String, enum: USER_ROLES, default: "player" },
    isSuperAdmin: { type: Boolean, default: false },
    staffRole: { type: Schema.Types.ObjectId, ref: "StaffRole", default: null },
    permissionOverrides: {
      grant: [{ type: String, enum: ALL_PERMISSIONS }],
      revoke: [{ type: String, enum: ALL_PERMISSIONS }],
    },
    status: { type: String, enum: ACCOUNT_STATUSES, default: "active" },
    statusReason: { type: String, default: null, maxlength: 500 },
    statusChangedAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date, default: null },
    sportPreferences: [{ type: String, validate: sportValidator }],
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ usernameKey: 1 }, { unique: true, partialFilterExpression: { usernameKey: { $type: "string" } } });
userSchema.index({ geo: "2dsphere" }, { sparse: true });
userSchema.index({ sportPreferences: 1, province: 1, district: 1 });
userSchema.index({ isSuperAdmin: 1 }, { partialFilterExpression: { isSuperAdmin: true } });
userSchema.index({ status: 1, createdAt: -1 });

export const User = model<IUser>("User", userSchema);
