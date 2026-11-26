import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";
import { pointSchema } from "../utils/locations";

// Team roles: the owner (team.owner), one captain and one vice-captain
// (team.captain / team.viceCaptain, both members), everyone else a player.
// `members` is the roster and includes the owner.
export const TEAM_ROLES = ["owner", "captain", "vice_captain", "player"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const TEAM_STATUSES = ["active", "suspended"] as const;

export interface ITeamInvitation {
  user: Types.ObjectId;
  invitedBy: Types.ObjectId;
  createdAt: Date;
}

export interface ITeam extends Document {
  _id: Types.ObjectId;
  name: string;
  // Normalized name (NFKC, trimmed, single spaces, lowercase): unique, so
  // "Kathmandu Kings" and "kathmandu  KINGS" can't both exist.
  nameKey: string;
  slug: string;
  sport: string;
  logo?: string | null;
  coverImage?: string | null;
  description?: string;
  province?: string;
  district?: string;
  municipality?: string;
  geo?: { type: "Point"; coordinates: [number, number] } | null;
  owner: Types.ObjectId;
  captain: Types.ObjectId | null;
  viceCaptain: Types.ObjectId | null;
  members: Types.ObjectId[];
  pendingRequests: Types.ObjectId[];
  invitations: ITeamInvitation[];
  status: (typeof TEAM_STATUSES)[number];
  // Cache of the active team subscription (written only by subscriptionsService).
  planCode?: string | null;
  planEntitlements?: Record<string, unknown> | null;
  premiumUntil?: Date | null;
  statusReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String },
    slug: { type: String },
    sport: { type: String, required: true, validate: sportValidator },
    logo: { type: String, default: null },
    coverImage: { type: String, default: null },
    description: { type: String, trim: true, maxlength: 1000 },
    province: { type: String, enum: PROVINCES },
    district: { type: String, trim: true },
    municipality: { type: String, trim: true, maxlength: 80 },
    geo: { type: pointSchema, default: undefined },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    captain: { type: Schema.Types.ObjectId, ref: "User", default: null },
    viceCaptain: { type: Schema.Types.ObjectId, ref: "User", default: null },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    pendingRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
    invitations: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        createdAt: { type: Date, default: () => new Date() },
      },
    ],
    status: { type: String, enum: TEAM_STATUSES, default: "active" },
    planCode: { type: String, default: null },
    planEntitlements: { type: Schema.Types.Mixed, default: null },
    premiumUntil: { type: Date, default: null },
    statusReason: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

teamSchema.index({ nameKey: 1 }, { unique: true, partialFilterExpression: { nameKey: { $type: "string" } } });
teamSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
teamSchema.index({ owner: 1 });
teamSchema.index({ members: 1 });
teamSchema.index({ "invitations.user": 1 });
teamSchema.index({ sport: 1, createdAt: -1 });
teamSchema.index({ sport: 1, province: 1, district: 1 });
teamSchema.index({ geo: "2dsphere" }, { sparse: true });

export const Team = model<ITeam>("Team", teamSchema);
