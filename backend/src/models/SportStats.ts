import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";

// Official records per team and per player per sport, built only from
// verified match results (statsService.applyVerifiedResult). Never edited by
// hand and never written from client input.

interface RecordFields {
  sport: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  scoreFor: number;
  scoreAgainst: number;
  lastMatchAt: Date | null;
}

export interface ITeamSportStats extends Document, RecordFields {
  team: Types.ObjectId;
  tournamentsPlayed: number;
  tournamentsWon: number;
}

export interface IPlayerSportStats extends Document, RecordFields {
  user: Types.ObjectId;
  totals: Map<string, number>;
}

const recordFields = {
  sport: { type: String, required: true, validate: sportValidator },
  matches: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  scoreFor: { type: Number, default: 0 },
  scoreAgainst: { type: Number, default: 0 },
  lastMatchAt: { type: Date, default: null },
};

const teamStatsSchema = new Schema<ITeamSportStats>(
  {
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    ...recordFields,
    tournamentsPlayed: { type: Number, default: 0 },
    tournamentsWon: { type: Number, default: 0 },
  },
  { timestamps: true }
);
teamStatsSchema.index({ team: 1, sport: 1 }, { unique: true });

const playerStatsSchema = new Schema<IPlayerSportStats>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...recordFields,
    totals: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);
playerStatsSchema.index({ user: 1, sport: 1 }, { unique: true });

export const TeamSportStats = model<ITeamSportStats>("TeamSportStats", teamStatsSchema);
export const PlayerSportStats = model<IPlayerSportStats>("PlayerSportStats", playerStatsSchema);
