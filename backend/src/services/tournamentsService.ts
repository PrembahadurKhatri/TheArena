import { Types } from "mongoose";
import { Tournament, ITournament, MIN_TEAMS_FOR_REVIEW, TOURNAMENT_FORMATS, TournamentFormat } from "../models/Tournament";
import { TournamentRegistration } from "../models/TournamentRegistration";
import { Match, IMatch } from "../models/Match";
import { Team, ITeam } from "../models/Team";
import { Sport } from "../models/Sport";
import { TeamSportStats } from "../models/SportStats";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isActiveSportSlug } from "../utils/sports";
import { isValidProvince } from "../utils/provinces";
import { isValidDistrict, parseGeo } from "../utils/locations";
import { escapeRegex, isObjectIdString, optionalString, queryString, requireString } from "../utils/validation";
import { uniqueSlug } from "../utils/names";
import { Page, pageMeta } from "../utils/pagination";
import { getEntitlements } from "./entitlementsService";
import { canManageRoster, roleIn } from "./teamsService";
import { notify } from "./notificationService";
import { audit } from "./auditService";
import { parseTimeToMinutes, validateDate } from "./groundBookingsService";
import * as fx from "./fixtures";

const TEAM_SUMMARY_POPULATE = { path: "owner", select: "name" };
const DETAIL_POPULATE = [
  { path: "organizer", select: "name username" },
  { path: "teams", select: "name slug logo sport owner members province district", populate: TEAM_SUMMARY_POPULATE },
  { path: "winner", select: "name slug logo" },
];
const MATCH_POPULATE = [
  { path: "teamA", select: "name slug logo" },
  { path: "teamB", select: "name slug logo" },
  { path: "winner", select: "name slug logo" },
  { path: "ground", select: "name location" },
];

// Statuses in which teams may still ask to join.
const REGISTRATION_OPEN = ["open", "under_review", "approved", "rejected", "upcoming"];
const BEFORE_START = ["open", "under_review", "approved", "rejected", "upcoming"];

function idStr(v: any) {
  return v?._id ? v._id.toString() : v?.toString();
}

async function getTournamentOrThrow(idOrSlug: string) {
  const t = isObjectIdString(idOrSlug) ? await Tournament.findById(idOrSlug) : await Tournament.findOne({ slug: String(idOrSlug).toLowerCase() });
  if (!t) throw new AppError(404, "Tournament not found");
  return t;
}

async function getOrganizedOrThrow(id: string, user: IUser) {
  const t = await getTournamentOrThrow(id);
  if (t.organizer.toString() !== user._id.toString()) throw new AppError(403, "Only the tournament organizer can do this");
  return t;
}

const registrationClosed = (t: ITournament) => !!t.registrationClosesAt && t.registrationClosesAt.getTime() < Date.now();

// ---------------------------------------------------------------- reads

export async function listTournaments(filters: Record<string, unknown>, p?: Page) {
  const query: any = {};
  const sport = queryString(filters.sport);
  if (sport) query.sport = sport;
  const status = queryString(filters.status);
  // "upcoming" in the public filter means "not started yet".
  if (status === "upcoming") query.status = { $in: ["open", "under_review", "approved", "upcoming"] };
  else if (status === "open") query.status = { $in: ["open", "approved", "upcoming"] };
  else if (status) query.status = status;
  else query.status = { $nin: ["cancelled", "rejected"] };
  const province = queryString(filters.province);
  if (province) query.province = province;
  const district = queryString(filters.district);
  if (district) query.district = district;
  const search = queryString(filters.search);
  if (search) query.name = { $regex: escapeRegex(search), $options: "i" };
  const cursor = Tournament.find(query).populate("organizer", "name").sort({ startDate: 1 });
  if (!p) return { tournaments: await cursor.limit(200), page: 1, limit: 200, total: 0, pages: 1 };
  const [items, total] = await Promise.all([cursor.skip(p.skip).limit(p.limit), Tournament.countDocuments(query)]);
  return { tournaments: items, ...pageMeta(p, total) };
}

/** Approved, eligible teams and how many different owners they have (excluding the organizer). */
export async function eligibility(t: ITournament) {
  const regs = await TournamentRegistration.find({ tournament: t._id, status: "approved" }).populate("team", "owner status members sport");
  const eligibleTeams = regs.filter((r: any) => r.team && r.team.status === "active" && r.eligibility?.ok !== false);
  const owners = new Set(eligibleTeams.map((r: any) => r.team.owner.toString()).filter((o) => o !== t.organizer.toString()));
  const needed = Math.max(MIN_TEAMS_FOR_REVIEW, t.minTeams);
  return {
    approvedTeams: eligibleTeams.length,
    distinctOwners: owners.size,
    needed,
    readyForReview: eligibleTeams.length >= needed && owners.size >= 2,
  };
}

export async function getTournamentDetail(idOrSlug: string, viewer?: IUser) {
  const base = await getTournamentOrThrow(idOrSlug);
  const tournament = await Tournament.findById(base._id).populate(DETAIL_POPULATE);
  const isOrganizer = !!viewer && base.organizer.equals(viewer._id);
  const [matches, regs, elig] = await Promise.all([
    Match.find({ tournament: base._id }).sort({ stage: 1, group: 1, round: 1, matchNumber: 1, createdAt: 1 }).populate(MATCH_POPULATE),
    TournamentRegistration.find({ tournament: base._id, ...(isOrganizer ? {} : { status: "approved" }) })
      .sort({ createdAt: 1 })
      .populate([{ path: "team", select: "name slug logo owner captain members", populate: TEAM_SUMMARY_POPULATE }, { path: "requestedBy", select: "name" }]),
    eligibility(base),
  ]);
  // Which of the viewer's teams (that they run) could still request, and what they've already sent.
  let viewerTeams: { id: string; name: string; registration: string | null }[] = [];
  if (viewer) {
    const mine = await Team.find({ sport: base.sport, $or: [{ owner: viewer._id }, { captain: viewer._id }] }).select("name");
    const myRegs = await TournamentRegistration.find({ tournament: base._id, team: { $in: mine.map((t) => t._id) } }).select("team status");
    viewerTeams = mine.map((t) => ({ id: t._id.toString(), name: t.name, registration: myRegs.find((r) => r.team.equals(t._id))?.status ?? null }));
  }
  return { tournament, matches, registrations: regs, eligibility: elig, isOrganizer, viewerTeams, standings: await standingsFor(base, matches) };
}

/** Tables for league/group stages, from verified matches only. */
export async function standingsFor(t: ITournament, matches?: IMatch[]) {
  const list = matches ?? (await Match.find({ tournament: t._id }));
  const tableStages = list.filter((m) => m.stage === "league" || m.stage === "group");
  if (!tableStages.length) return [];
  const groups = new Map<string, Set<string>>();
  for (const m of tableStages) {
    const g = m.group ?? "League";
    if (!groups.has(g)) groups.set(g, new Set());
    for (const team of [m.teamA, m.teamB]) if (team) groups.get(g)!.add(idStr(team));
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, teams]) => ({
      group,
      rows: fx.standings(
        [...teams],
        tableStages
          .filter((m) => (m.group ?? "League") === group && m.status === "completed" && m.teamA && m.teamB)
          .map((m) => ({ teamA: idStr(m.teamA), teamB: idStr(m.teamB), scoreA: m.scoreA ?? 0, scoreB: m.scoreB ?? 0, winner: m.winner ? idStr(m.winner) : null, isDraw: !!m.isDraw })),
        t.points ?? { win: 3, draw: 1, loss: 0 }
      ),
    }));
}

// ---------------------------------------------------------------- create / edit

function parseDate(value: unknown, field: string, required = false): Date | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new AppError(400, `${field} is required`);
    return null;
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new AppError(400, `${field} is not a valid date`);
  return d;
}

function parseFormat(input: Record<string, any>, current?: ITournament) {
  const format = (input.format ?? current?.format ?? "knockout") as TournamentFormat;
  if (!(TOURNAMENT_FORMATS as readonly string[]).includes(format)) throw new AppError(400, `format must be one of: ${TOURNAMENT_FORMATS.join(", ")}`);
  const maxTeams = Number(input.maxTeams ?? current?.maxTeams);
  if (!Number.isInteger(maxTeams) || maxTeams < MIN_TEAMS_FOR_REVIEW || maxTeams > 128) {
    throw new AppError(400, `maxTeams must be a whole number between ${MIN_TEAMS_FOR_REVIEW} and 128`);
  }
  const minTeams = Number(input.minTeams ?? current?.minTeams ?? MIN_TEAMS_FOR_REVIEW);
  if (!Number.isInteger(minTeams) || minTeams < MIN_TEAMS_FOR_REVIEW || minTeams > maxTeams) {
    throw new AppError(400, `minTeams must be at least ${MIN_TEAMS_FOR_REVIEW} and no more than maxTeams`);
  }
  const groups = Number(input.groups ?? current?.groups ?? 2);
  const advancePerGroup = Number(input.advancePerGroup ?? current?.advancePerGroup ?? 2);
  if (format === "group_stage" || format === "group_knockout") {
    if (!Number.isInteger(groups) || groups < 1 || groups > 16) throw new AppError(400, "groups must be from 1 to 16");
    if (minTeams < groups * 2) throw new AppError(400, "Each group needs at least 2 teams: raise minTeams or use fewer groups");
    if (format === "group_knockout" && (!Number.isInteger(advancePerGroup) || advancePerGroup < 1 || groups * advancePerGroup < 2)) {
      throw new AppError(400, "At least two teams must go through to the knockout stage");
    }
  }
  const points = {
    win: Number(input.points?.win ?? current?.points?.win ?? 3),
    draw: Number(input.points?.draw ?? current?.points?.draw ?? 1),
    loss: Number(input.points?.loss ?? current?.points?.loss ?? 0),
  };
  if (![points.win, points.draw, points.loss].every((n) => Number.isFinite(n) && n >= 0 && n <= 10)) throw new AppError(400, "points must be numbers from 0 to 10");
  return { format, maxTeams, minTeams, groups, advancePerGroup, points };
}

export async function createTournament(organizer: IUser, input: Record<string, any>) {
  if (!getEntitlements(organizer).canOrganizeTournaments) throw new AppError(403, "Premium membership required to organize tournaments");
  const { sport, province } = input;
  if (!input.name || !sport || !input.maxTeams || !input.startDate || !province) {
    throw new AppError(400, "name, sport, maxTeams, startDate and province are required");
  }
  const name = requireString(input.name, "name", { min: 3, max: 100 });
  if (!isActiveSportSlug(sport)) throw new AppError(400, `Invalid sport slug: ${sport}`);
  if (!isValidProvince(province)) throw new AppError(400, `Invalid province: ${province}`);
  if (input.district && !isValidDistrict(input.district)) throw new AppError(400, `Invalid district: ${input.district}`);
  const startDate = parseDate(input.startDate, "startDate", true)!;
  if (startDate.getTime() < Date.now() - 86_400_000) throw new AppError(400, "startDate can't be in the past");
  const registrationClosesAt = parseDate(input.registrationClosesAt, "registrationClosesAt");
  if (registrationClosesAt && registrationClosesAt > startDate) throw new AppError(400, "Registration must close before the tournament starts");
  const endDate = parseDate(input.endDate, "endDate");
  if (endDate && endDate < startDate) throw new AppError(400, "endDate must be after startDate");
  const entryFee = Number(input.entryFee ?? 0);
  if (!Number.isFinite(entryFee) || entryFee < 0) throw new AppError(400, "entryFee must be 0 or more");

  const t = await Tournament.create({
    name,
    slug: await uniqueSlug(Tournament, name),
    sport,
    organizer: organizer._id,
    ...parseFormat(input),
    startDate,
    endDate,
    registrationOpensAt: new Date(),
    registrationClosesAt,
    entryFee,
    prizes: optionalString(input.prizes, "prizes", 1000),
    rules: optionalString(input.rules, "rules", 5000),
    description: optionalString(input.description, "description", 2000),
    poster: input.poster ?? null,
    province,
    district: input.district || undefined,
    location: optionalString(input.location, "location", 120),
    geo: parseGeo(input.lat, input.lng) ?? undefined,
    teams: [],
    status: "open",
  });
  return Tournament.findById(t._id).populate(DETAIL_POPULATE);
}

export async function updateTournament(id: string, user: IUser, input: Record<string, any>) {
  const t = await getOrganizedOrThrow(id, user);
  if (!BEFORE_START.includes(t.status)) throw new AppError(400, "A tournament can't be edited once it has started");
  if (input.name !== undefined) {
    t.name = requireString(input.name, "name", { min: 3, max: 100 });
    t.slug = await uniqueSlug(Tournament, t.name, t._id);
  }
  const approved = t.status === "approved" || t.status === "upcoming";
  if (["format", "maxTeams", "minTeams", "groups", "advancePerGroup", "points"].some((k) => input[k] !== undefined)) {
    if (approved) throw new AppError(400, "The format and team limits are fixed once staff approve the tournament");
    Object.assign(t, parseFormat(input, t));
  }
  for (const k of ["description", "prizes", "rules", "location"] as const) {
    if (input[k] !== undefined) (t as any)[k] = optionalString(input[k], k, k === "rules" ? 5000 : 2000);
  }
  if (input.poster !== undefined) t.poster = input.poster;
  if (input.startDate !== undefined) t.startDate = parseDate(input.startDate, "startDate", true)!;
  if (input.endDate !== undefined) t.endDate = parseDate(input.endDate, "endDate");
  if (input.registrationClosesAt !== undefined) t.registrationClosesAt = parseDate(input.registrationClosesAt, "registrationClosesAt");
  if (t.registrationClosesAt && t.registrationClosesAt > t.startDate) throw new AppError(400, "Registration must close before the tournament starts");
  if (input.entryFee !== undefined) {
    const fee = Number(input.entryFee);
    if (!Number.isFinite(fee) || fee < 0) throw new AppError(400, "entryFee must be 0 or more");
    t.entryFee = fee;
  }
  // Editing a rejected tournament reopens it so it can be submitted again.
  if (t.status === "rejected") t.status = "open";
  await t.save();
  return Tournament.findById(t._id).populate(DETAIL_POPULATE);
}

// ---------------------------------------------------------------- registrations

async function checkEligibility(team: ITeam, t: ITournament) {
  const reasons: string[] = [];
  if (team.sport !== t.sport) reasons.push(`plays ${team.sport}, not ${t.sport}`);
  if (team.status !== "active") reasons.push("team is suspended");
  const sport = await Sport.findOne({ slug: t.sport }).select("minPlayers").lean();
  const min = sport?.minPlayers ?? 1;
  if (team.members.length < min) reasons.push(`needs at least ${min} players (has ${team.members.length})`);
  return { ok: reasons.length === 0, reasons };
}

const managersOf = (team: any) => [team?.owner, team?.captain];

export async function requestRegistration(tournamentId: string, user: IUser, teamId: unknown, note?: unknown) {
  if (!isObjectIdString(teamId)) throw new AppError(400, "Invalid teamId");
  const t = await getTournamentOrThrow(tournamentId);
  if (!REGISTRATION_OPEN.includes(t.status)) throw new AppError(400, "This tournament isn't taking registrations");
  if (registrationClosed(t)) throw new AppError(400, "Registration has closed");
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(404, "Team not found");
  if (!canManageRoster(roleIn(team, user._id))) throw new AppError(403, "Only the team's owner or captain can register it for a tournament");
  if (team.sport !== t.sport) throw new AppError(400, "Team sport does not match tournament sport");
  if (t.teams.length >= t.maxTeams) throw new AppError(400, "Tournament is already full");
  const elig = await checkEligibility(team, t);
  if (!elig.ok) throw new AppError(400, `${team.name} isn't eligible yet: ${elig.reasons.join("; ")}`);

  const existing = await TournamentRegistration.findOne({ tournament: t._id, team: team._id });
  if (existing && existing.status !== "withdrawn" && existing.status !== "rejected") {
    throw new AppError(400, "Team is already registered for this tournament");
  }
  const reg = existing
    ? await TournamentRegistration.findByIdAndUpdate(
        existing._id,
        { $set: { status: "requested", requestedBy: user._id, eligibility: elig, rosterSize: team.members.length, note: optionalString(note, "note", 500), respondedBy: null, respondedAt: null, responseReason: null } },
        { new: true }
      )
    : await TournamentRegistration.create({ tournament: t._id, team: team._id, requestedBy: user._id, eligibility: elig, rosterSize: team.members.length, note: optionalString(note, "note", 500) });

  await notify(t.organizer, {
    type: "tournament.registration",
    title: `${team.name} asked to join ${t.name}`,
    link: `/tournaments/${t.slug ?? t._id}?tab=teams`,
    entity: { type: "tournament", id: t._id },
    actor: user._id,
  });
  return reg!;
}

export async function withdrawRegistration(regId: string, user: IUser) {
  if (!isObjectIdString(regId)) throw new AppError(404, "Registration not found");
  const reg = await TournamentRegistration.findById(regId);
  if (!reg) throw new AppError(404, "Registration not found");
  const team = await Team.findById(reg.team);
  if (!team || !canManageRoster(roleIn(team, user._id))) throw new AppError(403, "Only the team's owner or captain can withdraw it");
  const t = await getTournamentOrThrow(reg.tournament.toString());
  if (!BEFORE_START.includes(t.status)) throw new AppError(400, "You can't withdraw after the tournament has started");
  if (reg.status !== "requested" && reg.status !== "approved") throw new AppError(400, `This registration is already ${reg.status}`);
  await TournamentRegistration.updateOne({ _id: reg._id }, { $set: { status: "withdrawn" } });
  await Tournament.updateOne({ _id: t._id }, { $pull: { teams: team._id } });
  await notify(t.organizer, { type: "tournament.registration", title: `${team.name} withdrew from ${t.name}`, entity: { type: "tournament", id: t._id }, actor: user._id });
  return { message: `${team.name} withdrew` };
}

export async function respondToRegistration(tournamentId: string, regId: string, user: IUser, input: { action?: unknown; reason?: unknown }) {
  const t = await getOrganizedOrThrow(tournamentId, user);
  if (!BEFORE_START.includes(t.status)) throw new AppError(400, "The tournament has already started");
  if (!isObjectIdString(regId)) throw new AppError(404, "Registration not found");
  const reg = await TournamentRegistration.findOne({ _id: regId, tournament: t._id });
  if (!reg) throw new AppError(404, "Registration not found");
  if (reg.status !== "requested") throw new AppError(400, `This registration is already ${reg.status}`);
  const team = await Team.findById(reg.team);
  if (!team) throw new AppError(404, "Team not found");
  const reason = optionalString(input.reason, "reason", 500) ?? null;

  if (input.action === "approve") {
    const elig = await checkEligibility(team, t);
    if (!elig.ok) throw new AppError(400, `${team.name} isn't eligible: ${elig.reasons.join("; ")}`);
    // Atomic: only adds the team while the tournament has room.
    const updated = await Tournament.findOneAndUpdate(
      { _id: t._id, teams: { $ne: team._id }, $expr: { $lt: [{ $size: "$teams" }, "$maxTeams"] } },
      { $push: { teams: team._id } },
      { new: true }
    );
    if (!updated) throw new AppError(409, "The tournament is full");
    await TournamentRegistration.updateOne({ _id: reg._id }, { $set: { status: "approved", eligibility: elig, respondedBy: user._id, respondedAt: new Date(), responseReason: reason } });
  } else if (input.action === "reject") {
    await TournamentRegistration.updateOne({ _id: reg._id }, { $set: { status: "rejected", respondedBy: user._id, respondedAt: new Date(), responseReason: reason } });
  } else {
    throw new AppError(400, 'action must be "approve" or "reject"');
  }

  await notify(managersOf(team), {
    type: "tournament.registration_response",
    title: input.action === "approve" ? `${team.name} is in ${t.name}` : `${t.name} declined ${team.name}'s registration`,
    body: reason ?? undefined,
    link: `/tournaments/${t.slug ?? t._id}`,
    entity: { type: "tournament", id: t._id },
    actor: user._id,
  });
  if (input.action === "approve" && (t.status === "open" || t.status === "rejected")) {
    const elig = await eligibility(t);
    if (elig.readyForReview && elig.approvedTeams === elig.needed) {
      await notify(t.organizer, {
        type: "tournament.update",
        title: `${t.name} has ${elig.approvedTeams} eligible teams`,
        body: "You can now submit it to The Arena for approval.",
        link: `/tournaments/${t.slug ?? t._id}`,
        entity: { type: "tournament", id: t._id },
      });
    }
  }
  return getTournamentDetail(t._id.toString(), user);
}

// ---------------------------------------------------------------- review

export async function submitForReview(id: string, user: IUser) {
  const t = await getOrganizedOrThrow(id, user);
  if (t.status !== "open" && t.status !== "rejected") throw new AppError(400, `This tournament is already ${t.status.replace("_", " ")}`);
  const elig = await eligibility(t);
  if (elig.approvedTeams < elig.needed) {
    throw new AppError(400, `At least ${elig.needed} eligible teams must be approved first (you have ${elig.approvedTeams})`);
  }
  if (elig.distinctOwners < 2) throw new AppError(400, "The approved teams must be run by at least two different people besides you");
  await Tournament.updateOne({ _id: t._id }, { $set: { status: "under_review", submittedAt: new Date() } });
  return getTournamentDetail(t._id.toString(), user);
}

export async function adminListTournaments(query: Record<string, unknown>, p: Page) {
  const status = queryString(query.status) ?? "under_review";
  const filter: any = status === "all" ? {} : { status };
  const [items, total] = await Promise.all([
    Tournament.find(filter).populate("organizer", "name email").sort({ submittedAt: 1, createdAt: 1 }).skip(p.skip).limit(p.limit),
    Tournament.countDocuments(filter),
  ]);
  const withElig = await Promise.all(items.map(async (t) => ({ tournament: t, eligibility: await eligibility(t) })));
  return { items: withElig, ...pageMeta(p, total) };
}

export async function adminReview(actor: IUser, id: string, input: { decision?: unknown; note?: unknown }) {
  const t = await getTournamentOrThrow(id);
  if (t.status !== "under_review") throw new AppError(400, "Only tournaments under review can be approved or rejected");
  const decision = input.decision;
  if (decision !== "approve" && decision !== "reject") throw new AppError(400, 'decision must be "approve" or "reject"');
  const note = optionalString(input.note, "note", 1000) ?? null;
  if (decision === "reject" && !note) throw new AppError(400, "Give the organizer a reason for the rejection");
  if (decision === "approve") {
    const elig = await eligibility(t);
    if (!elig.readyForReview) throw new AppError(400, `It no longer has ${elig.needed} eligible teams from at least two owners`);
  }
  const status = decision === "approve" ? "approved" : "rejected";
  await Tournament.updateOne(
    { _id: t._id, status: "under_review" },
    { $set: { status, review: { by: actor._id, decision: status, note, at: new Date() } } }
  );
  await audit({ actor: actor._id, actorRole: actor.role, action: `tournament.${status}`, target: { type: "tournament", id: t._id }, reason: note ?? undefined });
  await notify(t.organizer, {
    type: "tournament.review",
    title: decision === "approve" ? `${t.name} is approved` : `${t.name} was not approved`,
    body: note ?? (decision === "approve" ? "You can close registration and generate fixtures when ready." : undefined),
    link: `/tournaments/${t.slug ?? t._id}`,
    entity: { type: "tournament", id: t._id },
    actor: actor._id,
  });
  return Tournament.findById(t._id).populate(DETAIL_POPULATE);
}

// ---------------------------------------------------------------- start: fixtures

async function insertFixtures(t: ITournament, specs: fx.FixtureSpec[]) {
  const ids = new Map<string, Types.ObjectId>();
  for (const s of specs) ids.set(s.key, new Types.ObjectId());
  const docs = specs.map((s) => ({
    _id: ids.get(s.key),
    source: "tournament" as const,
    tournament: t._id,
    sport: t.sport,
    mode: "team" as const,
    stage: s.stage,
    round: s.round,
    group: s.group,
    matchNumber: s.matchNumber,
    teamA: s.teamA ? new Types.ObjectId(s.teamA) : null,
    teamB: s.teamB ? new Types.ObjectId(s.teamB) : null,
    nextMatch: s.nextKey ? ids.get(s.nextKey) ?? null : null,
    nextSlot: s.nextSlot,
    status: "pending" as const,
  }));
  await Match.insertMany(docs);
  // Round-1 byes: the lone team goes straight through.
  for (const s of specs) {
    if (s.stage !== "knockout" || s.round !== 1) continue;
    if ((s.teamA && !s.teamB) || (!s.teamA && s.teamB)) {
      const id = ids.get(s.key)!;
      const winner = new Types.ObjectId((s.teamA ?? s.teamB)!);
      await Match.updateOne({ _id: id }, { $set: { status: "completed", winner, verifiedAt: new Date(), isDraw: false } });
      await advanceWinner(id, winner);
    }
  }
}

async function advanceWinner(matchId: Types.ObjectId, winner: Types.ObjectId) {
  const m = await Match.findById(matchId);
  if (!m?.nextMatch || !m.nextSlot) return;
  await Match.updateOne({ _id: m.nextMatch }, { $set: { [m.nextSlot === "A" ? "teamA" : "teamB"]: winner } });
}

export async function startTournament(id: string, user: IUser) {
  const t = await getOrganizedOrThrow(id, user);
  if (t.status !== "approved" && t.status !== "upcoming") {
    throw new AppError(400, t.status === "ongoing" || t.status === "completed" ? "Tournament has already started" : "The tournament must be approved by The Arena before it can start");
  }
  const regs = await TournamentRegistration.find({ tournament: t._id, status: "approved" }).sort({ seed: 1, createdAt: 1 });
  // Legacy tournaments kept their teams directly on the document.
  const teamIds = regs.length ? regs.map((r) => r.team.toString()) : t.teams.map((x) => x.toString());
  const needed = t.legacy || t.status === "upcoming" ? 2 : t.minTeams;
  if (teamIds.length < needed) throw new AppError(400, `At least ${needed} teams must be registered to start the tournament`);

  const flipped = await Tournament.findOneAndUpdate({ _id: t._id, status: t.status }, { $set: { status: "ongoing", registrationClosesAt: new Date() } }, { new: true });
  if (!flipped) throw new AppError(409, "Tournament has already started");
  await TournamentRegistration.updateMany(
    { tournament: t._id, status: "requested" },
    { $set: { status: "rejected", responseReason: "Registration closed when the tournament started", respondedAt: new Date() } }
  );

  // Seed by registration order (organizers can set seeds later); shuffle only legacy brackets.
  const seeded = regs.length ? teamIds : shuffle(teamIds);
  let specs: fx.FixtureSpec[];
  switch (t.format) {
    case "round_robin":
      specs = fx.roundRobin(seeded, 1);
      break;
    case "league":
      specs = fx.roundRobin(seeded, 2);
      break;
    case "group_stage":
    case "group_knockout":
      specs = fx.groupStage(seeded, t.groups);
      break;
    default:
      specs = fx.knockout(seeded);
  }
  await insertFixtures(flipped, specs);
  await TeamSportStats.bulkWrite(
    teamIds.map((teamId) => ({
      updateOne: { filter: { team: new Types.ObjectId(teamId), sport: t.sport }, update: { $inc: { tournamentsPlayed: 1 } }, upsert: true },
    }))
  );
  const teams = await Team.find({ _id: { $in: teamIds } }).select("owner captain members");
  await notify(teams.flatMap((x) => x.members), {
    type: "tournament.update",
    title: `${t.name} has started: fixtures are out`,
    link: `/tournaments/${t.slug ?? t._id}?tab=fixtures`,
    entity: { type: "tournament", id: t._id },
    actor: user._id,
  });
  // A knockout of byes only (e.g. two teams, one withdrawn) may already be decided.
  await checkCompletion(flipped);
  const fresh = await Tournament.findById(t._id).populate(DETAIL_POPULATE);
  const matches = await Match.find({ tournament: t._id }).sort({ stage: 1, group: 1, round: 1, matchNumber: 1 }).populate(MATCH_POPULATE);
  return { tournament: fresh, matches };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- progress

async function finish(t: ITournament, winner: Types.ObjectId | null) {
  const done = await Tournament.findOneAndUpdate({ _id: t._id, status: "ongoing" }, { $set: { status: "completed", winner, endDate: t.endDate ?? new Date() } }, { new: true });
  if (!done) return;
  if (winner) await TeamSportStats.updateOne({ team: winner, sport: t.sport }, { $inc: { tournamentsWon: 1 } }, { upsert: true });
  const teams = await Team.find({ _id: { $in: t.teams } }).select("members name");
  const champ = teams.find((x) => winner && x._id.equals(winner));
  await notify(teams.flatMap((x) => x.members), {
    type: "tournament.update",
    title: champ ? `${champ.name} won ${t.name}` : `${t.name} is complete`,
    link: `/tournaments/${t.slug ?? t._id}`,
    entity: { type: "tournament", id: t._id },
  });
}

/** Decide the tournament if its last stage is finished; build the knockout after groups. */
async function checkCompletion(t: ITournament) {
  const matches = await Match.find({ tournament: t._id, status: { $ne: "cancelled" } });
  const knockout = matches.filter((m) => m.stage === "knockout");
  const table = matches.filter((m) => m.stage !== "knockout");

  if (knockout.length) {
    const final = knockout.find((m) => !m.nextMatch);
    if (final?.status === "completed") await finish(t, final.winner);
    return;
  }
  if (!table.length || table.some((m) => m.status !== "completed")) return;

  const tables = await standingsFor(t, matches);
  if (t.format === "group_knockout") {
    const byGroup: Record<string, string[]> = {};
    for (const g of tables) byGroup[g.group] = g.rows.map((r) => r.team);
    const seeds = fx.knockoutSeedsFromGroups(byGroup, t.advancePerGroup);
    if (seeds.length >= 2) {
      await insertFixtures(t, fx.knockout(seeds, "ko"));
      await notify((await Team.find({ _id: { $in: seeds } }).select("members")).flatMap((x) => x.members), {
        type: "tournament.update",
        title: `${t.name}: the knockout stage is set`,
        link: `/tournaments/${t.slug ?? t._id}?tab=fixtures`,
        entity: { type: "tournament", id: t._id },
      });
      return;
    }
  }
  // League / round robin / group stage only: the best record overall wins.
  const all = fx.standings(
    t.teams.map((x) => x.toString()),
    table.filter((m) => m.teamA && m.teamB).map((m) => ({ teamA: idStr(m.teamA), teamB: idStr(m.teamB), scoreA: m.scoreA ?? 0, scoreB: m.scoreB ?? 0, winner: m.winner ? idStr(m.winner) : null, isDraw: !!m.isDraw })),
    t.points
  );
  await finish(t, all[0] ? new Types.ObjectId(all[0].team) : null);
}

/** Called by statsService once a tournament match result is verified. */
export async function onMatchVerified(match: IMatch) {
  const t = await Tournament.findById(match.tournament);
  if (!t || t.status !== "ongoing") return;
  if (match.stage === "knockout" && match.winner) await advanceWinner(match._id, match.winner);
  await checkCompletion(t);
}

/**
 * The organizer reports a result. Like any result it becomes official once
 * one of the two teams confirms it (or nobody disputes it in time); only
 * then does the tournament move on (onMatchVerified).
 */
export async function completeMatch(
  tournamentId: string,
  matchId: string,
  user: IUser,
  input: { scoreA: number; scoreB: number; winnerTeamId?: string; outcome?: "A" | "B" | "draw" }
) {
  const tournament = await getTournamentOrThrow(tournamentId);
  const match = await Match.findOne({ _id: matchId, tournament: tournament._id });
  if (!match) throw new AppError(404, "Match not found");
  let outcome = input.outcome;
  if (!outcome && input.winnerTeamId) {
    outcome = match.teamA?.toString() === input.winnerTeamId ? "A" : match.teamB?.toString() === input.winnerTeamId ? "B" : undefined;
    if (!outcome) throw new AppError(400, "winnerTeamId must be one of the two teams in this match");
  }
  const { submitReport } = await import("./matchReportsService");
  await submitReport(user, match._id.toString(), { scoreA: input.scoreA, scoreB: input.scoreB, outcome });
  return getTournamentDetail(tournament._id.toString(), user);
}

export async function scheduleMatch(tournamentId: string, matchId: string, user: IUser, input: Record<string, any>) {
  const t = await getOrganizedOrThrow(tournamentId, user);
  if (t.status !== "ongoing") throw new AppError(400, "Fixtures can be scheduled once the tournament has started");
  const m = await Match.findOne({ _id: matchId, tournament: t._id });
  if (!m) throw new AppError(404, "Match not found");
  if (m.status !== "pending") throw new AppError(400, "This match has already been played");
  const $set: Record<string, unknown> = {};
  if (input.date !== undefined) $set.date = input.date ? validateDate(input.date) : null;
  for (const k of ["startTime", "endTime"] as const) {
    if (input[k] !== undefined) {
      if (input[k]) parseTimeToMinutes(input[k]);
      $set[k] = input[k] || null;
    }
  }
  if (input.venueNote !== undefined) $set.venueNote = optionalString(input.venueNote, "venueNote", 200);
  await Match.updateOne({ _id: m._id }, { $set });
  const teams = await Team.find({ _id: { $in: [m.teamA, m.teamB].filter(Boolean) } }).select("owner captain");
  await notify(teams.flatMap(managersOf), {
    type: "match.reminder",
    title: `${t.name}: your match is scheduled`,
    body: [$set.date, $set.startTime].filter(Boolean).join(" ") || undefined,
    link: `/matches/${m._id}`,
    entity: { type: "match", id: m._id },
    actor: user._id,
  });
  return Match.findById(m._id).populate(MATCH_POPULATE);
}

export async function cancelTournament(id: string, actor: IUser, reasonInput: unknown, asStaff = false) {
  const t = asStaff ? await getTournamentOrThrow(id) : await getOrganizedOrThrow(id, actor);
  if (t.status === "completed" || t.status === "cancelled") throw new AppError(400, `This tournament is already ${t.status}`);
  const reason = optionalString(reasonInput, "reason", 500);
  if (!reason) throw new AppError(400, "A reason is required to cancel a tournament");
  await Tournament.updateOne({ _id: t._id }, { $set: { status: "cancelled", cancelReason: reason } });
  await Match.updateMany({ tournament: t._id, status: { $in: ["pending", "reported", "disputed"] } }, { $set: { status: "cancelled" } });
  if (asStaff) await audit({ actor: actor._id, actorRole: actor.role, action: "tournament.cancelled_by_staff", target: { type: "tournament", id: t._id }, reason });
  const teams = await Team.find({ _id: { $in: t.teams } }).select("members");
  await notify([...teams.flatMap((x) => x.members), t.organizer], {
    type: "tournament.update",
    title: `${t.name} has been cancelled`,
    body: reason,
    entity: { type: "tournament", id: t._id },
    actor: actor._id,
  });
  return Tournament.findById(t._id).populate(DETAIL_POPULATE);
}

/** Tournaments the user organizes, or that a team they're on has entered. */
export async function myTournaments(user: IUser) {
  const teams = await Team.find({ members: user._id }).select("_id");
  const regs = await TournamentRegistration.find({ team: { $in: teams.map((t) => t._id) }, status: { $in: ["requested", "approved"] } }).select("tournament status team");
  const ids = [...new Set(regs.map((r) => r.tournament.toString()))];
  const list = await Tournament.find({ $or: [{ organizer: user._id }, { _id: { $in: ids } }] }).populate("organizer", "name").sort({ startDate: -1 });
  return list.map((t) => ({ tournament: t, organizer: t.organizer && (t.organizer as any)._id?.equals(user._id), registration: regs.find((r) => r.tournament.equals(t._id))?.status ?? null }));
}

/** @deprecated old path: a team owner/captain registering = a registration request. */
export async function registerTeam(tournamentId: string, user: IUser, teamId: string) {
  await requestRegistration(tournamentId, user, teamId);
  return Tournament.findById((await getTournamentOrThrow(tournamentId))._id).populate(DETAIL_POPULATE);
}
