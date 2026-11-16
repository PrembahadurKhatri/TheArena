import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";

// A match challenge: one side proposes a time (and optionally a ground);
// either anyone can take it ("open") or it is sent to one player or team
// ("pending") who accepts or declines.
export type ChallengeMode = "team" | "player";
export type ChallengeStatus = "open" | "pending" | "accepted" | "declined" | "cancelled";

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
  acceptedBy: Types.ObjectId | null;
  acceptedTeam: Types.ObjectId | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const challengeSchema = new Schema<IChallenge>(
  {
    sport: { type: String, required: true, enum: SPORT_SLUG_ENUM },
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
      enum: ["open", "pending", "accepted", "declined", "cancelled"],
      default: "open",
    },
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
