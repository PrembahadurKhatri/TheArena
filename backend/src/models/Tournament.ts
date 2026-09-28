import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";

export type TournamentStatus = "upcoming" | "ongoing" | "completed";

export interface ITournament extends Document {
  _id: Types.ObjectId;
  name: string;
  sport: string;
  organizer: Types.ObjectId;
  teams: Types.ObjectId[];
  maxTeams: number;
  status: TournamentStatus;
  winner: Types.ObjectId | null;
  startDate: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true, trim: true },
    sport: { type: String, required: true, enum: SPORT_SLUG_ENUM },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teams: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    maxTeams: { type: Number, required: true },
    status: { type: String, enum: ["upcoming", "ongoing", "completed"], default: "upcoming" },
    winner: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    startDate: { type: Date, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

export const Tournament = model<ITournament>("Tournament", tournamentSchema);
