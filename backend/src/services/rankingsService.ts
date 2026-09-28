import { Types } from "mongoose";
import { Team } from "../models/Team";
import { PlayerRanking } from "../models/PlayerRanking";
import { TeamRanking } from "../models/TeamRanking";
import { toPlayerSummary, toTeamSummary } from "../utils/shapers";

const WIN_POINTS = 3;
const DRAW_POINTS = 1;
const LOSS_POINTS = 0;

type Outcome = "win" | "loss" | "draw";

async function bumpTeamRanking(teamId: Types.ObjectId, sport: string, outcome: Outcome) {
  const inc: Record<string, number> = {};
  if (outcome === "win") {
    inc.wins = 1;
    inc.points = WIN_POINTS;
  } else if (outcome === "loss") {
    inc.losses = 1;
    inc.points = LOSS_POINTS;
  } else {
    inc.draws = 1;
    inc.points = DRAW_POINTS;
  }

  await TeamRanking.findOneAndUpdate(
    { team: teamId, sport },
    { $inc: inc },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

async function bumpPlayerRanking(userId: Types.ObjectId, sport: string, outcome: Outcome) {
  const inc: Record<string, number> = {};
  if (outcome === "win") {
    inc.wins = 1;
    inc.points = WIN_POINTS;
  } else if (outcome === "loss") {
    inc.losses = 1;
    inc.points = LOSS_POINTS;
  } else {
    inc.draws = 1;
    inc.points = DRAW_POINTS;
  }

  await PlayerRanking.findOneAndUpdate(
    { user: userId, sport },
    { $inc: inc },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

// Called whenever a match is marked complete. Updates TeamRanking for both
// teams and PlayerRanking for every member of both teams, for that sport.
export async function recordMatchResult(params: {
  sport: string;
  teamAId: Types.ObjectId;
  teamBId: Types.ObjectId;
  winnerTeamId: Types.ObjectId | null; // null => draw
}) {
  const { sport, teamAId, teamBId, winnerTeamId } = params;

  const teamAOutcome: Outcome =
    winnerTeamId === null ? "draw" : winnerTeamId.toString() === teamAId.toString() ? "win" : "loss";
  const teamBOutcome: Outcome =
    winnerTeamId === null ? "draw" : winnerTeamId.toString() === teamBId.toString() ? "win" : "loss";

  await Promise.all([
    bumpTeamRanking(teamAId, sport, teamAOutcome),
    bumpTeamRanking(teamBId, sport, teamBOutcome),
  ]);

  const [teamA, teamB] = await Promise.all([Team.findById(teamAId), Team.findById(teamBId)]);

  const jobs: Promise<unknown>[] = [];
  if (teamA) {
    for (const memberId of teamA.members) {
      jobs.push(bumpPlayerRanking(memberId as Types.ObjectId, sport, teamAOutcome));
    }
  }
  if (teamB) {
    for (const memberId of teamB.members) {
      jobs.push(bumpPlayerRanking(memberId as Types.ObjectId, sport, teamBOutcome));
    }
  }
  await Promise.all(jobs);
}

export async function listPlayerRankings(sport: string) {
  const rankings = await PlayerRanking.find({ sport })
    .sort({ points: -1, wins: -1 })
    .populate("user", "name photo sportPreferences isPremium");

  return rankings
    .filter((r) => r.user)
    .map((r, idx) => ({
      rank: idx + 1,
      player: toPlayerSummary(r.user),
      points: r.points,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
    }));
}

export async function listTeamRankings(sport: string) {
  const rankings = await TeamRanking.find({ sport })
    .sort({ points: -1, wins: -1 })
    .populate({ path: "team", populate: { path: "owner", select: "name" } });

  return rankings
    .filter((r) => r.team)
    .map((r, idx) => ({
      rank: idx + 1,
      team: toTeamSummary(r.team),
      points: r.points,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
    }));
}
