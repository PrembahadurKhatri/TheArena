import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import { fileUrl } from "../utils/upload";
import { toTournamentSummary, toTournamentDetail, toMatchJSON, toTeamSummary, toRegistrationJSON } from "../utils/shapers";
import * as tournamentsService from "../services/tournamentsService";

/** The full tournament page payload. */
async function detail(idOrSlug: string, req: Request) {
  const d = await tournamentsService.getTournamentDetail(idOrSlug, req.user);
  const t = d.tournament as any;
  const teamsById = new Map((t.teams ?? []).map((x: any) => [x._id.toString(), x]));
  return {
    tournament: toTournamentDetail({ ...t.toObject(), teams: t.teams, winner: t.winner, matches: d.matches }),
    registrations: d.registrations.map((r) => toRegistrationJSON(r, d.isOrganizer)),
    eligibility: d.eligibility,
    standings: d.standings.map((g) => ({
      group: g.group,
      rows: g.rows.map((row) => ({ ...row, team: teamsById.has(row.team) ? toTeamSummary(teamsById.get(row.team)) : { id: row.team, name: "Team" } })),
    })),
    isOrganizer: d.isOrganizer,
    viewerTeams: d.viewerTeams,
  };
}

function body(req: Request) {
  const b = { ...(req.body ?? {}) };
  if (req.file) b.poster = fileUrl(req.file);
  else delete b.poster;
  // Multipart forms send nested points as JSON text.
  if (typeof b.points === "string") {
    try {
      b.points = JSON.parse(b.points);
    } catch {
      delete b.points;
    }
  }
  return b;
}

export const listTournaments = asyncHandler(async (req: Request, res: Response) => {
  const { tournaments, ...meta } = await tournamentsService.listTournaments(req.query, parsePage(req.query, { defaultLimit: 24 }));
  res.status(200).json({ tournaments: tournaments.map(toTournamentSummary), ...meta });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const rows = await tournamentsService.myTournaments(req.user);
  res.status(200).json({ tournaments: rows.map((r) => ({ ...toTournamentSummary(r.tournament), isOrganizer: r.organizer, registration: r.registration })) });
});

export const getTournament = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await detail(param(req, "id"), req));
});

export const createTournament = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const tournament = await tournamentsService.createTournament(req.user, body(req));
  res.status(201).json({ tournament: toTournamentSummary(tournament) });
});

export const updateTournament = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const t = await tournamentsService.updateTournament(param(req, "id"), req.user, body(req));
  res.status(200).json(await detail(t!._id.toString(), req));
});

export const requestRegistration = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  if (!req.body?.teamId) throw new AppError(400, "teamId is required");
  const reg = await tournamentsService.requestRegistration(param(req, "id"), req.user, req.body.teamId, req.body.note);
  res.status(201).json({ registration: toRegistrationJSON(reg) });
});

/** Legacy path kept for older clients. */
export const registerTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { teamId } = req.body;
  if (!teamId) throw new AppError(400, "teamId is required");
  const tournament = await tournamentsService.registerTeam(param(req, "id"), req.user, teamId);
  res.status(200).json({ tournament: toTournamentSummary(tournament) });
});

export const withdrawRegistration = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  res.status(200).json(await tournamentsService.withdrawRegistration(param(req, "rid"), req.user));
});

export const respondToRegistration = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  await tournamentsService.respondToRegistration(param(req, "id"), param(req, "rid"), req.user, req.body ?? {});
  res.status(200).json(await detail(param(req, "id"), req));
});

export const submitForReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  await tournamentsService.submitForReview(param(req, "id"), req.user);
  res.status(200).json(await detail(param(req, "id"), req));
});

export const startTournament = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { tournament, matches } = await tournamentsService.startTournament(param(req, "id"), req.user);
  res.status(200).json({ tournament: toTournamentSummary(tournament), matches: matches.map(toMatchJSON) });
});

export const cancelTournament = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const t = await tournamentsService.cancelTournament(param(req, "id"), req.user, req.body?.reason);
  res.status(200).json({ tournament: toTournamentSummary(t) });
});

export const completeMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { scoreA, scoreB, winnerTeamId, outcome } = req.body ?? {};
  await tournamentsService.completeMatch(param(req, "id"), param(req, "matchId"), req.user, { scoreA, scoreB, winnerTeamId, outcome });
  res.status(200).json(await detail(param(req, "id"), req));
});

export const scheduleMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const m = await tournamentsService.scheduleMatch(param(req, "id"), param(req, "matchId"), req.user, req.body ?? {});
  res.status(200).json({ match: toMatchJSON(m) });
});

export const getStandings = asyncHandler(async (req: Request, res: Response) => {
  const d = await detail(param(req, "id"), req);
  res.status(200).json({ standings: d.standings });
});
