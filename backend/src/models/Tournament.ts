import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";
import { pointSchema } from "../utils/locations";

// Lifecycle (see services/tournamentsService.ts):
//   open          – created; teams request to take part, the organizer approves them
//   under_review  – the organizer submitted it (needs ≥4 eligible approved teams); staff decide
//   approved      – staff approved; registration continues until it closes or fills up
//   rejected      – staff rejected it (reason given); the organizer can edit and resubmit
//   ongoing       – fixtures generated and being played
//   completed     – a winner has been declared
//   cancelled     – called off by the organizer or staff
// "upcoming" is the pre-approval status of tournaments created before this
// workflow; they are treated as approved (legacy).
export const TOURNAMENT_STATUSES = ["open", "under_review", "approved", "rejected", "ongoing", "completed", "cancelled", "upcoming"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
export const TOURNAMENT_FORMATS = ["knockout", "league", "round_robin", "group_stage", "group_knockout"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export const MIN_TEAMS_FOR_REVIEW = 4;

export interface ITournament extends Document {
  _id: Types.ObjectId;
  name: string;
  slug?: string;
  sport: string;
  organizer: Types.ObjectId;
  teams: Types.ObjectId[]; // approved teams (cache of approved registrations)
  minTeams: number;
  maxTeams: number;
  format: TournamentFormat;
  groups: number; // group formats
  advancePerGroup: number; // group_knockout
  points: { win: number; draw: number; loss: number };
  status: TournamentStatus;
  legacy: boolean;
  winner: Types.ObjectId | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  startDate: Date;
  endDate: Date | null;
  entryFee: number; // NPR, informational until payments are live
  prizes?: string;
  rules?: string;
  poster?: string | null;
  description?: string;
  province: string;
  district?: string;
  location?: string;
  geo?: { type: "Point"; coordinates: [number, number] } | null;
  review: { by: Types.ObjectId | null; decision: "approved" | "rejected" | null; note?: string | null; at: Date | null };
  submittedAt: Date | null;
  cancelReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String },
    sport: { type: String, required: true, validate: sportValidator },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teams: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    minTeams: { type: Number, default: MIN_TEAMS_FOR_REVIEW, min: 2 },
    maxTeams: { type: Number, required: true },
    format: { type: String, enum: TOURNAMENT_FORMATS, default: "knockout" },
    groups: { type: Number, default: 2, min: 1, max: 16 },
    advancePerGroup: { type: Number, default: 2, min: 1, max: 8 },
    points: {
      win: { type: Number, default: 3 },
      draw: { type: Number, default: 1 },
      loss: { type: Number, default: 0 },
    },
    status: { type: String, enum: TOURNAMENT_STATUSES, default: "open" },
    legacy: { type: Boolean, default: false },
    winner: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    registrationOpensAt: { type: Date, default: null },
    registrationClosesAt: { type: Date, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    entryFee: { type: Number, default: 0, min: 0 },
    prizes: { type: String, trim: true, maxlength: 1000 },
    rules: { type: String, trim: true, maxlength: 5000 },
    poster: { type: String, default: null },
    description: { type: String },
    province: { type: String, required: true, enum: PROVINCES },
    district: { type: String, trim: true },
    location: { type: String, trim: true },
    geo: { type: pointSchema, default: undefined },
    review: {
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      decision: { type: String, enum: ["approved", "rejected", null], default: null },
      note: { type: String, default: null, maxlength: 1000 },
      at: { type: Date, default: null },
    },
    submittedAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

tournamentSchema.index({ status: 1, startDate: 1 });
tournamentSchema.index({ teams: 1 });
tournamentSchema.index({ organizer: 1, createdAt: -1 });
tournamentSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
tournamentSchema.index({ geo: "2dsphere" }, { sparse: true });

export const Tournament = model<ITournament>("Tournament", tournamentSchema);
