import { Ground, IGround, IOpeningDay, DEFAULT_OPENING_HOURS } from "../models/Ground";
import { GroundBooking, HOLDING_STATUSES } from "../models/GroundBooking";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isActiveSportSlug } from "../utils/sports";
import { isValidProvince } from "../utils/provinces";
import { isValidDistrict, nearFilter, parseGeo, provinceOfDistrict } from "../utils/locations";
import { escapeRegex, isObjectIdString, optionalString, queryString, requireString } from "../utils/validation";
import { uniqueSlug } from "../utils/names";
import { Page, pageMeta } from "../utils/pagination";
import { BOOKING_HOLD_MINUTES, parseTimeToMinutes, slotStart, validateDate } from "./groundBookingsService";
import { notify } from "./notificationService";
import { audit } from "./auditService";

// Grounds created before approval existed have no status: treat as approved.
export const PUBLIC_GROUND = { status: { $in: ["approved", null] } };

export async function listGrounds(filters: Record<string, unknown>, p?: Page) {
  const query: any = { ...PUBLIC_GROUND };
  const sport = queryString(filters.sport);
  if (sport) query.$or = [{ sport }, { sports: sport }];
  const search = queryString(filters.search);
  if (search) query.name = { $regex: escapeRegex(search), $options: "i" };
  const province = queryString(filters.province);
  if (province) query.province = province;
  const district = queryString(filters.district);
  if (district) query.district = district;
  const min = Number(queryString(filters.minPrice));
  const max = Number(queryString(filters.maxPrice));
  if (Number.isFinite(min) && filters.minPrice !== undefined) query.pricePerHour = { ...(query.pricePerHour ?? {}), $gte: min };
  if (Number.isFinite(max) && filters.maxPrice !== undefined) query.pricePerHour = { ...(query.pricePerHour ?? {}), $lte: max };
  const near = nearFilter(queryString(filters.lat), queryString(filters.lng), queryString(filters.radiusKm), 100);
  if (near) query.geo = near;
  const sort: Record<string, 1 | -1> = filters.sort === "price_asc" ? { pricePerHour: 1 } : filters.sort === "price_desc" ? { pricePerHour: -1 } : { createdAt: -1 };
  if (!p) return { grounds: await Ground.find(query).sort(sort).limit(200), page: 1, limit: 200, total: 0, pages: 1 };
  const [grounds, total] = await Promise.all([Ground.find(query).sort(sort).skip(p.skip).limit(p.limit), Ground.countDocuments(query)]);
  return { grounds, ...pageMeta(p, total) };
}

/** Public lookup by id or slug: pending/rejected grounds are visible only to their owner. */
export async function getGroundById(idOrSlug: string, viewer?: IUser) {
  const g = isObjectIdString(idOrSlug) ? await Ground.findById(idOrSlug) : await Ground.findOne({ slug: String(idOrSlug).toLowerCase() });
  if (!g) throw new AppError(404, "Ground not found");
  const isPublic = !g.status || g.status === "approved";
  if (!isPublic && !(viewer && g.owner?.equals(viewer._id))) throw new AppError(404, "Ground not found");
  return g;
}

/** Opening hours for a calendar date (YYYY-MM-DD, Nepal). */
export function hoursOn(g: IGround, date: string): IOpeningDay {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return g.openingHours?.[weekday] ?? DEFAULT_OPENING_HOURS[weekday];
}

/** Rejects a slot outside the ground's opening hours that day. */
export function assertWithinHours(g: IGround, date: string, startTime: string, endTime: string) {
  const day = hoursOn(g, date);
  if (day.closed) throw new AppError(400, `${g.name} is closed that day`);
  if (parseTimeToMinutes(startTime) < parseTimeToMinutes(day.open) || parseTimeToMinutes(endTime) > parseTimeToMinutes(day.close)) {
    throw new AppError(400, `${g.name} is open ${day.open}–${day.close} that day`);
  }
}

const fmt = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Bookable slots for a date: from opening hours, minus bookings, holds and owner blocks. */
export async function slotsFor(idOrSlug: string, dateInput: unknown, viewer?: IUser) {
  const g = await getGroundById(idOrSlug, viewer);
  const date = validateDate(dateInput);
  const day = hoursOn(g, date);
  if (day.closed) return { date, open: null, close: null, slotMinutes: g.slotMinutes, slots: [] };
  const holdCutoff = new Date(Date.now() - BOOKING_HOLD_MINUTES() * 60 * 1000);
  const taken = await GroundBooking.find({
    ground: g._id,
    date,
    $or: [{ status: { $in: HOLDING_STATUSES } }, { status: "pending_payment", createdAt: { $gt: holdCutoff } }],
  }).select("startTime endTime status");
  const ranges = taken.map((b) => [parseTimeToMinutes(b.startTime), parseTimeToMinutes(b.endTime), b.status] as const);
  const slots = [];
  const step = g.slotMinutes || 60;
  for (let s = parseTimeToMinutes(day.open); s + step <= parseTimeToMinutes(day.close); s += step) {
    const e = s + step;
    const clash = ranges.find(([a, b]) => s < b && a < e);
    const past = slotStart(date, fmt(s)).getTime() < Date.now();
    slots.push({ startTime: fmt(s), endTime: fmt(e), available: !clash && !past, reason: past ? "past" : clash ? (clash[2] === "blocked" ? "blocked" : "booked") : null });
  }
  return { date, open: day.open, close: day.close, slotMinutes: step, pricePerHour: g.pricePerHour, slots };
}

// ---------------------------------------------------------------- owner listings

function parseHours(value: unknown): IOpeningDay[] {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      throw new AppError(400, "openingHours must be a list of 7 days");
    }
  }
  if (!Array.isArray(v) || v.length !== 7) throw new AppError(400, "openingHours must list all 7 days, Sunday first");
  return v.map((d: any, i) => {
    if (d?.closed === true || d?.closed === "true") return { closed: true, open: "00:00", close: "00:00" };
    const open = String(d?.open ?? "");
    const close = String(d?.close ?? "");
    if (parseTimeToMinutes(close) <= parseTimeToMinutes(open)) throw new AppError(400, `Day ${i}: closing time must be after opening time`);
    return { closed: false, open, close };
  });
}

function parseList(value: unknown, field: string, max: number): string[] {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      v = (v as string).split(",");
    }
  }
  if (!Array.isArray(v)) throw new AppError(400, `${field} must be a list`);
  return [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].slice(0, max);
}

function applyGroundInput(g: any, input: Record<string, any>, creating: boolean) {
  if (creating || input.name !== undefined) g.name = requireString(input.name, "name", { min: 3, max: 80 });
  if (creating || input.sports !== undefined || input.sport !== undefined) {
    const sports = input.sports !== undefined ? parseList(input.sports, "sports", 10) : [input.sport];
    if (!sports.length || !sports.every(isActiveSportSlug)) throw new AppError(400, "Choose at least one valid sport");
    g.sports = sports;
    g.sport = sports[0];
  }
  if (creating || input.location !== undefined) g.location = requireString(input.location, "location", { min: 2, max: 120 });
  if (creating || input.pricePerHour !== undefined) {
    const price = Number(input.pricePerHour);
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new AppError(400, "pricePerHour must be a number from 0 to 100000");
    g.pricePerHour = price;
  }
  if (input.description !== undefined) g.description = optionalString(input.description, "description", 2000);
  if (input.address !== undefined) g.address = optionalString(input.address, "address", 200);
  if (input.province !== undefined) {
    if (input.province && !isValidProvince(input.province)) throw new AppError(400, `Invalid province: ${input.province}`);
    g.province = input.province || undefined;
  }
  if (input.district !== undefined) {
    if (input.district && !isValidDistrict(input.district)) throw new AppError(400, `Invalid district: ${input.district}`);
    g.district = input.district || undefined;
    if (g.district) g.province = provinceOfDistrict(g.district) ?? g.province;
  }
  if (input.municipality !== undefined) g.municipality = optionalString(input.municipality, "municipality", 80);
  if (input.lat !== undefined || input.lng !== undefined) {
    const geo = parseGeo(input.lat, input.lng);
    if (geo !== undefined) g.geo = geo ?? undefined;
  }
  if (input.amenities !== undefined) g.amenities = parseList(input.amenities, "amenities", 20);
  if (input.openingHours !== undefined) g.openingHours = parseHours(input.openingHours);
  if (input.slotMinutes !== undefined) {
    const s = Number(input.slotMinutes);
    if (![30, 60, 90, 120].includes(s)) throw new AppError(400, "slotMinutes must be 30, 60, 90 or 120");
    g.slotMinutes = s;
  }
  if (input.contactPhone !== undefined) g.contactPhone = optionalString(input.contactPhone, "contactPhone", 30);
}

export async function createOwnedGround(owner: IUser, input: Record<string, any>, images: string[]) {
  const g: any = new Ground({ owner: owner._id, status: "pending" });
  applyGroundInput(g, input, true);
  g.slug = await uniqueSlug(Ground, g.name);
  g.images = images.slice(0, 8);
  g.image = g.images[0] ?? null;
  await g.save();
  return g;
}

export async function listMyGrounds(owner: IUser) {
  return Ground.find({ owner: owner._id }).sort({ createdAt: -1 });
}

export async function getOwnedGroundOrThrow(id: string, owner: IUser) {
  if (!isObjectIdString(id)) throw new AppError(404, "Ground not found");
  const g = await Ground.findById(id);
  if (!g || !g.owner?.equals(owner._id)) throw new AppError(404, "Ground not found");
  return g;
}

export async function updateOwnedGround(id: string, owner: IUser, input: Record<string, any>, images: string[]) {
  const g = await getOwnedGroundOrThrow(id, owner);
  if (g.status === "suspended") throw new AppError(403, "This ground is suspended; contact support");
  applyGroundInput(g, input, false);
  if (input.name !== undefined) g.slug = await uniqueSlug(Ground, g.name, g._id);
  if (images.length) {
    g.images = [...images, ...(g.images ?? [])].slice(0, 8);
    g.image = g.images[0];
  }
  // A rejected listing goes back into the review queue once fixed.
  if (g.status === "rejected") g.status = "pending";
  await g.save();
  return g;
}

// ---------------------------------------------------------------- staff

export async function adminListGrounds(query: Record<string, unknown>, p: Page) {
  const status = queryString(query.status) ?? "pending";
  const filter: any = status === "all" ? {} : status === "approved" ? PUBLIC_GROUND : { status };
  const search = queryString(query.search);
  if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
  const [items, total] = await Promise.all([
    Ground.find(filter).populate("owner", "name email phone").sort({ createdAt: 1 }).skip(p.skip).limit(p.limit),
    Ground.countDocuments(filter),
  ]);
  return { grounds: items, ...pageMeta(p, total) };
}

export async function adminReviewGround(actor: IUser, id: string, input: { decision?: unknown; note?: unknown }) {
  if (!isObjectIdString(id)) throw new AppError(404, "Ground not found");
  const g = await Ground.findById(id);
  if (!g) throw new AppError(404, "Ground not found");
  const decision = input.decision;
  if (!["approve", "reject", "suspend", "reinstate"].includes(String(decision))) throw new AppError(400, 'decision must be "approve", "reject", "suspend" or "reinstate"');
  const note = optionalString(input.note, "note", 1000) ?? null;
  if ((decision === "reject" || decision === "suspend") && !note) throw new AppError(400, "Give the owner a reason");
  if (decision === "approve" && g.status !== "pending") throw new AppError(400, "Only pending grounds can be approved");
  const status = decision === "approve" || decision === "reinstate" ? "approved" : decision === "reject" ? "rejected" : "suspended";
  const before = g.status;
  g.status = status;
  g.review = { by: actor._id, note, at: new Date() };
  await g.save();
  await audit({ actor: actor._id, actorRole: actor.role, action: `ground.${status}`, target: { type: "ground", id: g._id }, before: { status: before }, after: { status }, reason: note ?? undefined });
  if (g.owner) {
    await notify(g.owner, {
      type: "ground.review",
      title: status === "approved" ? `${g.name} is live on The Arena` : status === "rejected" ? `${g.name} wasn't approved` : `${g.name} has been suspended`,
      body: note ?? undefined,
      link: "/owner",
      entity: { type: "ground", id: g._id },
      actor: actor._id,
    });
  }
  return g;
}

/** Staff-managed grounds (no owner), e.g. public stadiums. */
export async function adminCreateGround(actor: IUser, input: Record<string, any>, images: string[]) {
  const g: any = new Ground({ owner: null, status: "approved" });
  applyGroundInput(g, input, true);
  g.slug = await uniqueSlug(Ground, g.name);
  g.images = images;
  g.image = images[0] ?? null;
  await g.save();
  await audit({ actor: actor._id, actorRole: actor.role, action: "ground.created_by_staff", target: { type: "ground", id: g._id }, after: { name: g.name } });
  return g;
}

export async function adminUpdateGround(actor: IUser, id: string, input: Record<string, any>) {
  if (!isObjectIdString(id)) throw new AppError(404, "Ground not found");
  const g = await Ground.findById(id);
  if (!g) throw new AppError(404, "Ground not found");
  applyGroundInput(g, input, false);
  await g.save();
  await audit({ actor: actor._id, actorRole: actor.role, action: "ground.updated_by_staff", target: { type: "ground", id: g._id }, after: input });
  return g;
}

