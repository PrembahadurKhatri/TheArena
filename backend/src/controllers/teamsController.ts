import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toTeamSummary, toTeamDetail } from "../utils/shapers";
import { fileToUrlPath } from "../utils/upload";
import * as teamsService from "../services/teamsService";

export const listTeams = asyncHandler(async (req: Request, res: Response) => {
  const { sport, search } = req.query as { sport?: string; search?: string };
  const teams = await teamsService.listTeams({ sport, search });
  res.status(200).json({ teams: teams.map(toTeamSummary) });
});

export const listMyTeams = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const teams = await teamsService.listMyTeams(req.user._id.toString());
  res.status(200).json({ teams: teams.map(toTeamSummary) });
});

export const getTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamsService.getTeamById(param(req, "id"));
  const isOwner = !!req.user && team.owner._id?.toString() === req.user._id.toString();
  res.status(200).json({ team: toTeamDetail(team, isOwner) });
});

export const createTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { name, sport } = req.body;
  const logo = req.file ? fileToUrlPath(req.file.filename) : undefined;
  const team = await teamsService.createTeam(req.user, { name, sport, logo });
  res.status(201).json({ team: toTeamDetail(team, true) });
});

export const updateTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { name, sport } = req.body;
  const logo = req.file ? fileToUrlPath(req.file.filename) : undefined;
  const team = await teamsService.updateTeam(param(req, "id"), req.user, { name, sport, logo });
  res.status(200).json({ team: toTeamDetail(team, true) });
});

export const deleteTeam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const result = await teamsService.deleteTeam(param(req, "id"), req.user);
  res.status(200).json(result);
});

export const requestToJoin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.requestToJoin(param(req, "id"), req.user);
  res.status(200).json({ team: toTeamDetail(team, false) });
});

export const respondToJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { action } = req.body;
  const team = await teamsService.respondToJoinRequest(param(req, "id"), param(req, "userId"), action, req.user);
  res.status(200).json({ team: toTeamDetail(team, true) });
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const team = await teamsService.removeMember(param(req, "id"), param(req, "userId"), req.user);
  res.status(200).json({ team: toTeamDetail(team, true) });
});
