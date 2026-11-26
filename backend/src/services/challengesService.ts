import { Challenge, IChallenge, MATCH_FORMATS } from "../models/Challenge";
import { getSetting } from "./settingsService";
const MAX_COUNTERS = () => getSetting("maxChallengeCounters");
import { Team, ITeam } from "../models/Team";
import { User, IUser } from "../models/User";
import { Ground } from "../models/Ground";
import { GroundBooking } from "../models/GroundBooking";
import { Match } from "../models/Match";
import { AppError } from "../utils/AppError";
import { isValidProvince } from "../utils/provinces";
import { isActiveSportSlug } from "../utils/sports";
import { isObjectIdString, optionalString } from "../utils/validation";
import {
  BOOKING_HOLD_MINUTES,
  MAX_DAYS_AHEAD,
  createBooking,
  findBookingConflict,
  parseTimeToMinutes,
  slotStart,
  validateDate,
} from "./groundBookingsService";
import { canManageRoster, roleIn } from "./teamsService";
import { notify } from "./notificationService";

const MAX_MATCH_HOURS = 12;

const TEAM_FIELDS = "name slug logo sport owner captain members status";
export const CHALLENGE_POPULATE = [
  { path: "challenger", select: "name username photo" },
  { path: "challengerTeam", select: TEAM_FIELDS },
  { path: "opponentUser", select: "name username photo" },
  { path: "opponentTeam", select: TEAM_FIELDS },
  { path: "acceptedBy", select: "name username photo" },
  { path: "acceptedTeam", select: TEAM_FIELDS },
  { path: "ground", select: "name slug location sport sports pricePerHour image province district" },
  { path: "counterProposals.ground", select: "name slug location sport sports pricePerHour image" },
];

function todayInNepal() {
  return new Date(Date.now() + (5 * 60 + 45) * 60 * 1000).toISOString().slice(0, 10);
}

function idOf(ref: any): string | null {
  if (!ref) return null;
  return ref._id ? ref._id.toString() : ref.toString();
}

const groundPlays = (g: any, sport: string) => g.sport === sport || (Array.isArray(g.sports) && g.sports.includes(sport));

function validateSlot(dateInput: unknown, startTime: unknown, endTime: unknown) {
  const date = validateDate(dateInput);
  if (typeof startTime !== "string" || typeof endTime !== "string") {
    throw new AppError(400, "startTime and endTime are required (HH:MM)");
  }
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start) throw new AppError(400, "endTime must be after startTime");
  if ((end - start) / 60 > MAX_MATCH_HOURS) throw new AppError(400, `A match can be at most ${MAX_MATCH_HOURS} hours`);
  const startsAt = slotStart(date, startTime).getTime();
  if (startsAt < Date.now()) throw new AppError(400, "You can't set a match in the past");
  if (startsAt > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    throw new AppError(400, `Matches can be set at most ${MAX_DAYS_AHEAD} days ahead`);
  }
  return { date, startTime, endTime };
}

/** A ground for this sport, rejected only if it is already booked at that time. */
async function checkGround(groundId: unknown, sport: string, slot: { date: string; startTime: string; endTime: string }) {
  if (!groundId) return null;
  if (!isObjectIdString(groundId)) throw new AppError(400, "Invalid ground");
  const ground = await Ground.findById(groundId);
  if (!ground || (ground as any).status === "rejected" || (ground as any).status === "suspended") throw new AppError(404, "Ground not found");
  if (!groundPlays(ground, sport)) throw new AppError(400, `${ground.name} isn't a ${sport} ground`);
  const clash = await findBookingConflict({ groundId: ground._id, ...slot });
  if (clash) {
    throw new AppError(409, `${ground.name} is booked from ${clash.startTime} to ${clash.endTime} on ${slot.date}. Pick another time or ground.`);
  }
  return ground;
}

/** A team the user may run challenges for: owner or captain, same sport, active. */
async function requireManagedTeam(user: IUser, teamId: unknown, sport: string, label: string) {
  if (!isObjectIdString(teamId)) throw new AppError(400, `${label} is required for a team match`);
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(404, "Team not found");
  if (!canManageRoster(roleIn(team, user._id))) {
    throw new AppError(403, "Only the team's owner or captain can arrange matches for this team");
  }
  if (team.status !== "active") throw new AppError(403, `${team.name} is suspended`);
  if (team.sport !== sport) throw new AppError(400, `${team.name} doesn't play this sport`);
  return team;
}

type Side = "challenger" | "opponent";

/** Which side of this challenge the user speaks for, if any. */
export function sideOf(user: IUser, c: IChallenge): Side | null {
  const me = user._id.toString();
  const manages = (team: any) => !!team && canManageRoster(roleIn(team, me));
  if (c.mode === "player") {
    if (idOf(c.challenger) === me) return "challenger";
    if (idOf(c.opponentUser) === me || idOf(c.acceptedBy) === me) return "opponent";
    return null;
  }
  if (manages(c.challengerTeam) || (!c.challengerTeam && idOf(c.challenger) === me)) return "challenger";
  if (manages(c.opponentTeam) || manages(c.acceptedTeam)) return "opponent";
  return null;
}

/** Users to notify for a side: the player, or the team's owner and captain. */
function sideRecipients(c: any, side: Side): unknown[] {
  if (c.mode === "player") return side === "challenger" ? [c.challenger] : [c.opponentUser ?? c.acceptedBy];
  const team = side === "challenger" ? c.challengerTeam : c.opponentTeam ?? c.acceptedTeam;
  if (!team) return side === "challenger" ? [c.challenger] : [c.acceptedBy];
  return [team.owner, team.captain];
}

function sideName(c: any, side: Side): string {
  if (side === "challenger") return c.challengerTeam?.name ?? c.challenger?.name ?? "The challenger";
  return c.opponentTeam?.name ?? c.acceptedTeam?.name ?? c.opponentUser?.name ?? c.acceptedBy?.name ?? "Your opponent";
}

// ---------------------------------------------------------------- reads

export async function getGroundAvailability(groundId: string, dateInput: unknown) {
  if (!isObjectIdString(groundId)) throw new AppError(400, "Invalid id");
  const date = validateDate(dateInput);
  const ground = await Ground.findById(groundId);
  if (!ground) throw new AppError(404, "Ground not found");
  const holdCutoff = new Date(Date.now() - BOOKING_HOLD_MINUTES() * 60 * 1000);
  // Only real bookings (paid, or held while being paid) take a slot.
  const bookings = await GroundBooking.find({
    ground: ground._id,
    date,
    $or: [{ status: { $in: ["confirmed", "confirmed_unpaid", "blocked"] } }, { status: "pending_payment", createdAt: { $gt: holdCutoff } }],
  });
  const taken = bookings
    .map((b: any) => ({ startTime: b.startTime, endTime: b.endTime, kind: b.status === "blocked" ? "blocked" : b.source === "challenge" ? "match" : "booking" }))
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
  return { date, taken };
}

export async function listOpenChallenges(filters: { sport?: string; mode?: string; province?: string }) {
  const query: any = { status: "open", date: { $gte: todayInNepal() } };
  if (filters.sport) query.sport = filters.sport;
  if (filters.mode === "team" || filters.mode === "player") query.mode = filters.mode;
  if (filters.province) query.province = filters.province;
  return Challenge.find(query).populate(CHALLENGE_POPULATE).sort({ date: 1, startTime: 1 }).limit(200);
}

export async function listMyChallenges(user: IUser) {
  // Teams the user runs (owner or captain) count as theirs.
  const managed = await Team.find({ $or: [{ owner: user._id }, { captain: user._id }] }).select("_id");
  const teamIds = managed.map((t) => t._id);
  return Challenge.find({
    $or: [
      { challenger: user._id },
      { opponentUser: user._id },
      { acceptedBy: user._id },
      { challengerTeam: { $in: teamIds } },
      { opponentTeam: { $in: teamIds } },
      { acceptedTeam: { $in: teamIds } },
    ],
  })
    .populate(CHALLENGE_POPULATE)
    .sort({ date: 1, startTime: 1 })
    .limit(300);
}

export async function getChallengeById(id: string) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid id");
  const challenge = await Challenge.findById(id).populate(CHALLENGE_POPULATE);
  if (!challenge) throw new AppError(404, "Challenge not found");
  return challenge;
}

// ---------------------------------------------------------------- create

export async function createChallenge(user: IUser, input: Record<string, any>) {
  const sport = input.sport;
  if (!sport || !isActiveSportSlug(sport)) throw new AppError(400, "A valid sport is required");
  const mode = input.mode;
  if (mode !== "team" && mode !== "player") throw new AppError(400, 'mode must be "team" or "player"');
  const slot = validateSlot(input.date, input.startTime, input.endTime);
  if (input.province && !isValidProvince(input.province)) throw new AppError(400, `Invalid province: ${input.province}`);
  const format = input.format ?? "friendly";
  if (!(MATCH_FORMATS as readonly string[]).includes(format)) throw new AppError(400, `format must be one of: ${MATCH_FORMATS.join(", ")}`);
  const venueNote = optionalString(input.venueNote, "venueNote", 200);
  const message = optionalString(input.message, "message", 500);

  let challengerTeam: ITeam | null = null;
  let opponentUser: IUser | null = null;
  let opponentTeam: ITeam | null = null;

  if (mode === "team") {
    challengerTeam = await requireManagedTeam(user, input.teamId, sport, "Your team");
    if (input.opponentTeamId) {
      if (!isObjectIdString(input.opponentTeamId)) throw new AppError(400, "Invalid opponent team");
      opponentTeam = await Team.findById(input.opponentTeamId);
      if (!opponentTeam || opponentTeam.status !== "active") throw new AppError(404, "Opponent team not found");
      if (opponentTeam.sport !== sport) throw new AppError(400, `${opponentTeam.name} doesn't play this sport`);
      if (opponentTeam._id.equals(challengerTeam._id)) throw new AppError(400, "A team can't challenge itself");
      if (canManageRoster(roleIn(opponentTeam, user._id))) {
        throw new AppError(400, "You run both teams; pick a team run by someone else");
      }
    }
  } else if (input.opponentUserId) {
    if (!isObjectIdString(input.opponentUserId)) throw new AppError(400, "Invalid opponent");
    if (input.opponentUserId === user._id.toString()) throw new AppError(400, "You can't challenge yourself");
    opponentUser = await User.findById(input.opponentUserId);
    if (!opponentUser || opponentUser.status !== "active" || opponentUser.role !== "player") throw new AppError(404, "Opponent not found");
  }

  const ground = await checkGround(input.groundId, sport, slot);
  const direct = !!(opponentUser || opponentTeam);
  const challenge = await Challenge.create({
    sport,
    mode,
    format,
    challenger: user._id,
    challengerTeam: challengerTeam?._id ?? null,
    opponentUser: opponentUser?._id ?? null,
    opponentTeam: opponentTeam?._id ?? null,
    ...slot,
    ground: ground?._id ?? null,
    province: input.province || challengerTeam?.province || user.province || undefined,
    venueNote,
    message,
    status: direct ? "pending" : "open",
    awaiting: direct ? "opponent" : null,
  });

  if (direct) {
    const who = challengerTeam?.name ?? user.name;
    await notify(opponentUser ? [opponentUser._id] : [opponentTeam!.owner, opponentTeam!.captain], {
      type: "challenge.received",
      title: `${who} challenged ${opponentTeam ? opponentTeam.name : "you"} to a ${sport} match`,
      body: `${slot.date}, ${slot.startTime}–${slot.endTime}`,
      link: `/challenges/${challenge._id}`,
      entity: { type: "challenge", id: challenge._id },
      actor: user._id,
    });
  }
  return getChallengeById(challenge._id.toString());
}

function assertStillUpcoming(c: { date: string; startTime: string }) {
  if (slotStart(c.date, c.startTime).getTime() < Date.now()) {
    throw new AppError(400, "This match time has already passed");
  }
}

/** Create the match for an accepted challenge (idempotent: one match per challenge). */
async function createMatchFor(c: IChallenge) {
  const fresh = await Challenge.findById(c._id);
  if (!fresh) return null;
  const isTeam = fresh.mode === "team";
  const existing = await Match.findOne({ challenge: fresh._id });
  if (existing) return existing;
  try {
    const m = await Match.create({
      source: "challenge",
      challenge: fresh._id,
      sport: fresh.sport,
      mode: fresh.mode,
      teamA: isTeam ? fresh.challengerTeam : null,
      teamB: isTeam ? fresh.opponentTeam ?? fresh.acceptedTeam : null,
      userA: isTeam ? null : fresh.challenger,
      userB: isTeam ? null : fresh.opponentUser ?? fresh.acceptedBy,
      date: fresh.date,
      startTime: fresh.startTime,
      endTime: fresh.endTime,
      ground: fresh.ground,
      booking: fresh.booking,
      venueNote: fresh.venueNote,
      status: "pending",
    });
    await Challenge.updateOne({ _id: fresh._id }, { $set: { match: m._id } });
    return m;
  } catch (err: any) {
    if (err?.code === 11000) return Match.findOne({ challenge: fresh._id });
    throw err;
  }
}

// ---------------------------------------------------------------- respond

export async function acceptChallenge(user: IUser, id: string, input: { teamId?: string }) {
  const challenge = await getChallengeById(id);
  if (!["open", "pending", "countered"].includes(challenge.status)) {
    throw new AppError(400, `This challenge is already ${challenge.status}`);
  }

  const $set: Record<string, unknown> = { status: "accepted", awaiting: null, respondedAt: new Date() };
  let acceptedTeam: ITeam | null = null;

  if (challenge.status === "open") {
    if (idOf(challenge.challenger) === user._id.toString()) throw new AppError(400, "You can't accept your own challenge");
    if (challenge.mode === "team") {
      acceptedTeam = await requireManagedTeam(user, input.teamId, challenge.sport, "Your team");
      if (challenge.challengerTeam && acceptedTeam._id.equals(idOf(challenge.challengerTeam)!)) {
        throw new AppError(400, "A team can't play itself");
      }
      if (canManageRoster(roleIn(challenge.challengerTeam as any, user._id))) {
        throw new AppError(400, "You run both teams; a team run by someone else must accept");
      }
      $set.acceptedTeam = acceptedTeam._id;
    }
    $set.acceptedBy = user._id;
  } else {
    // pending / countered: only the side whose turn it is can accept.
    const side = sideOf(user, challenge);
    if (!side) throw new AppError(403, "This challenge was sent to someone else");
    if (side !== challenge.awaiting) throw new AppError(400, "Waiting for the other side to answer");
    // acceptedBy is always someone on the opponent side: the acceptor, or
    // (when the challenger accepts a counter) whoever made that counter.
    const lastOpponentCounter = [...challenge.counterProposals].reverse().find((p) => p.side === "opponent");
    $set.acceptedBy =
      side === "opponent"
        ? user._id
        : challenge.mode === "player"
          ? idOf(challenge.opponentUser)
          : idOf(lastOpponentCounter?.by) ?? idOf(challenge.acceptedBy);
    if (challenge.mode === "team") $set.acceptedTeam = idOf(challenge.opponentTeam);
    // Accepting a counter-proposal adopts its time and place.
    const last = challenge.counterProposals[challenge.counterProposals.length - 1];
    if (challenge.status === "countered" && last) {
      Object.assign($set, { date: last.date, startTime: last.startTime, endTime: last.endTime, ground: idOf(last.ground), venueNote: last.venueNote });
    }
  }
  assertStillUpcoming({ date: ($set.date as string) ?? challenge.date, startTime: ($set.startTime as string) ?? challenge.startTime });

  const updated = await Challenge.findOneAndUpdate({ _id: challenge._id, status: challenge.status }, { $set }, { new: true });
  if (!updated) throw new AppError(409, "Someone else just answered this challenge");
  await createMatchFor(updated);

  const fresh = await getChallengeById(id);
  const actorSide: Side = challenge.status === "open" ? "opponent" : sideOf(user, fresh) ?? "opponent";
  const other: Side = actorSide === "challenger" ? "opponent" : "challenger";
  await notify(sideRecipients(fresh, other) as any, {
    type: "challenge.accepted",
    title: `${sideName(fresh, actorSide)} accepted the ${fresh.sport} match`,
    body: `${fresh.date}, ${fresh.startTime}–${fresh.endTime}${fresh.ground ? "" : ". Find a ground or agree a venue."}`,
    link: `/challenges/${fresh._id}`,
    entity: { type: "challenge", id: fresh._id },
    actor: user._id,
  });
  return fresh;
}

export async function counterChallenge(user: IUser, id: string, input: Record<string, any>) {
  const challenge = await getChallengeById(id);
  if (challenge.status !== "pending" && challenge.status !== "countered") {
    throw new AppError(400, "Only a challenge sent to a specific player or team can be countered");
  }
  const side = sideOf(user, challenge);
  if (!side) throw new AppError(403, "This challenge was sent to someone else");
  if (side !== challenge.awaiting) throw new AppError(400, "Waiting for the other side to answer");
  if (challenge.counterProposals.length >= MAX_COUNTERS()) {
    throw new AppError(400, `After ${MAX_COUNTERS()} proposals, accept or decline the latest one`);
  }
  const slot = validateSlot(input.date ?? challenge.date, input.startTime ?? challenge.startTime, input.endTime ?? challenge.endTime);
  const ground = input.groundId === undefined ? (challenge.ground ? await checkGround(idOf(challenge.ground), challenge.sport, slot) : null) : await checkGround(input.groundId || null, challenge.sport, slot);
  const proposal = {
    by: user._id,
    side,
    ...slot,
    ground: ground?._id ?? null,
    venueNote: optionalString(input.venueNote, "venueNote", 200) ?? challenge.venueNote,
    message: optionalString(input.message, "message", 500),
    createdAt: new Date(),
  };
  const next: Side = side === "opponent" ? "challenger" : "opponent";
  const updated = await Challenge.findOneAndUpdate(
    { _id: challenge._id, status: challenge.status, awaiting: side },
    { $push: { counterProposals: proposal }, $set: { status: "countered", awaiting: next } },
    { new: true }
  );
  if (!updated) throw new AppError(409, "The challenge changed in the meantime; reload and try again");
  await notify(sideRecipients(challenge, next) as any, {
    type: "challenge.countered",
    title: `${sideName(challenge, side)} proposed a different time or place`,
    body: `${slot.date}, ${slot.startTime}–${slot.endTime}${ground ? ` at ${ground.name}` : ""}`,
    link: `/challenges/${challenge._id}`,
    entity: { type: "challenge", id: challenge._id },
    actor: user._id,
  });
  return getChallengeById(id);
}

export async function declineChallenge(user: IUser, id: string) {
  const challenge = await getChallengeById(id);
  if (challenge.status !== "pending" && challenge.status !== "countered") {
    throw new AppError(400, "Only a challenge sent to you can be declined");
  }
  const side = sideOf(user, challenge);
  if (!side) throw new AppError(403, "This challenge was sent to someone else");
  if (side !== challenge.awaiting) throw new AppError(400, "Waiting for the other side to answer");
  const updated = await Challenge.findOneAndUpdate(
    { _id: challenge._id, status: challenge.status },
    { $set: { status: "declined", awaiting: null, respondedAt: new Date() } }
  );
  if (!updated) throw new AppError(409, "The challenge changed in the meantime");
  const other: Side = side === "challenger" ? "opponent" : "challenger";
  await notify(sideRecipients(challenge, other) as any, {
    type: "challenge.declined",
    title: `${sideName(challenge, side)} declined the ${challenge.sport} match`,
    link: `/challenges/${challenge._id}`,
    entity: { type: "challenge", id: challenge._id },
    actor: user._id,
  });
  return getChallengeById(id);
}

export async function cancelChallenge(user: IUser, id: string) {
  const challenge = await getChallengeById(id);
  if (!["open", "pending", "countered", "accepted"].includes(challenge.status)) {
    throw new AppError(400, `This challenge is already ${challenge.status}`);
  }
  const side = sideOf(user, challenge);
  // Before acceptance only the challenger can withdraw; after it, either side can call it off.
  if (side !== "challenger" && !(challenge.status === "accepted" && side === "opponent")) {
    throw new AppError(403, "Only the people in this match can call it off");
  }
  const updated = await Challenge.findOneAndUpdate(
    { _id: challenge._id, status: challenge.status },
    { $set: { status: "cancelled", awaiting: null } }
  );
  if (!updated) throw new AppError(409, "The challenge changed in the meantime");
  await Match.updateOne({ challenge: challenge._id, status: "pending" }, { $set: { status: "cancelled" } });
  if (challenge.status !== "open") {
    const other: Side = side === "challenger" ? "opponent" : "challenger";
    await notify(sideRecipients(challenge, other) as any, {
      type: "challenge.cancelled",
      title: `${sideName(challenge, side!)} called off the ${challenge.sport} match on ${challenge.date}`,
      body: challenge.booking ? "Any ground booking made for it is still yours to cancel from My bookings." : undefined,
      link: `/challenges/${challenge._id}`,
      entity: { type: "challenge", id: challenge._id },
      actor: user._id,
    });
  }
  return getChallengeById(id);
}

// ---------------------------------------------------------------- grounds for an accepted match

/**
 * "Find a Ground Near You": approved grounds for the sport, nearest first
 * when a location is known (else same province first), each marked free or
 * taken for the match slot.
 */
export async function nearbyGrounds(id: string, query: { lat?: unknown; lng?: unknown; radiusKm?: unknown }) {
  const c = await getChallengeById(id);
  const filter: any = { $or: [{ sport: c.sport }, { sports: c.sport }], status: { $nin: ["pending", "rejected", "suspended"] } };
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  let grounds: any[];
  if (Number.isFinite(lat) && Number.isFinite(lng) && query.lat !== undefined) {
    const r = Math.min(100, Math.max(1, Number(query.radiusKm) || 25));
    grounds = await Ground.find({ ...filter, geo: { $geoWithin: { $centerSphere: [[lng, lat], r / 6378.1] } } }).limit(50).lean();
    const dist = (g: any) => {
      const [glng, glat] = g.geo?.coordinates ?? [lng, lat];
      return (glat - lat) ** 2 + ((glng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    };
    grounds.sort((a, b) => dist(a) - dist(b));
  } else {
    grounds = await Ground.find(filter).limit(50).lean();
    if (c.province) grounds.sort((a, b) => Number(b.province === c.province) - Number(a.province === c.province));
  }
  const results = await Promise.all(
    grounds.slice(0, 20).map(async (g) => {
      const clash = await findBookingConflict({ groundId: g._id, date: c.date, startTime: c.startTime, endTime: c.endTime });
      return { ground: g, available: !clash };
    })
  );
  return { date: c.date, startTime: c.startTime, endTime: c.endTime, grounds: results };
}

/**
 * Book a ground for an accepted match. Optional: players can also arrange
 * the venue themselves. Uses the normal booking (lock, pricing, payment hold).
 */
export async function bookGround(user: IUser, id: string, input: { groundId?: unknown }) {
  const c = await getChallengeById(id);
  if (c.status !== "accepted") throw new AppError(400, "Book a ground once the match is accepted");
  if (!sideOf(user, c)) throw new AppError(403, "Only the people in this match can book a ground for it");
  if (c.booking) {
    const existing = await GroundBooking.findById(c.booking);
    if (existing && existing.status !== "cancelled") throw new AppError(409, "A ground is already booked for this match");
  }
  if (!isObjectIdString(input.groundId)) throw new AppError(400, "groundId is required");
  const g = await Ground.findById(input.groundId);
  if (!g) throw new AppError(404, "Ground not found");
  if (!groundPlays(g, c.sport)) throw new AppError(400, `${g.name} isn't a ${c.sport} ground`);

  const booking = await createBooking(user, { groundId: g._id.toString(), date: c.date, startTime: c.startTime, endTime: c.endTime });
  await GroundBooking.updateOne({ _id: booking!._id }, { $set: { source: "challenge", challenge: c._id } });
  await Challenge.updateOne({ _id: c._id }, { $set: { ground: g._id, booking: booking!._id } });
  await Match.updateOne({ challenge: c._id }, { $set: { ground: g._id, booking: booking!._id } });

  const side = sideOf(user, c)!;
  await notify(sideRecipients(c, side === "challenger" ? "opponent" : "challenger") as any, {
    type: "booking.confirmed",
    title: `${g.name} is being booked for your match on ${c.date}`,
    link: `/challenges/${c._id}`,
    entity: { type: "challenge", id: c._id },
    actor: user._id,
  });
  return { booking: await GroundBooking.findById(booking!._id).populate("ground"), challenge: await getChallengeById(id) };
}

// ---------------------------------------------------------------- housekeeping

/** Unanswered challenges whose start time has passed expire (run by the sweeper). */
export async function expireStaleChallenges() {
  const today = todayInNepal();
  const candidates = await Challenge.find({ status: { $in: ["open", "pending", "countered"] }, date: { $lte: today } }).select("date startTime");
  const stale = candidates.filter((c) => slotStart(c.date, c.startTime).getTime() < Date.now()).map((c) => c._id);
  if (!stale.length) return 0;
  const res = await Challenge.updateMany(
    { _id: { $in: stale }, status: { $in: ["open", "pending", "countered"] } },
    { $set: { status: "expired", awaiting: null } }
  );
  return res.modifiedCount;
}

