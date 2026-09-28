import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { isValidSportSlug } from "../utils/sports";
import * as rankingsService from "../services/rankingsService";

export const getPlayerRankings = asyncHandler(async (req: Request, res: Response) => {
  const { sport } = req.query as { sport?: string };
  if (!sport || !isValidSportSlug(sport)) throw new AppError(400, "A valid sport is required");
  const rankings = await rankingsService.listPlayerRankings(sport);
  res.status(200).json({ rankings });
});

export const getTeamRankings = asyncHandler(async (req: Request, res: Response) => {
  const { sport } = req.query as { sport?: string };
  if (!sport || !isValidSportSlug(sport)) throw new AppError(400, "A valid sport is required");
  const rankings = await rankingsService.listTeamRankings(sport);
  res.status(200).json({ rankings });
});
