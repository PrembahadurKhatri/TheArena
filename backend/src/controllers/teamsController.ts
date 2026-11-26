import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import { toTeamSummary, toTeamDetail } from "../utils/shapers";
import { fieldFile, fileUrl } from "../utils/upload";
import * as teamsService from "../services/teamsService";

const viewer = (req: Request) => (req.user ? req.user._id.toString() : null);

function teamInput(req: Request) {
  const { name, sport, description, province, district, municipality, lat, lng } = req.body ?? {};
  const logo = fieldFile(req, "logo") ?? req.file;
  const cover = fieldFile(req, "cover");
  return {
    name,
    sport,
    description,
    province,
    district,
    municipality,
    lat,
    lng,
    logo: logo ? fileUrl(logo) : undefined,
    coverImage: cover ? fileUrl(cover) : undefined,
  };
}

export const listTeams = asyncHandler(async (req: Request, res: Response) => {
  const { teams, ...meta } = await teamsService.listTeams(req.query, parsePage(req.query, { defaultLimit: 24 }));
  res.status(200).json({ teams: teams.map(toTeamSummary), ...meta });
});

export const listMyTeams = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const teams = await teamsService.listMyTeams(req.user._id.toString());
  const me = req.user._id.toString();
  res.status(200).json({
    teams: teams.map((t) => ({ ...toTeamSummary(t), role: teamsService.roleIn(t, me) })),
  });
});

export const nameAvailable = asyncHandler(async (req: Request, res: Response) => {
  const name = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  const except = Array.isArray(req.query.except) ? req.query.except[0] : req.query.except;
  res.status(200).json(await teamsService.nameAvailable(name, typeof except === "string" ? except : undefined));
});

export const getTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamsService.getTeamById(param(req, "id"));
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const createTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.createTeam(req.user, teamInput(req));
  res.status(201).json({ team: toTeamDetail(team, viewer(req)) });
});

export const updateTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.updateTeam(param(req, "id"), req.user, teamInput(req));
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const deleteTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  res.status(200).json(await teamsService.deleteTeam(param(req, "id"), req.user));
});

export const requestToJoin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.requestToJoin(param(req, "id"), req.user);
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const withdrawJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.withdrawJoinRequest(param(req, "id"), req.user);
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const respondToJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.respondToJoinRequest(param(req, "id"), param(req, "userId"), req.body?.action, req.user);
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const invite = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.invitePlayer(param(req, "id"), req.user, req.body ?? {});
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const cancelInvitation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.cancelInvitation(param(req, "id"), req.user, param(req, "userId"));
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const respondToInvitation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.respondToInvitation(param(req, "id"), req.user, req.body?.action);
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const listMyInvitations = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const rows = await teamsService.listMyInvitations(req.user);
  res.status(200).json({
    invitations: rows.map((r) => ({ team: toTeamSummary(r.team), invitedBy: r.invitedBy, invitedAt: r.invitedAt })),
  });
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.removeMember(param(req, "id"), param(req, "userId"), req.user);
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const leave = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  res.status(200).json(await teamsService.leaveTeam(param(req, "id"), req.user));
});

export const setRole = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.setMemberRole(param(req, "id"), param(req, "userId"), req.user, req.body?.role);
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});

export const transferOwnership = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.transferOwnership(param(req, "id"), req.user, req.body?.userId);
  res.status(200).json({ team: toTeamDetail(team, viewer(req)) });
});
