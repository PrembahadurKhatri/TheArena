import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { User, EXPERIENCE_LEVELS } from "../models/User";
import { toPlayerSummary, toPlayerProfile } from "../utils/shapers";
import { param } from "../utils/params";
import { escapeRegex, isObjectIdString, queryString } from "../utils/validation";
import { isValidSportSlug } from "../utils/sports";
import { isValidProvince } from "../utils/provinces";
import { isValidDistrict, nearFilter } from "../utils/locations";
import { parsePage, pageMeta } from "../utils/pagination";
import { getEntitlements } from "../services/entitlementsService";

// Only active, discoverable players appear in the directory: never blocked
// accounts or staff.
const DISCOVERABLE = { role: "player", status: "active", "privacy.discoverable": { $ne: false } };

export const listPlayers = asyncHandler(async (req: Request, res: Response) => {
  const ent = getEntitlements(req.user);
  const query: any = { ...DISCOVERABLE };

  const sport = queryString(req.query.sport);
  if (sport && isValidSportSlug(sport)) query.sportPreferences = sport;

  const search = queryString(req.query.search);
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: "i" };
    query.$or = [{ name: rx }, { username: rx }];
  }

  // Location: the player must have chosen to show it for it to be searchable.
  const province = queryString(req.query.province);
  const district = queryString(req.query.district);
  if (province || district || req.query.lat !== undefined) query["privacy.showLocation"] = { $ne: false };
  if (province) {
    if (!isValidProvince(province)) throw new AppError(400, `Invalid province: ${province}`);
    query.province = province;
  }
  if (district) {
    if (!isValidDistrict(district)) throw new AppError(400, `Invalid district: ${district}`);
    query.district = district;
  }

  // Near me: free accounts search up to 10 km, Premium up to 100 km.
  const radius = Math.min(Number(queryString(req.query.radiusKm)) || 10, ent.maxSearchRadiusKm);
  const near = nearFilter(queryString(req.query.lat), queryString(req.query.lng), radius, ent.maxSearchRadiusKm);
  if (near) query.geo = near;

  // Advanced filters (Premium): experience level and playing position.
  const experience = queryString(req.query.experience);
  const position = queryString(req.query.position, 40);
  if (experience || position) {
    if (!ent.advancedMatchmaking) {
      throw new AppError(403, "Experience and position filters are a Premium feature");
    }
    if (experience && !(EXPERIENCE_LEVELS as readonly string[]).includes(experience)) {
      throw new AppError(400, `experience must be one of: ${EXPERIENCE_LEVELS.join(", ")}`);
    }
    const match: any = {};
    if (sport && isValidSportSlug(sport)) match.sport = sport;
    if (experience) match.experienceLevel = experience;
    if (position) match.position = { $regex: `^${escapeRegex(position)}$`, $options: "i" };
    query.sportProfiles = { $elemMatch: match };
  }

  // Exclude the viewer from their own search results.
  if (req.user) query._id = { $ne: req.user._id };

  const p = parsePage(req.query as Record<string, unknown>, { defaultLimit: 24, maxLimit: 100 });
  const [players, total] = await Promise.all([
    User.find(query).sort({ isPremium: -1, createdAt: -1 }).skip(p.skip).limit(p.limit),
    User.countDocuments(query),
  ]);
  res.status(200).json({ players: players.map(toPlayerSummary), radiusKm: near ? radius : null, ...pageMeta(p, total) });
});

/** By id or by username. Blocked and staff accounts aren't public profiles. */
export const getPlayer = asyncHandler(async (req: Request, res: Response) => {
  const key = param(req, "id");
  const player = isObjectIdString(key)
    ? await User.findById(key)
    : await User.findOne({ usernameKey: String(key).trim().toLowerCase() });
  const isSelf = !!player && !!req.user && req.user._id.equals(player._id);
  if (!player || (!isSelf && (player.status !== "active" || player.role !== "player"))) {
    throw new AppError(404, "Player not found");
  }
  res.status(200).json({ player: toPlayerProfile(player, isSelf) });
});
