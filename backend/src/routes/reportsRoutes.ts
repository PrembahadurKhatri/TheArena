import { Router, Request, Response } from "express";
import { actionLimiter } from "../middleware/security";
import { verifyToken } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import * as moderation from "../services/moderationService";

const router = Router();

router.post(
  "/",
  verifyToken,
  actionLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ report: await moderation.fileReport(req.user!, req.body ?? {}) });
  })
);

export default router;
