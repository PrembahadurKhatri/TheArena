import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toTournamentSummary, toTournamentDetail, toMatchJSON, toTeamSummary } from "../utils/shapers";
import * as tournamentsService from "../services/tournamentsService";

export const listTournaments = asyncHandler(async (req: Request, res: Response) => {
  const { sport, status, province } = req.query as { sport?: string; status?: string; province?: string };
  const tournaments = await tournamentsService.listTournaments({ sport, status, province });
  res.status(200).json({ tournaments: tournaments.map(toTournamentSummary) });
});

export const getTournament = asyncHandler(async (req: Request, res: Response) => {
  const { tournament, matches } = await tournamentsService.getTournamentWithMatches(param(req, "id"));
  const detail = toTournamentDetail({ ...(tournament as any).toObject(), matches });
  res.status(200).json({ tournament: detail });
});

export const createTournament = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { name, sport, maxTeams, startDate, description, province, location } = req.body;
  const tournament = await tournamentsService.createTournament(req.user, {
    name,
    sport,
    maxTeams,
    startDate,
    description,
    province,
    location,
  });
  res.status(201).json({ tournament: toTournamentSummary(tournament) });
});

export const registerTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { teamId } = req.body;
  if (!teamId) throw new AppError(400, "teamId is required");
  const tournament = await tournamentsService.registerTeam(param(req, "id"), req.user, teamId);
  res.status(200).json({ tournament: toTournamentSummary(tournament) });
});

export const startTournament = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { tournament, matches } = await tournamentsService.startTournament(param(req, "id"), req.user);
  res.status(200).json({
    tournament: toTournamentSummary(tournament),
    matches: matches.map(toMatchJSON),
  });
});

export const completeMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { scoreA, scoreB, winnerTeamId } = req.body;
  const { tournament, matches } = await tournamentsService.completeMatch(
    param(req, "id"),
    param(req, "matchId"),
    req.user,
    { scoreA, scoreB, winnerTeamId }
  );
  res.status(200).json({
    tournament: toTournamentSummary(tournament),
    matches: matches.map(toMatchJSON),
  });
});

export const getStandings = asyncHandler(async (req: Request, res: Response) => {
  const standings = await tournamentsService.getStandings(param(req, "id"));
  res.status(200).json({
    standings: standings.map((s) => ({
      team: toTeamSummary(s.team),
      wins: s.wins,
      losses: s.losses,
    })),
  });
});
