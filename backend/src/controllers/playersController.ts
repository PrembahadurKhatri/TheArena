import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { User } from "../models/User";
import { toPlayerSummary, toPlayerProfile } from "../utils/shapers";
import { param } from "../utils/params";
import { isObjectIdString, queryString, searchRegex } from "../utils/validation";
import { isValidSportSlug } from "../utils/sports";

export const listPlayers = asyncHandler(async (req: Request, res: Response) => {
  const sport = queryString(req.query.sport);
  const nameRegex = searchRegex(req.query.search);
  const query: any = {};
  if (sport && isValidSportSlug(sport)) query.sportPreferences = sport;
  if (nameRegex) query.name = nameRegex;

  const players = await User.find(query).sort({ createdAt: -1 }).limit(200);
  res.status(200).json({ players: players.map(toPlayerSummary) });
});

export const getPlayer = asyncHandler(async (req: Request, res: Response) => {
  const id = param(req, "id");
  if (!isObjectIdString(id)) throw new AppError(404, "Player not found");
  const player = await User.findById(id);
  if (!player) throw new AppError(404, "Player not found");

  // Email and phone are private: only the player themselves sees them.
  // Everyone else gets the public summary.
  const isSelf = !!req.user && req.user._id.toString() === player._id.toString();
  res.status(200).json({ player: isSelf ? toPlayerProfile(player) : toPlayerSummary(player) });
});
