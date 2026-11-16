import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toChallengeJSON } from "../utils/shapers";
import * as challengesService from "../services/challengesService";

export const listOpen = asyncHandler(async (req: Request, res: Response) => {
  const { sport, mode, province } = req.query as { sport?: string; mode?: string; province?: string };
  const challenges = await challengesService.listOpenChallenges({ sport, mode, province });
  res.status(200).json({ challenges: challenges.map(toChallengeJSON) });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const challenges = await challengesService.listMyChallenges(req.user);
  res.status(200).json({ challenges: challenges.map(toChallengeJSON) });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const challenge = await challengesService.getChallengeById(param(req, "id"));
  res.status(200).json({ challenge: toChallengeJSON(challenge) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const challenge = await challengesService.createChallenge(req.user, req.body ?? {});
  res.status(201).json({ challenge: toChallengeJSON(challenge) });
});

export const accept = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const challenge = await challengesService.acceptChallenge(req.user, param(req, "id"), req.body ?? {});
  res.status(200).json({ challenge: toChallengeJSON(challenge) });
});

export const decline = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const challenge = await challengesService.declineChallenge(req.user, param(req, "id"));
  res.status(200).json({ challenge: toChallengeJSON(challenge) });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const challenge = await challengesService.cancelChallenge(req.user, param(req, "id"));
  res.status(200).json({ challenge: toChallengeJSON(challenge) });
});

export const groundAvailability = asyncHandler(async (req: Request, res: Response) => {
  const availability = await challengesService.getGroundAvailability(param(req, "id"), req.query.date);
  res.status(200).json(availability);
});
