import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { PROVINCES } from "../utils/provinces";
import { DISTRICTS_BY_PROVINCE } from "../utils/locations";
import { EXPERIENCE_LEVELS, GENDERS } from "../models/User";
import * as notificationService from "../services/notificationService";
import { Sport } from "../models/Sport";
import { Team } from "../models/Team";
import { Ground } from "../models/Ground";
import { PUBLIC_GROUND } from "../services/groundsService";
import { Tournament } from "../models/Tournament";

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

// Live counts for the homepage. Cached for a minute so the homepage can't
// be used to hammer the database.
let statsCache: { at: number; body: Record<string, number> } | null = null;
router.get(
  "/stats",
  asyncHandler(async (_req: Request, res: Response) => {
    if (!statsCache || Date.now() - statsCache.at > 60_000) {
      const [sports, teams, grounds, tournaments] = await Promise.all([
        Sport.countDocuments({ active: { $ne: false } }),
        Team.countDocuments({ status: { $in: ["active", null] } }),
        Ground.countDocuments(PUBLIC_GROUND),
        Tournament.countDocuments({ status: { $nin: ["cancelled", "rejected"] } }),
      ]);
      statsCache = { at: Date.now(), body: { sports, teams, grounds, tournaments } };
    }
    res.set("Cache-Control", "public, max-age=60");
    res.json(statsCache.body);
  })
);

export default router;
