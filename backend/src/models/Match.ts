import { Schema, model, Document, Types } from "mongoose";

export type MatchStatus = "pending" | "completed";

export interface IMatch extends Document {
  _id: Types.ObjectId;
  tournament: Types.ObjectId;
  round: number;
  teamA: Types.ObjectId | null;
  teamB: Types.ObjectId | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: Types.ObjectId | null;
  status: MatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const matchSchema = new Schema<IMatch>(
  {
    tournament: { type: Schema.Types.ObjectId, ref: "Tournament", required: true },
    round: { type: Number, required: true },
    teamA: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    teamB: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    scoreA: { type: Number, default: null },
    scoreB: { type: Number, default: null },
    winner: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
  },
  { timestamps: true }
);

export const Match = model<IMatch>("Match", matchSchema);
