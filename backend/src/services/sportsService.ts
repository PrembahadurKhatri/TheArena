import { Sport } from "../models/Sport";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { SPORT_SLUG_RE, registerSport } from "../utils/sports";
import { optionalString, requireString } from "../utils/validation";
import { audit } from "./auditService";

export function toSportJSON(s: any) {
  return {
    slug: s.slug,
    name: s.name,
    order: s.order,
    active: s.active !== false,
    minPlayers: s.minPlayers ?? 1,
    maxPlayers: s.maxPlayers ?? 30,
    positions: s.positions ?? [],
    image: s.image ?? null,
  };
}

export async function listSports(includeInactive = false) {
  const sports = await Sport.find(includeInactive ? {} : { active: { $ne: false } }).sort({ order: 1, name: 1 }).lean();
  return sports.map(toSportJSON);
}

function parsePlayers(input: Record<string, unknown>, current?: { minPlayers: number; maxPlayers: number }) {
  const min = input.minPlayers !== undefined ? Number(input.minPlayers) : current?.minPlayers ?? 1;
  const max = input.maxPlayers !== undefined ? Number(input.maxPlayers) : current?.maxPlayers ?? 30;
  if (!Number.isInteger(min) || min < 1 || min > 50) throw new AppError(400, "minPlayers must be a whole number from 1 to 50");
  if (!Number.isInteger(max) || max < min || max > 100) throw new AppError(400, "maxPlayers must be a whole number from minPlayers to 100");
  return { minPlayers: min, maxPlayers: max };
}

function parsePositions(value: unknown): string[] {
  if (!Array.isArray(value)) throw new AppError(400, "positions must be an array of names");
  if (value.length > 30) throw new AppError(400, "At most 30 positions");
  return [...new Set(value.map((p) => requireString(p, "position", { max: 40 })))];
}

export async function createSport(actor: IUser, input: Record<string, unknown>) {
  const slug = requireString(input.slug, "slug", { min: 2, max: 40 }).toLowerCase();
  if (!SPORT_SLUG_RE.test(slug)) throw new AppError(400, "slug must use lowercase letters, digits and hyphens, starting with a letter");
  if (await Sport.exists({ slug })) throw new AppError(409, "A sport with this slug already exists");
  const name = requireString(input.name, "name", { min: 2, max: 40 });
  const players = parsePlayers(input);
  const positions = input.positions !== undefined ? parsePositions(input.positions) : [];
  const order = input.order !== undefined ? Number(input.order) || 0 : (await Sport.countDocuments()) + 1;
  const sport = await Sport.create({ slug, name, order, active: input.active !== false, ...players, positions, image: optionalString(input.image, "image", 300) ?? null });
  registerSport(sport.slug, sport.active);
  await audit({ actor: actor._id, actorRole: actor.role, action: "sport.created", target: { type: "sport", id: sport._id }, after: toSportJSON(sport) });
  return toSportJSON(sport);
}

export async function updateSport(actor: IUser, slug: string, input: Record<string, unknown>) {
  const sport = await Sport.findOne({ slug });
  if (!sport) throw new AppError(404, "Sport not found");
  if (input.slug !== undefined && input.slug !== sport.slug) throw new AppError(400, "A sport's slug can't change (existing teams and matches use it)");
  const before = toSportJSON(sport);
  if (input.name !== undefined) sport.name = requireString(input.name, "name", { min: 2, max: 40 });
  if (input.order !== undefined) sport.order = Number(input.order) || 0;
  if (input.active !== undefined) sport.active = input.active === true || input.active === "true";
  if (input.minPlayers !== undefined || input.maxPlayers !== undefined) Object.assign(sport, parsePlayers(input, sport));
  if (input.positions !== undefined) sport.positions = parsePositions(input.positions);
  if (input.image !== undefined) sport.image = optionalString(input.image, "image", 300) ?? null;
  await sport.save();
  registerSport(sport.slug, sport.active);
  await audit({ actor: actor._id, actorRole: actor.role, action: "sport.updated", target: { type: "sport", id: sport._id }, before, after: toSportJSON(sport) });
  return toSportJSON(sport);
}
