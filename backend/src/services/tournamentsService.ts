import { Types } from "mongoose";
import { Tournament, ITournament } from "../models/Tournament";
import { Match, IMatch } from "../models/Match";
import { Team } from "../models/Team";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidSportSlug } from "../utils/sports";
import { isValidProvince } from "../utils/provinces";
import { recordMatchResult } from "./rankingsService";

const TEAM_SUMMARY_POPULATE = { path: "owner", select: "name" };

const DETAIL_POPULATE = [
  { path: "organizer", select: "name" },
  { path: "teams", populate: TEAM_SUMMARY_POPULATE },
];

export async function listTournaments(filters: { sport?: string; status?: string; province?: string }) {
  const query: any = {};
  if (filters.sport) query.sport = filters.sport;
  if (filters.status) query.status = filters.status;
  if (filters.province) query.province = filters.province;

  return Tournament.find(query).populate("organizer", "name").sort({ startDate: 1 });
}

export async function getTournamentWithMatches(id: string) {
  const tournament = await Tournament.findById(id).populate(DETAIL_POPULATE);
  if (!tournament) throw new AppError(404, "Tournament not found");

  const matches = await Match.find({ tournament: tournament._id })
    .sort({ round: 1, createdAt: 1 })
    .populate("teamA teamB winner", "name logo");

  return { tournament, matches };
}

export async function createTournament(
  organizer: IUser,
  input: {
    name: string;
    sport: string;
    maxTeams: number;
    startDate: string;
    description?: string;
    province: string;
    location?: string;
  }
) {
  const { name, sport, maxTeams, startDate, description, province, location } = input;
  if (!name || !sport || !maxTeams || !startDate || !province) {
    throw new AppError(400, "name, sport, maxTeams, startDate and province are required");
  }
  if (!isValidSportSlug(sport)) throw new AppError(400, `Invalid sport slug: ${sport}`);
  if (!isValidProvince(province)) throw new AppError(400, `Invalid province: ${province}`);
  if (Number(maxTeams) < 2) throw new AppError(400, "maxTeams must be at least 2");

  const tournament = await Tournament.create({
    name,
    sport,
    organizer: organizer._id,
    maxTeams: Number(maxTeams),
    startDate: new Date(startDate),
    description,
    province,
    location,
    teams: [],
    status: "upcoming",
  });

  return Tournament.findById(tournament._id).populate(DETAIL_POPULATE);
}

export async function registerTeam(tournamentId: string, user: IUser, teamId: string) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new AppError(404, "Tournament not found");

  if (tournament.status !== "upcoming") {
    throw new AppError(400, "Tournament has already started");
  }
  if (tournament.teams.length >= tournament.maxTeams) {
    throw new AppError(400, "Tournament is already full");
  }

  const team = await Team.findById(teamId);
  if (!team) throw new AppError(404, "Team not found");
  if (team.owner.toString() !== user._id.toString()) {
    throw new AppError(403, "Only the team owner can register it for a tournament");
  }
  if (team.sport !== tournament.sport) {
    throw new AppError(400, "Team sport does not match tournament sport");
  }
  if (tournament.teams.some((t) => t.toString() === teamId)) {
    throw new AppError(400, "Team is already registered for this tournament");
  }

  tournament.teams.push(team._id);
  await tournament.save();

  return Tournament.findById(tournament._id).populate(DETAIL_POPULATE);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function createRoundMatches(tournamentId: Types.ObjectId, round: number, teamIds: Types.ObjectId[]) {
  const created: IMatch[] = [];
  for (let i = 0; i < teamIds.length; i += 2) {
    const teamA = teamIds[i];
    const teamB = teamIds[i + 1];

    if (!teamB) {
      // Odd team out gets a bye and auto-advances.
      const bye = await Match.create({
        tournament: tournamentId,
        round,
        teamA,
        teamB: null,
        scoreA: null,
        scoreB: null,
        winner: teamA,
        status: "completed",
      });
      created.push(bye);
    } else {
      const m = await Match.create({
        tournament: tournamentId,
        round,
        teamA,
        teamB,
        status: "pending",
      });
      created.push(m);
    }
  }
  return created;
}

// If every match in `round` is complete, generates the next round from the
// winners (or finalizes the tournament if only one winner remains). Recurses
// in case the newly-created round is immediately fully resolved (all byes).
async function maybeAdvanceRound(tournament: ITournament, round: number): Promise<void> {
  const roundMatches = await Match.find({ tournament: tournament._id, round }).sort({ createdAt: 1 });
  if (roundMatches.length === 0) return;
  if (roundMatches.some((m) => m.status !== "completed")) return;

  const winners = roundMatches
    .map((m) => m.winner)
    .filter((w): w is Types.ObjectId => !!w);

  if (winners.length <= 1) {
    const champion = winners[0] ?? null;
    tournament.status = "completed";
    tournament.winner = champion;
    await tournament.save();
    return;
  }

  await createRoundMatches(tournament._id, round + 1, winners);
  await maybeAdvanceRound(tournament, round + 1);
}

export async function startTournament(tournamentId: string, user: IUser) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new AppError(404, "Tournament not found");
  if (tournament.organizer.toString() !== user._id.toString()) {
    throw new AppError(403, "Only the tournament organizer can start it");
  }
  if (tournament.status !== "upcoming") {
    throw new AppError(400, "Tournament has already started");
  }
  if (tournament.teams.length < 2) {
    throw new AppError(400, "At least 2 teams must be registered to start the tournament");
  }

  const shuffled = shuffle(tournament.teams);
  tournament.status = "ongoing";
  await tournament.save();

  await createRoundMatches(tournament._id, 1, shuffled);
  await maybeAdvanceRound(tournament, 1);

  const matches = await Match.find({ tournament: tournament._id })
    .sort({ round: 1, createdAt: 1 })
    .populate("teamA teamB winner", "name logo");

  const fresh = await Tournament.findById(tournament._id).populate(DETAIL_POPULATE);
  return { tournament: fresh, matches };
}

export async function completeMatch(
  tournamentId: string,
  matchId: string,
  user: IUser,
  input: { scoreA: number; scoreB: number; winnerTeamId: string }
) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new AppError(404, "Tournament not found");
  if (tournament.organizer.toString() !== user._id.toString()) {
    throw new AppError(403, "Only the tournament organizer can update matches");
  }

  const match = await Match.findOne({ _id: matchId, tournament: tournament._id });
  if (!match) throw new AppError(404, "Match not found");
  if (match.status === "completed") throw new AppError(400, "Match is already completed");
  if (!match.teamA || !match.teamB) {
    throw new AppError(400, "This match has no opponent (bye) and cannot be scored");
  }

  const { scoreA, scoreB, winnerTeamId } = input;
  if (scoreA === undefined || scoreB === undefined || !winnerTeamId) {
    throw new AppError(400, "scoreA, scoreB and winnerTeamId are required");
  }
  if (![match.teamA.toString(), match.teamB.toString()].includes(winnerTeamId)) {
    throw new AppError(400, "winnerTeamId must be one of the two teams in this match");
  }

  match.scoreA = Number(scoreA);
  match.scoreB = Number(scoreB);
  match.winner = new Types.ObjectId(winnerTeamId);
  match.status = "completed";
  await match.save();

  await recordMatchResult({
    sport: tournament.sport,
    teamAId: match.teamA,
    teamBId: match.teamB,
    winnerTeamId: match.winner,
  });

  await maybeAdvanceRound(tournament, match.round);

  const matches = await Match.find({ tournament: tournament._id })
    .sort({ round: 1, createdAt: 1 })
    .populate("teamA teamB winner", "name logo");

  const fresh = await Tournament.findById(tournament._id).populate(DETAIL_POPULATE);
  return { tournament: fresh, matches };
}

export async function getStandings(tournamentId: string) {
  const tournament = await Tournament.findById(tournamentId).populate({
    path: "teams",
    populate: TEAM_SUMMARY_POPULATE,
  });
  if (!tournament) throw new AppError(404, "Tournament not found");

  const matches = await Match.find({ tournament: tournament._id, status: "completed" });

  const record = new Map<string, { wins: number; losses: number }>();
  for (const team of tournament.teams as any[]) {
    record.set(team._id.toString(), { wins: 0, losses: 0 });
  }

  for (const m of matches) {
    if (!m.teamA || !m.teamB || !m.winner) continue;
    const winnerId = m.winner.toString();
    const teamAId = m.teamA.toString();
    const teamBId = m.teamB.toString();
    const loserId = winnerId === teamAId ? teamBId : teamAId;

    if (record.has(winnerId)) record.get(winnerId)!.wins += 1;
    if (record.has(loserId)) record.get(loserId)!.losses += 1;
  }

  return (tournament.teams as any[]).map((team) => ({
    team,
    wins: record.get(team._id.toString())?.wins ?? 0,
    losses: record.get(team._id.toString())?.losses ?? 0,
  }));
}
