import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as sportsService from "../services/sportsService";

export const listSports = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ sports: await sportsService.listSports() });
});
