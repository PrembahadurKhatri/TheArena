import { Types } from "mongoose";
import { Match } from "../models/Match";
import { MatchReport, IMatchReport } from "../models/MatchReport";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString, optionalString, queryString } from "../utils/validation";
import { slotStart } from "./groundBookingsService";
import { Page, pageMeta } from "../utils/pagination";
import { canManageRoster, roleIn } from "./teamsService";
import { applyVerifiedResult, statDefinitions } from "./statsService";
import { notify } from "./notificationService";
import { audit } from "./auditService";
import { getSetting } from "./settingsService";

/** Hours the other side has to confirm or dispute before a report verifies itself. */
export const AUTO_VERIFY_HOURS = () => getSetting("reportAutoVerifyHours");

const REPORT_POPULATE = [
  { path: "submittedBy", select: "name username" },
  { path: "players.user", select: "name username photo" },
  { path: "response.by", select: "name" },
  { path: "review.by", select: "name" },
];

type Authority = "A" | "B" | "organizer";

async function loadMatch(matchId: string) {
  if (!isObjectIdString(matchId)) throw new AppError(404, "Match not found");
  const m = await Match.findById(matchId).populate([
    { path: "teamA", select: "name owner captain viceCaptain members" },
    { path: "teamB", select: "name owner captain viceCaptain members" },
    { path: "tournament", select: "name organizer sport" },
  ]);
  if (!m) throw new AppError(404, "Match not found");
  return m;
}

/**
 * Who the user can speak for in this match: side A or B (the player, or the
 * team's owner/captain), or the tournament organizer. Null = no say.
 */
export function authorityIn(m: any, user: IUser): Authority[] {
  const me = user._id.toString();
  const out: Authority[] = [];
  if (m.mode === "player") {
    if (m.userA?.toString() === me) out.push("A");
    if (m.userB?.toString() === me) out.push("B");
  } else {
    if (m.teamA && canManageRoster(roleIn(m.teamA, me))) out.push("A");
    if (m.teamB && canManageRoster(roleIn(m.teamB, me))) out.push("B");
  }
  if (m.tournament?.organizer?.toString() === me) out.push("organizer");
  return out;
}

const sideNameOf = (m: any, side: "A" | "B") => (side === "A" ? m.teamA?.name : m.teamB?.name) ?? "Player";

/** Everyone who should hear about a match result: both sides' leaders (or players) and the organizer. */
function recipients(m: any): unknown[] {
  if (m.mode === "player") return [m.userA, m.userB, m.tournament?.organizer];
  return [m.teamA?.owner, m.teamA?.captain, m.teamB?.owner, m.teamB?.captain, m.tournament?.organizer];
}

async function parsePlayers(m: any, input: unknown) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new AppError(400, "players must be an array");
  if (input.length > 60) throw new AppError(400, "At most 60 player lines");
  const sport = m.sport ?? m.tournament?.sport;
  const allowed = new Set((await statDefinitions(sport)).map((d) => d.key));
  const seen = new Set<string>();
  const lines = [];
  for (const raw of input as any[]) {
    if (!raw || !isObjectIdString(raw.user)) throw new AppError(400, "Each player line needs a user id");
    if (raw.side !== "A" && raw.side !== "B") throw new AppError(400, 'Each player line needs side "A" or "B"');
    if (seen.has(raw.user)) throw new AppError(400, "A player appears twice");
    seen.add(raw.user);
    // The player must actually belong to that side.
    if (m.mode === "player") {
      const sideUser = raw.side === "A" ? m.userA : m.userB;
      if (sideUser?.toString() !== raw.user) throw new AppError(400, "That player isn't in this match");
    } else {
      const team = raw.side === "A" ? m.teamA : m.teamB;
      if (!team?.members?.some((x: any) => x.toString() === raw.user)) throw new AppError(400, `A listed player isn't on ${team?.name ?? "that team"}`);
    }
    const stats: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.stats ?? {})) {
      if (!allowed.has(k)) throw new AppError(400, `Unknown stat for ${sport}: ${k}`);
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10000) throw new AppError(400, `${k} must be a number from 0 to 10000`);
      if (n) stats[k] = n;
    }
    lines.push({ user: new Types.ObjectId(raw.user), side: raw.side, stats });
  }
  return lines;
}

function parseResult(m: any, input: Record<string, any>) {
  const scoreA = Number(input.scoreA);
  const scoreB = Number(input.scoreB);
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 100000 || scoreB > 100000) {
    throw new AppError(400, "scoreA and scoreB must be numbers of 0 or more");
  }
  let outcome = input.outcome as "A" | "B" | "draw" | undefined;
  if (!outcome) outcome = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "draw";
  if (!["A", "B", "draw"].includes(outcome)) throw new AppError(400, 'outcome must be "A", "B" or "draw"');
  // A level score can still have a winner (penalties, super over); a higher
  // score can't lose.
  if (scoreA !== scoreB && outcome !== (scoreA > scoreB ? "A" : "B")) {
    throw new AppError(400, "The outcome doesn't match the score");
  }
  if (outcome === "draw" && m.source === "tournament" && (m.stage ?? "knockout") === "knockout") {
    throw new AppError(400, "Knockout matches need a winner (e.g. after penalties or a tie-break)");
  }
  return { scoreA, scoreB, outcome, detail: optionalString(input.detail, "detail", 200) };
}

// ---------------------------------------------------------------- submit

export async function submitReport(user: IUser, matchId: string, input: Record<string, any>) {
  const m = await loadMatch(matchId);
  const authority = authorityIn(m, user);
  if (!authority.length) throw new AppError(403, "Only the two sides (owner or captain) or the organizer can report this result");
  if (m.status === "completed") throw new AppError(400, "This match already has a verified result");
  if (m.status === "cancelled") throw new AppError(400, "This match was called off");
  if (m.status === "reported" || m.status === "disputed") throw new AppError(409, "A result is already waiting for confirmation");
  if (!m.teamA && !m.userA) throw new AppError(400, "This match has no opponents yet");
  if ((m.mode === "player" ? !m.userB : !m.teamB)) throw new AppError(400, "This match has no opponent (bye)");
  if (m.date && m.startTime && slotStart(m.date, m.startTime).getTime() > Date.now()) {
    throw new AppError(400, "You can report the result once the match has started");
  }

  const result = parseResult(m, input);
  const players = await parsePlayers(m, input.players);
  const evidence = Array.isArray(input.evidence) ? input.evidence.filter((e: unknown) => typeof e === "string").slice(0, 5) : [];
  // A side reports for itself; the organizer only when not also a side.
  const submittedFor: Authority = authority.includes("A") ? "A" : authority.includes("B") ? "B" : "organizer";

  let report: IMatchReport;
  try {
    report = await MatchReport.create({
      match: m._id,
      submittedBy: user._id,
      submittedFor,
      ...result,
      players,
      evidence,
      notes: optionalString(input.notes, "notes", 1000),
      status: "submitted",
    });
  } catch (err: any) {
    if (err?.code === 11000) throw new AppError(409, "A result is already waiting for confirmation");
    throw err;
  }
  const flipped = await Match.updateOne({ _id: m._id, status: "pending" }, { $set: { status: "reported" } });
  if (!flipped.modifiedCount) {
    await MatchReport.deleteOne({ _id: report._id });
    throw new AppError(409, "The match changed in the meantime; reload and try again");
  }

  await notify(recipients(m) as any, {
    type: "match.report_submitted",
    title: `Result submitted: ${sideNameOf(m, "A")} ${result.scoreA}–${result.scoreB} ${sideNameOf(m, "B")}`,
    body: `Confirm or dispute it within ${AUTO_VERIFY_HOURS()} hours, or it becomes official.`,
    link: `/matches/${m._id}`,
    entity: { type: "match", id: m._id },
    actor: user._id,
  });
  return report;
}

// ---------------------------------------------------------------- respond

async function liveReportOrThrow(reportId: string) {
  if (!isObjectIdString(reportId)) throw new AppError(404, "Report not found");
  const r = await MatchReport.findById(reportId);
  if (!r) throw new AppError(404, "Report not found");
  return r;
}

/** The other side: anyone with authority who isn't the submitter's side. */
function canRespond(report: IMatchReport, authority: Authority[], user: IUser) {
  if (report.submittedBy.equals(user._id)) return false;
  if (report.submittedFor === "organizer") return authority.includes("A") || authority.includes("B");
  const other = report.submittedFor === "A" ? "B" : "A";
  return authority.includes(other) || authority.includes("organizer");
}

export async function confirmReport(user: IUser, reportId: string) {
  const report = await liveReportOrThrow(reportId);
  if (report.status !== "submitted") throw new AppError(400, `This report is already ${report.status}`);
  const m = await loadMatch(report.match.toString());
  if (!canRespond(report, authorityIn(m, user), user)) throw new AppError(403, "Only the other side can confirm this result");
  const updated = await MatchReport.findOneAndUpdate(
    { _id: report._id, status: "submitted" },
    { $set: { status: "verified", verifiedHow: "confirmed", verifiedAt: new Date(), response: { by: user._id, action: "confirmed", at: new Date() } } },
    { new: true }
  );
  if (!updated) throw new AppError(409, "This report was answered in the meantime");
  await applyVerifiedResult(m, updated);
  await notify(recipients(m) as any, {
    type: "match.result_verified",
    title: `Result confirmed: ${sideNameOf(m, "A")} ${updated.scoreA}–${updated.scoreB} ${sideNameOf(m, "B")}`,
    link: `/matches/${m._id}`,
    entity: { type: "match", id: m._id },
    actor: user._id,
  });
  return updated;
}

export async function disputeReport(user: IUser, reportId: string, reasonInput: unknown) {
  const report = await liveReportOrThrow(reportId);
  if (report.status !== "submitted") throw new AppError(400, `This report is already ${report.status}`);
  const m = await loadMatch(report.match.toString());
  if (!canRespond(report, authorityIn(m, user), user)) throw new AppError(403, "Only the other side can dispute this result");
  const reason = optionalString(reasonInput, "reason", 1000);
  if (!reason || reason.length < 5) throw new AppError(400, "Say what's wrong with the result (at least 5 characters)");
  const updated = await MatchReport.findOneAndUpdate(
    { _id: report._id, status: "submitted" },
    { $set: { status: "disputed", response: { by: user._id, action: "disputed", reason, at: new Date() } } },
    { new: true }
  );
  if (!updated) throw new AppError(409, "This report was answered in the meantime");
  await Match.updateOne({ _id: m._id, status: "reported" }, { $set: { status: "disputed" } });
  await notify(recipients(m) as any, {
    type: "match.report_disputed",
    title: `The result of ${sideNameOf(m, "A")} vs ${sideNameOf(m, "B")} was disputed`,
    body: "The Arena's staff will review it. Records won't change until then.",
    link: `/matches/${m._id}`,
    entity: { type: "match", id: m._id },
    actor: user._id,
  });
  return updated;
}

export async function withdrawReport(user: IUser, reportId: string) {
  const report = await liveReportOrThrow(reportId);
  if (!report.submittedBy.equals(user._id)) throw new AppError(403, "Only the person who submitted it can withdraw it");
  const updated = await MatchReport.findOneAndUpdate({ _id: report._id, status: "submitted" }, { $set: { status: "withdrawn" } }, { new: true });
  if (!updated) throw new AppError(400, "Only a report nobody has answered yet can be withdrawn");
  await Match.updateOne({ _id: report.match, status: "reported" }, { $set: { status: "pending" } });
  return updated;
}

// ---------------------------------------------------------------- reads

export async function listReportsForMatch(matchId: string) {
  if (!isObjectIdString(matchId)) throw new AppError(404, "Match not found");
  return MatchReport.find({ match: matchId }).sort({ createdAt: -1 }).populate(REPORT_POPULATE);
}

export async function myAuthority(user: IUser | undefined, matchId: string) {
  if (!user) return [];
  const m = await loadMatch(matchId);
  return authorityIn(m, user);
}

// ---------------------------------------------------------------- staff

export async function adminListReports(query: Record<string, unknown>, p: Page) {
  const status = queryString(query.status) ?? "disputed";
  const filter: any = ["submitted", "disputed", "verified", "rejected", "withdrawn"].includes(status) ? { status } : { status: "disputed" };
  const [items, total] = await Promise.all([
    MatchReport.find(filter)
      .sort({ updatedAt: -1 })
      .skip(p.skip)
      .limit(p.limit)
      .populate([
        ...REPORT_POPULATE,
        { path: "match", populate: [{ path: "teamA", select: "name" }, { path: "teamB", select: "name" }, { path: "userA", select: "name" }, { path: "userB", select: "name" }, { path: "tournament", select: "name" }] },
      ]),
    MatchReport.countDocuments(filter),
  ]);
  return { reports: items, ...pageMeta(p, total) };
}

/**
 * Staff decision on a disputed report: verify it as submitted, verify an
 * amended score, or void it (the match goes back to awaiting a result).
 */
export async function resolveDispute(actor: IUser, reportId: string, input: Record<string, any>) {
  const report = await liveReportOrThrow(reportId);
  if (report.status !== "disputed") throw new AppError(400, "Only disputed reports are resolved by staff");
  const decision = input.decision;
  if (!["verify", "amend", "void"].includes(decision)) throw new AppError(400, 'decision must be "verify", "amend" or "void"');
  const note = optionalString(input.note, "note", 1000);
  if (!note) throw new AppError(400, "Explain the decision in a note");
  const m = await loadMatch(report.match.toString());
  const before = { scoreA: report.scoreA, scoreB: report.scoreB, outcome: report.outcome };

  if (decision === "void") {
    await MatchReport.updateOne({ _id: report._id, status: "disputed" }, { $set: { status: "rejected", review: { by: actor._id, decision: "voided", note, at: new Date() } } });
    await Match.updateOne({ _id: m._id, status: "disputed" }, { $set: { status: "pending" } });
  } else {
    const $set: Record<string, unknown> = {
      status: "verified",
      verifiedHow: "staff",
      verifiedAt: new Date(),
      review: { by: actor._id, decision: decision === "amend" ? "amended" : "verified", note, at: new Date() },
    };
    if (decision === "amend") Object.assign($set, parseResult(m, input));
    const updated = await MatchReport.findOneAndUpdate({ _id: report._id, status: "disputed" }, { $set }, { new: true });
    if (!updated) throw new AppError(409, "This report was resolved in the meantime");
    await applyVerifiedResult(m, updated);
  }

  const fresh = await MatchReport.findById(report._id);
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: `match_report.${decision === "void" ? "voided" : decision === "amend" ? "amended" : "verified"}`,
    target: { type: "match_report", id: report._id },
    before,
    after: { scoreA: fresh!.scoreA, scoreB: fresh!.scoreB, outcome: fresh!.outcome, status: fresh!.status },
    reason: note,
  });
  await notify(recipients(m) as any, {
    type: "match.result_verified",
    title:
      decision === "void"
        ? `The disputed result of ${sideNameOf(m, "A")} vs ${sideNameOf(m, "B")} was voided; please report it again`
        : `Staff confirmed the result: ${sideNameOf(m, "A")} ${fresh!.scoreA}–${fresh!.scoreB} ${sideNameOf(m, "B")}`,
    body: note,
    link: `/matches/${m._id}`,
    entity: { type: "match", id: m._id },
  });
  return fresh;
}

// ---------------------------------------------------------------- sweeper

/** Reports nobody answered within AUTO_VERIFY_HOURS become official. */
export async function autoVerifyReports() {
  const cutoff = new Date(Date.now() - AUTO_VERIFY_HOURS() * 60 * 60 * 1000);
  const due = await MatchReport.find({ status: "submitted", createdAt: { $lt: cutoff } }).limit(200);
  let n = 0;
  for (const r of due) {
    const updated = await MatchReport.findOneAndUpdate(
      { _id: r._id, status: "submitted" },
      { $set: { status: "verified", verifiedHow: "auto", verifiedAt: new Date() } },
      { new: true }
    );
    if (!updated) continue;
    const m = await Match.findById(r.match).populate([
      { path: "teamA", select: "name owner captain" },
      { path: "teamB", select: "name owner captain" },
      { path: "tournament", select: "name organizer sport" },
    ]);
    if (!m) continue;
    await applyVerifiedResult(m, updated);
    n += 1;
    await notify(recipients(m) as any, {
      type: "match.result_verified",
      title: `Result is now official: ${sideNameOf(m, "A")} ${updated.scoreA}–${updated.scoreB} ${sideNameOf(m, "B")}`,
      body: `Nobody disputed it within ${AUTO_VERIFY_HOURS()} hours.`,
      link: `/matches/${m._id}`,
      entity: { type: "match", id: m._id },
    });
  }
  return n;
}

