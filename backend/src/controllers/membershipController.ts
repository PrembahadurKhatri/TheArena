import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { toMembershipSummary } from "../utils/shapers";
import * as membershipService from "../services/membershipService";

export const getMyMembership = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const result = await membershipService.getMyMembership(req.user);
  res.status(200).json({
    isPremium: result.isPremium,
    membershipExpiresAt: result.membershipExpiresAt,
    activeMembership: result.activeMembership ? toMembershipSummary(result.activeMembership) : null,
  });
});
