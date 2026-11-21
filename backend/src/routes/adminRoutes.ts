import { Router, Request, Response } from "express";
import { verifyToken, requireRole } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import * as adminService from "../services/adminService";

// Every route here is admin-only: verifyToken + requireRole run first for the
// whole router, so a new route can't be added without the check.
const router = Router();
router.use(verifyToken, requireRole("admin"));

router.get(
  "/users",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await adminService.listUsers(req.query, parsePage(req.query)));
  })
);

router.patch(
  "/users/:id/status",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.setUserStatus(param(req, "id"), req.user!, req.body ?? {});
    res.json({ user });
  })
);

router.patch(
  "/users/:id/role",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.setUserRole(param(req, "id"), req.user!, req.body ?? {});
    res.json({ user });
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await adminService.listAuditLogs(req.query, parsePage(req.query, { defaultLimit: 50, maxLimit: 200 })));
  })
);

export default router;
