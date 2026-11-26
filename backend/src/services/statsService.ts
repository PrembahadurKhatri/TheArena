import { Types } from "mongoose";
import { Match, IMatch } from "../models/Match";
import { IMatchReport } from "../models/MatchReport";
import { Challenge } from "../models/Challenge";
import { Sport } from "../models/Sport";
import { TeamSportStats, PlayerSportStats } from "../models/SportStats";
import { AppError } from "../utils/AppError";
import { isObjectIdString } from "../utils/validation";
import { derivedStats, statDefinitionsFor } from "../utils/sportStats";
import { getEntitlements } from "./entitlementsService";
import { User } from "../models/User";

type Outcome = "win" | "loss" | "draw";

function recordInc(outcome: Outcome, scoreFor: number, scoreAgainst: number) {
  return {
    matches: 1,
    wins: outcome === "win" ? 1 : 0,
    losses: outcome === "loss" ? 1 : 0,
    draws: outcome === "draw" ? 1 : 0,
    scoreFor,
    scoreAgainst,
  };
}

const outcomeFor = (side: "A" | "B", result: "A" | "B" | "draw"): Outcome => (result === "draw" ? "draw" : result === side ? "win" : "loss");

export async function statDefinitions(sport: string) {
  const s = await Sport.findOne({ slug: sport }).select("statDefinitions").lean();
  return statDefinitionsFor(sport, (s as any)?.statDefinitions);
}

/**
 * Make a verified result official, exactly once: the match's final score,
 * team and player records, the linked challenge, and the tournament bracket.
 * The atomic status flip on the match is the guard: a second call (double
 * confirm, sweeper and a person at once) finds nothing to update and stops.
 */
export async function applyVerifiedResult(match: IMatch, report: IMatchReport) {
  const isTeam = match.mode !== "player";
  const result = report.outcome;
  const $set: Record<string, unknown> = {
    scoreA: report.scoreA,
    scoreB: report.scoreB,
    isDraw: result === "draw",
    winner: isTeam && result !== "draw" ? (result === "A" ? match.teamA : match.teamB) : null,
    winnerUser: !isTeam && result !== "draw" ? (result === "A" ? match.userA : match.userB) : null,
    status: "completed",
    verifiedAt: new Date(),
  };
  const done = await Match.findOneAndUpdate(
    { _id: match._id, status: { $in: ["pending", "reported", "disputed"] }, verifiedAt: null },
    { $set },
    { new: true }
  );
  if (!done) return null;

  const sport = done.sport ?? (await sportOfTournament(done));
  const now = new Date();
  const jobs: Promise<unknown>[] = [];

  if (isTeam) {
    for (const side of ["A", "B"] as const) {
      const team = side === "A" ? done.teamA : done.teamB;
      if (!team) continue;
      const own = side === "A" ? report.scoreA : report.scoreB;
      const opp = side === "A" ? report.scoreB : report.scoreA;
      jobs.push(
        TeamSportStats.updateOne(
          { team, sport },
          { $inc: recordInc(outcomeFor(side, result), own, opp), $set: { lastMatchAt: now } },
          { upsert: true }
        )
      );
    }
  }

  // Players: everyone in the reported line-up (team matches), or the two
  // players themselves (one-on-one matches, even without per-player stats).
  const lines = new Map<string, { side: "A" | "B"; stats: Map<string, number> | Record<string, number> }>();
  for (const l of report.players ?? []) lines.set(l.user.toString(), { side: l.side, stats: l.stats });
  if (!isTeam) {
    if (done.userA && !lines.has(done.userA.toString())) lines.set(done.userA.toString(), { side: "A", stats: {} });
    if (done.userB && !lines.has(done.userB.toString())) lines.set(done.userB.toString(), { side: "B", stats: {} });
  }
  for (const [userId, line] of lines) {
    const own = line.side === "A" ? report.scoreA : report.scoreB;
    const opp = line.side === "A" ? report.scoreB : report.scoreA;
    const inc: Record<string, number> = recordInc(outcomeFor(line.side, result), own, opp);
    const entries = line.stats instanceof Map ? [...line.stats.entries()] : Object.entries(line.stats ?? {});
    for (const [k, v] of entries) if (Number(v)) inc[`totals.${k}`] = Number(v);
    jobs.push(PlayerSportStats.updateOne({ user: new Types.ObjectId(userId), sport }, { $inc: inc, $set: { lastMatchAt: now } }, { upsert: true }));
  }
  await Promise.all(jobs);

  if (done.challenge) await Challenge.updateOne({ _id: done.challenge, status: "accepted" }, { $set: { status: "completed" } });
  if (done.tournament) {
    // Lazy import: tournamentsService imports the report flow.
    const { onMatchVerified } = await import("./tournamentsService");
    await onMatchVerified(done);
  }
  return done;
}

async function sportOfTournament(m: IMatch): Promise<string> {
  if (!m.tournament) return "unknown";
  const { Tournament } = await import("../models/Tournament");
  const t = await Tournament.findById(m.tournament).select("sport").lean();
  return (t as any)?.sport ?? "unknown";
}

function recordJSON(r: any) {
  const played = r.matches ?? 0;
  return {
    sport: r.sport,
    matches: played,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    draws: r.draws ?? 0,
    winPct: played ? Math.round(((r.wins ?? 0) / played) * 1000) / 10 : 0,
    scoreFor: r.scoreFor ?? 0,
    scoreAgainst: r.scoreAgainst ?? 0,
    lastMatchAt: r.lastMatchAt ?? null,
  };
}

/** "W3" / "L1" / "D2": the run of identical results ending with the latest match. */
async function streak(filter: Record<string, unknown>, sideOf: (m: any) => "A" | "B" | null) {
  const recent = await Match.find({ ...filter, status: "completed" }).sort({ verifiedAt: -1 }).limit(20).lean();
  let kind: "W" | "L" | "D" | null = null;
  let n = 0;
  for (const m of recent) {
    const side = sideOf(m);
    if (!side) continue;
    const ownId = (side === "A" ? m.teamA ?? m.userA : m.teamB ?? m.userB)?.toString();
    const winId = (m.winner ?? m.winnerUser)?.toString();
    const k = m.isDraw ? "D" : winId && winId === ownId ? "W" : "L";
    if (kind === null) kind = k;
    if (k !== kind) break;
    n += 1;
  }
  return kind ? `${kind}${n}` : null;
}

export async function teamStats(teamId: string) {
  if (!isObjectIdString(teamId)) throw new AppError(404, "Team not found");
  const id = new Types.ObjectId(teamId);
  const rows = await TeamSportStats.find({ team: id }).lean();
  const current = await streak({ $or: [{ teamA: id }, { teamB: id }] }, (m) => (m.teamA?.equals(id) ? "A" : m.teamB?.equals(id) ? "B" : null));
  return {
    records: rows.map((r: any) => ({ ...recordJSON(r), tournamentsPlayed: r.tournamentsPlayed ?? 0, tournamentsWon: r.tournamentsWon ?? 0 })),
    currentStreak: current,
  };
}

/**
 * A player's records per sport. Everyone sees the basic record; the per-sport
 * stat totals and derived figures are a Premium profile feature (shown when
 * the player has Premium, and always to the player themselves).
 */
export async function playerStats(userId: string, viewerId?: string) {
  if (!isObjectIdString(userId)) throw new AppError(404, "Player not found");
  const user = await User.findById(userId).select("isPremium membershipExpiresAt");
  if (!user) throw new AppError(404, "Player not found");
  const detailed = getEntitlements(user).advancedStats || viewerId === userId;
  const rows = await PlayerSportStats.find({ user: userId }).lean();
  const out = [];
  for (const r of rows as any[]) {
    const totals: Record<string, number> = r.totals instanceof Map ? Object.fromEntries(r.totals) : r.totals ?? {};
    const base = recordJSON(r);
    if (!detailed) {
      out.push({ ...base, detailed: false });
      continue;
    }
    const defs = await statDefinitions(r.sport);
    out.push({
      ...base,
      detailed: true,
      totals: defs.map((d) => ({ key: d.key, label: d.label, value: totals[d.key] ?? 0 })),
      derived: derivedStats(r.sport, totals, base.matches),
    });
  }
  const id = new Types.ObjectId(userId);
  const current = await streak({ $or: [{ userA: id }, { userB: id }] }, (m) => (m.userA?.equals(id) ? "A" : m.userB?.equals(id) ? "B" : null));
  return { records: out, currentStreak: current, detailedStatsAvailable: detailed };
}
