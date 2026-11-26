import { Router, Request, Response } from "express";
import { verifyToken } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import * as notificationService from "../services/notificationService";

const router = Router();
router.use(verifyToken);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await notificationService.listMine(req.user!, req.query, parsePage(req.query, { defaultLimit: 20, maxLimit: 50 })));
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await notificationService.unreadCount(req.user!));
  })
);

router.post(
  "/read-all",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await notificationService.markAllRead(req.user!));
  })
);

router.post(
  "/:id/read",
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ notification: await notificationService.markRead(req.user!, param(req, "id")) });
  })
);

export default router;
