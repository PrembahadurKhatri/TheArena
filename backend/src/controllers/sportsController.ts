import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Sport } from "../models/Sport";

export const listSports = asyncHandler(async (_req: Request, res: Response) => {
  const sports = await Sport.find().sort({ order: 1 });
  res.status(200).json({
    sports: sports.map((s) => ({ slug: s.slug, name: s.name, order: s.order })),
  });
});
