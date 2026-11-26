import { Match } from "../models/Match";
import { Team } from "../models/Team";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString, queryString } from "../utils/validation";
import { isValidSportSlug } from "../utils/sports";
import { Page, pageMeta } from "../utils/pagination";

export const MATCH_POPULATE = [
  { path: "teamA", select: "name slug logo owner captain" },
  { path: "teamB", select: "name slug logo owner captain" },
  { path: "userA", select: "name username photo" },
  { path: "userB", select: "name username photo" },
  { path: "winner", select: "name slug logo" },
  { path: "winnerUser", select: "name username photo" },
  { path: "ground", select: "name location" },
  { path: "tournament", select: "name sport organizer" },
];

const UPCOMING = ["pending"];
const RESULTS = ["completed"];

function statusFilter(value: unknown) {
  const v = queryString(value);
  if (v === "upcoming") return { $in: UPCOMING };
  if (v === "results") return { $in: RESULTS };
  if (v === "awaiting") return { $in: ["reported", "disputed"] };
  return { $ne: "cancelled" };
}

/** Public fixtures and results, newest results / soonest fixtures first. */
export async function listMatches(query: Record<string, unknown>, p: Page) {
  const filter: any = { status: statusFilter(query.status) };
  const sport = queryString(query.sport);
  if (sport && isValidSportSlug(sport)) filter.sport = sport;
  const source = queryString(query.source);
  if (source === "tournament" || source === "challenge") filter.source = source;
  const sort: Record<string, 1 | -1> = queryString(query.status) === "upcoming" ? { date: 1, startTime: 1 } : { updatedAt: -1 };
  const [items, total] = await Promise.all([
    Match.find(filter).populate(MATCH_POPULATE).sort(sort).skip(p.skip).limit(p.limit),
    Match.countDocuments(filter),
  ]);
  return { matches: items, ...pageMeta(p, total) };
}

/** Matches the user plays in: as a player, or through any team they're on. */
export async function listMyMatches(user: IUser, query: Record<string, unknown>, p: Page) {
  const teams = await Team.find({ members: user._id }).select("_id");
  const teamIds = teams.map((t) => t._id);
  const filter: any = {
    status: statusFilter(query.status),
    $or: [{ userA: user._id }, { userB: user._id }, { teamA: { $in: teamIds } }, { teamB: { $in: teamIds } }],
  };
  const [items, total] = await Promise.all([
    Match.find(filter).populate(MATCH_POPULATE).sort({ date: -1, startTime: -1, createdAt: -1 }).skip(p.skip).limit(p.limit),
    Match.countDocuments(filter),
  ]);
  return { matches: items, ...pageMeta(p, total) };
}

export async function getMatch(id: string) {
  if (!isObjectIdString(id)) throw new AppError(404, "Match not found");
  const m = await Match.findById(id).populate(MATCH_POPULATE);
  if (!m) throw new AppError(404, "Match not found");
  return m;
}

/** A team's matches (both as side A and B). */
export async function listTeamMatches(teamId: string, query: Record<string, unknown>, p: Page) {
  const filter: any = { status: statusFilter(query.status), $or: [{ teamA: teamId }, { teamB: teamId }] };
  const [items, total] = await Promise.all([
    Match.find(filter).populate(MATCH_POPULATE).sort({ verifiedAt: -1, date: -1, createdAt: -1 }).skip(p.skip).limit(p.limit),
    Match.countDocuments(filter),
  ]);
  return { matches: items, ...pageMeta(p, total) };
}

/** A player's matches: one-on-one, plus team matches where they were in the reported line-up. */
export async function listPlayerMatches(userId: string, query: Record<string, unknown>, p: Page) {
  const { MatchReport } = await import("../models/MatchReport");
  const lineupMatches = await MatchReport.find({ status: "verified", "players.user": userId }).distinct("match");
  const filter: any = { status: statusFilter(query.status), $or: [{ userA: userId }, { userB: userId }, { _id: { $in: lineupMatches } }] };
  const [items, total] = await Promise.all([
    Match.find(filter).populate(MATCH_POPULATE).sort({ verifiedAt: -1, date: -1, createdAt: -1 }).skip(p.skip).limit(p.limit),
    Match.countDocuments(filter),
  ]);
  return { matches: items, ...pageMeta(p, total) };
}

/** Accept an id or a username in player URLs. */
export async function resolvePlayerId(key: string): Promise<string> {
  const { User } = await import("../models/User");
  const u = isObjectIdString(key) ? await User.findById(key).select("_id status role") : await User.findOne({ usernameKey: String(key).toLowerCase() }).select("_id status role");
  if (!u || u.status !== "active") throw new AppError(404, "Player not found");
  return u._id.toString();
}
