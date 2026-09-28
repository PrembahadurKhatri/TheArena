import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { User } from "../models/User";
import { toPlayerSummary, toPlayerProfile } from "../utils/shapers";

export const listPlayers = asyncHandler(async (req: Request, res: Response) => {
  const { sport, search } = req.query as { sport?: string; search?: string };
  const query: any = {};
  if (sport) query.sportPreferences = sport;
  if (search) query.name = { $regex: search, $options: "i" };

  const players = await User.find(query).sort({ createdAt: -1 });
  res.status(200).json({ players: players.map(toPlayerSummary) });
});

export const getPlayer = asyncHandler(async (req: Request, res: Response) => {
  const player = await User.findById(req.params.id);
  if (!player) throw new AppError(404, "Player not found");
  res.status(200).json({ player: toPlayerProfile(player) });
});
