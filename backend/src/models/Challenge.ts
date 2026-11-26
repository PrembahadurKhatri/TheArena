import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";

// A match challenge: one side proposes a time (and optionally a ground);
// either anyone can take it ("open") or it is sent to one player or team
// ("pending") who accepts, declines or proposes another time/place
// ("countered", which hands the decision back to the other side).
//
// Accepting creates a Match. A ground named on a challenge is a suggestion:
// the slot is only held once someone books it (see bookGround).
export type ChallengeMode = "team" | "player";
export type ChallengeStatus = "open" | "pending" | "countered" | "accepted" | "declined" | "cancelled" | "completed" | "expired";
export const CHALLENGE_STATUSES: ChallengeStatus[] = ["open", "pending", "countered", "accepted", "declined", "cancelled", "completed", "expired"];
export const MATCH_FORMATS = ["friendly", "competitive"] as const;
export const MAX_COUNTERS = 5;

export interface ICounterProposal {
  by: Types.ObjectId;
  side: "challenger" | "opponent";
  date: string;
  startTime: string;
  endTime: string;
  ground: Types.ObjectId | null;
  venueNote?: string;
  message?: string;
  createdAt: Date;
}

export interface IChallenge extends Document {
  _id: Types.ObjectId;
  sport: string;
  mode: ChallengeMode;
  challenger: Types.ObjectId;
  challengerTeam: Types.ObjectId | null;
  opponentUser: Types.ObjectId | null;
  opponentTeam: Types.ObjectId | null;
  date: string;
  startTime: string;
  endTime: string;
  ground: Types.ObjectId | null;
  province?: string;
  venueNote?: string;
  message?: string;
  status: ChallengeStatus;
  format: (typeof MATCH_FORMATS)[number];
  // Who must answer next while pending/countered.
  awaiting: "challenger" | "opponent" | null;
  counterProposals: ICounterProposal[];
  match: Types.ObjectId | null;
  booking: Types.ObjectId | null;
  acceptedBy: Types.ObjectId | null;
  acceptedTeam: Types.ObjectId | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const challengeSchema = new Schema<IChallenge>(
  {
    sport: { type: String, required: true, validate: sportValidator },
    mode: { type: String, required: true, enum: ["team", "player"] },
    challenger: { type: Schema.Types.ObjectId, ref: "User", required: true },
    challengerTeam: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    opponentUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    opponentTeam: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    ground: { type: Schema.Types.ObjectId, ref: "Ground", default: null },
    province: { type: String, enum: PROVINCES },
    venueNote: { type: String, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: CHALLENGE_STATUSES,
      default: "open",
    },
    format: { type: String, enum: MATCH_FORMATS, default: "friendly" },
    awaiting: { type: String, enum: ["challenger", "opponent", null], default: null },
    counterProposals: [
      {
        _id: false,
        by: { type: Schema.Types.ObjectId, ref: "User", required: true },
        side: { type: String, enum: ["challenger", "opponent"], required: true },
        date: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        ground: { type: Schema.Types.ObjectId, ref: "Ground", default: null },
        venueNote: { type: String, trim: true, maxlength: 200 },
        message: { type: String, trim: true, maxlength: 500 },
        createdAt: { type: Date, default: () => new Date() },
      },
    ],
    match: { type: Schema.Types.ObjectId, ref: "Match", default: null },
    booking: { type: Schema.Types.ObjectId, ref: "GroundBooking", default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acceptedTeam: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

challengeSchema.index({ status: 1, sport: 1, date: 1 });
challengeSchema.index({ challenger: 1, createdAt: -1 });
challengeSchema.index({ opponentUser: 1, status: 1 });
challengeSchema.index({ opponentTeam: 1, status: 1 });
challengeSchema.index({ acceptedBy: 1, status: 1 });
challengeSchema.index({ ground: 1, date: 1, status: 1 });

export const Challenge = model<IChallenge>("Challenge", challengeSchema);
