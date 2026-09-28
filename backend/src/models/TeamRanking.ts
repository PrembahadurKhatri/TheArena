import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";

export interface ITeamRanking extends Document {
  _id: Types.ObjectId;
  team: Types.ObjectId;
  sport: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
  updatedAt: Date;
}

const teamRankingSchema = new Schema<ITeamRanking>(
  {
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    sport: { type: String, required: true, enum: SPORT_SLUG_ENUM },
    points: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
  },
  { timestamps: true }
);

teamRankingSchema.index({ team: 1, sport: 1 }, { unique: true });

export const TeamRanking = model<ITeamRanking>("TeamRanking", teamRankingSchema);
