import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";

// A fixture between two teams (or two players). Created by a tournament's
// fixture generator or by an accepted challenge.
//
// Status:
//   pending   – scheduled; waiting to be played / for a result
//   reported  – one side submitted a result; waiting for the other side
//   disputed  – the other side disputed it; staff resolve it
//   completed – result verified (final). Brackets and records use only these.
//   cancelled – called off
export type MatchStatus = "pending" | "reported" | "disputed" | "completed" | "cancelled";
export type MatchSource = "tournament" | "challenge";

export interface IMatch extends Document {
  _id: Types.ObjectId;
  source: MatchSource;
  tournament: Types.ObjectId | null;
  challenge: Types.ObjectId | null;
  sport?: string;
  mode: "team" | "player";
  // Tournament placement
  round: number;
  stage: "knockout" | "league" | "group";
  group: string | null;
  matchNumber: number | null;
  nextMatch: Types.ObjectId | null;
  nextSlot: "A" | "B" | null;
  // Sides
  teamA: Types.ObjectId | null;
  teamB: Types.ObjectId | null;
  userA: Types.ObjectId | null;
  userB: Types.ObjectId | null;
  // When and where
  date: string | null; // YYYY-MM-DD (Nepal time)
  startTime: string | null; // HH:MM
  endTime: string | null;
  ground: Types.ObjectId | null;
  booking: Types.ObjectId | null;
  venueNote?: string;
  // Result (final once status = completed)
  scoreA: number | null;
  scoreB: number | null;
  winner: Types.ObjectId | null; // winning team (team mode)
  winnerUser: Types.ObjectId | null; // winning player (player mode)
  isDraw: boolean;
  verifiedAt: Date | null;
  status: MatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const matchSchema = new Schema<IMatch>(
  {
    source: { type: String, enum: ["tournament", "challenge"], default: "tournament" },
    tournament: { type: Schema.Types.ObjectId, ref: "Tournament", default: null },
    challenge: { type: Schema.Types.ObjectId, ref: "Challenge", default: null },
    sport: { type: String, validate: sportValidator },
    mode: { type: String, enum: ["team", "player"], default: "team" },
    round: { type: Number, default: 1 },
    stage: { type: String, enum: ["knockout", "league", "group"], default: "knockout" },
    group: { type: String, default: null },
    matchNumber: { type: Number, default: null },
    nextMatch: { type: Schema.Types.ObjectId, ref: "Match", default: null },
    nextSlot: { type: String, enum: ["A", "B", null], default: null },
    teamA: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    teamB: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    userA: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userB: { type: Schema.Types.ObjectId, ref: "User", default: null },
    date: { type: String, default: null },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    ground: { type: Schema.Types.ObjectId, ref: "Ground", default: null },
    booking: { type: Schema.Types.ObjectId, ref: "GroundBooking", default: null },
    venueNote: { type: String, trim: true, maxlength: 200 },
    scoreA: { type: Number, default: null },
    scoreB: { type: Number, default: null },
    winner: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    winnerUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDraw: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    status: { type: String, enum: ["pending", "reported", "disputed", "completed", "cancelled"], default: "pending" },
  },
  { timestamps: true }
);

matchSchema.index({ tournament: 1, round: 1, createdAt: 1 });
matchSchema.index({ challenge: 1 }, { unique: true, partialFilterExpression: { challenge: { $type: "objectId" } } });
matchSchema.index({ teamA: 1, status: 1 });
matchSchema.index({ teamB: 1, status: 1 });
matchSchema.index({ userA: 1, status: 1 });
matchSchema.index({ userB: 1, status: 1 });
matchSchema.index({ status: 1, date: 1 });
matchSchema.index({ sport: 1, status: 1, date: -1 });

export const Match = model<IMatch>("Match", matchSchema);
