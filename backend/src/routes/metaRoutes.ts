import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { PROVINCES } from "../utils/provinces";
import { DISTRICTS_BY_PROVINCE } from "../utils/locations";
import { EXPERIENCE_LEVELS, GENDERS } from "../models/User";
import * as notificationService from "../services/notificationService";

// Public reference data the frontend needs for forms and filters.
const router = Router();

router.get("/locations", (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=86400");
  res.json({ provinces: PROVINCES.map((name) => ({ name, districts: DISTRICTS_BY_PROVINCE[name] })) });
});

router.get("/profile-options", (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=86400");
  res.json({ experienceLevels: EXPERIENCE_LEVELS, genders: GENDERS });
});

router.get(
  "/announcements",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ announcements: await notificationService.listAnnouncements() });
  })
);

export default router;
