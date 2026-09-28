import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";

export interface IPlayerRanking extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  sport: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
  updatedAt: Date;
}

const playerRankingSchema = new Schema<IPlayerRanking>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sport: { type: String, required: true, enum: SPORT_SLUG_ENUM },
    points: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
  },
  { timestamps: true }
);

playerRankingSchema.index({ user: 1, sport: 1 }, { unique: true });

export const PlayerRanking = model<IPlayerRanking>("PlayerRanking", playerRankingSchema);
