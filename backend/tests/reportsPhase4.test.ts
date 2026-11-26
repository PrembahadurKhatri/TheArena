import { api, auth, futureDate, registerStaff, registerUser } from "./helpers";
import { Match } from "../src/models/Match";
import { MatchReport } from "../src/models/MatchReport";
import { Challenge } from "../src/models/Challenge";
import { TeamSportStats, PlayerSportStats } from "../src/models/SportStats";
import { User } from "../src/models/User";
import { autoVerifyReports } from "../src/services/matchReportsService";

/** An accepted one-on-one match whose start time has already passed. */
async function playedPlayerMatch(sport = "tennis") {
  const a = await registerUser();
  const b = await registerUser();
  const c = await api().post("/api/challenges").set(auth(a.token)).send({ sport, mode: "player", opponentUserId: b.id, date: futureDate(3), startTime: "09:00", endTime: "10:00" });
  await api().post(`/api/challenges/${c.body.challenge.id}/accept`).set(auth(b.token)).send({});
  const m = await Match.findOne({ challenge: c.body.challenge.id });
  await Match.updateOne({ _id: m!._id }, { $set: { date: "2024-01-01" } });
  return { a, b, matchId: m!._id.toString(), challengeId: c.body.challenge.id as string };
}

async function playedTeamMatch(sport = "football") {
  const ownerA = await registerUser();
  const ownerB = await registerUser();
  const teamA = (await api().post("/api/teams").set(auth(ownerA.token)).send({ name: `Home ${Math.random()}`, sport })).body.team.id;
  const teamB = (await api().post("/api/teams").set(auth(ownerB.token)).send({ name: `Away ${Math.random()}`, sport })).body.team.id;
  const striker = await registerUser();
  await api().post(`/api/teams/${teamA}/invitations`).set(auth(ownerA.token)).send({ userId: striker.id });
  await api().post(`/api/teams/${teamA}/invitations/respond`).set(auth(striker.token)).send({ action: "accept" });
  const c = await api().post("/api/challenges").set(auth(ownerA.token)).send({ sport, mode: "team", teamId: teamA, opponentTeamId: teamB, date: futureDate(3), startTime: "09:00", endTime: "10:00" });
  await api().post(`/api/challenges/${c.body.challenge.id}/accept`).set(auth(ownerB.token)).send({});
  const m = await Match.findOne({ challenge: c.body.challenge.id });
  await Match.updateOne({ _id: m!._id }, { $set: { date: "2024-01-01" } });
  return { ownerA, ownerB, teamA, teamB, striker, matchId: m!._id.toString() };
}

const report = (token: string, matchId: string, body: object) => api().post(`/api/matches/${matchId}/reports`).set(auth(token)).send(body);

describe("submitting a result", () => {
  it("only the two sides can report, only after the start, and only once at a time", async () => {
    const { a, matchId } = await playedPlayerMatch();
    const stranger = await registerUser();
    expect((await report(stranger.token, matchId, { scoreA: 2, scoreB: 1 })).status).toBe(403);

    await Match.updateOne({ _id: matchId }, { $set: { date: futureDate(2) } });
    expect((await report(a.token, matchId, { scoreA: 2, scoreB: 1 })).status).toBe(400);
    await Match.updateOne({ _id: matchId }, { $set: { date: "2024-01-01" } });

    const r = await report(a.token, matchId, { scoreA: 2, scoreB: 1 });
    expect(r.status).toBe(201);
    expect(r.body.report.outcome).toBe("A");
    expect((await Match.findById(matchId))!.status).toBe("reported");
    expect((await report(a.token, matchId, { scoreA: 3, scoreB: 1 })).status).toBe(409);
  });

  it("rejects results that contradict the score", async () => {
    const { a, matchId } = await playedPlayerMatch();
    expect((await report(a.token, matchId, { scoreA: 1, scoreB: 3, outcome: "A" })).status).toBe(400);
    expect((await report(a.token, matchId, { scoreA: -1, scoreB: 3 })).status).toBe(400);
  });

  it("an unconfirmed result changes no records", async () => {
    const { a, b, matchId } = await playedPlayerMatch();
    await report(a.token, matchId, { scoreA: 2, scoreB: 0 });
    expect(await PlayerSportStats.countDocuments()).toBe(0);
    expect((await api().get(`/api/players/${b.id}/stats`)).body.records).toEqual([]);
  });
});

describe("confirming and disputing", () => {
  it("the other side confirms; records, the match and the challenge update once", async () => {
    const { a, b, matchId, challengeId } = await playedPlayerMatch();
    const r = await report(a.token, matchId, { scoreA: 2, scoreB: 1 });
    const rid = r.body.report.id;

    expect((await api().post(`/api/matches/reports/${rid}/confirm`).set(auth(a.token))).status).toBe(403);
    const both = await Promise.all([
      api().post(`/api/matches/reports/${rid}/confirm`).set(auth(b.token)),
      api().post(`/api/matches/reports/${rid}/confirm`).set(auth(b.token)),
    ]);
    expect(both.filter((x) => x.status === 200)).toHaveLength(1);

    const m = await Match.findById(matchId);
    expect(m!.status).toBe("completed");
    expect(m!.winnerUser!.toString()).toBe(a.id);
    expect((await Challenge.findById(challengeId))!.status).toBe("completed");
    const sa = await PlayerSportStats.findOne({ user: a.id, sport: "tennis" });
    const sb = await PlayerSportStats.findOne({ user: b.id, sport: "tennis" });
    expect([sa!.matches, sa!.wins, sb!.losses]).toEqual([1, 1, 1]);

    // A verified match can't be reported again.
    expect((await report(b.token, matchId, { scoreA: 0, scoreB: 5 })).status).toBe(400);
  });

  it("a dispute freezes the result until staff decide; amending verifies the corrected score", async () => {
    const { a, b, matchId } = await playedPlayerMatch();
    const rid = (await report(a.token, matchId, { scoreA: 3, scoreB: 0 })).body.report.id;
    expect((await api().post(`/api/matches/reports/${rid}/dispute`).set(auth(b.token)).send({ reason: "no" })).status).toBe(400);
    expect((await api().post(`/api/matches/reports/${rid}/dispute`).set(auth(b.token)).send({ reason: "It finished 1-3, we won" })).status).toBe(200);
    expect((await Match.findById(matchId))!.status).toBe("disputed");
    expect(await PlayerSportStats.countDocuments()).toBe(0);

    const player = await registerUser();
    expect((await api().post(`/api/admin/match-reports/${rid}/resolve`).set(auth(player.token)).send({ decision: "verify", note: "x" })).status).toBe(403);
    const viewer = await registerStaff(["reports.verify"]);
    expect((await api().get("/api/admin/match-reports").set(auth(viewer.token))).body.reports).toHaveLength(1);
    expect((await api().post(`/api/admin/match-reports/${rid}/resolve`).set(auth(viewer.token)).send({ decision: "verify", note: "x" })).status).toBe(403);

    const judge = await registerStaff(["disputes.resolve"]);
    const res = await api().post(`/api/admin/match-reports/${rid}/resolve`).set(auth(judge.token)).send({ decision: "amend", scoreA: 1, scoreB: 3, note: "Video shows 1-3" });
    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe("verified");
    const m = await Match.findById(matchId);
    expect(m!.winnerUser!.toString()).toBe(b.id);
    expect((await PlayerSportStats.findOne({ user: b.id }))!.wins).toBe(1);
  });

  it("voiding sends the match back for a new report", async () => {
    const { a, b, matchId } = await playedPlayerMatch();
    const rid = (await report(a.token, matchId, { scoreA: 3, scoreB: 0 })).body.report.id;
    await api().post(`/api/matches/reports/${rid}/dispute`).set(auth(b.token)).send({ reason: "We never played" });
    const judge = await registerStaff(["disputes.resolve"]);
    await api().post(`/api/admin/match-reports/${rid}/resolve`).set(auth(judge.token)).send({ decision: "void", note: "No evidence either way" });
    expect((await Match.findById(matchId))!.status).toBe("pending");
    expect((await report(b.token, matchId, { scoreA: 0, scoreB: 0 })).status).toBe(201);
  });

  it("the submitter can withdraw an unanswered report", async () => {
    const { a, matchId } = await playedPlayerMatch();
    const rid = (await report(a.token, matchId, { scoreA: 1, scoreB: 0 })).body.report.id;
    expect((await api().post(`/api/matches/reports/${rid}/withdraw`).set(auth(a.token))).status).toBe(200);
    expect((await Match.findById(matchId))!.status).toBe("pending");
  });

  it("unanswered reports verify themselves after the window", async () => {
    const { a, b, matchId } = await playedPlayerMatch();
    const rid = (await report(a.token, matchId, { scoreA: 1, scoreB: 0 })).body.report.id;
    expect(await autoVerifyReports()).toBe(0);
    await MatchReport.collection.updateOne({ _id: (await MatchReport.findById(rid))!._id }, { $set: { createdAt: new Date(Date.now() - 73 * 3600_000) } });
    expect(await autoVerifyReports()).toBe(1);
    expect((await MatchReport.findById(rid))!.verifiedHow).toBe("auto");
    expect((await PlayerSportStats.findOne({ user: b.id }))!.losses).toBe(1);
    expect((await Match.findById(matchId))!.status).toBe("completed");
    void a;
  });
});

describe("team results and sport-specific stats", () => {
  it("line-up players get their stats; team records update; strangers can't be in the line-up", async () => {
    const { ownerA, ownerB, teamA, teamB, striker, matchId } = await playedTeamMatch();
    const outsider = await registerUser();
    expect((await report(ownerA.token, matchId, { scoreA: 2, scoreB: 1, players: [{ user: outsider.id, side: "A", stats: { goals: 2 } }] })).status).toBe(400);
    expect((await report(ownerA.token, matchId, { scoreA: 2, scoreB: 1, players: [{ user: striker.id, side: "A", stats: { runs: 50 } }] })).status).toBe(400);

    const rid = (await report(ownerA.token, matchId, { scoreA: 2, scoreB: 1, players: [{ user: striker.id, side: "A", stats: { goals: 2, assists: 0 } }] })).body.report.id;
    await api().post(`/api/matches/reports/${rid}/confirm`).set(auth(ownerB.token));

    const home = await TeamSportStats.findOne({ team: teamA, sport: "football" });
    const away = await TeamSportStats.findOne({ team: teamB, sport: "football" });
    expect([home!.wins, home!.scoreFor, away!.losses, away!.scoreAgainst]).toEqual([1, 2, 1, 2]);
    const s = await PlayerSportStats.findOne({ user: striker.id, sport: "football" });
    expect(s!.totals.get("goals")).toBe(2);

    const teamRes = await api().get(`/api/teams/${teamA}/stats`);
    expect(teamRes.body.records[0]).toMatchObject({ sport: "football", matches: 1, wins: 1, winPct: 100 });
    expect(teamRes.body.currentStreak).toBe("W1");
    expect((await api().get(`/api/teams/${teamA}/matches?status=results`)).body.matches).toHaveLength(1);
    expect((await api().get(`/api/players/${striker.id}/matches`)).body.matches).toHaveLength(1);
  });

  it("detailed stats show for Premium players and to the player; others see the basic record", async () => {
    const { ownerA, ownerB, striker, matchId } = await playedTeamMatch();
    const rid = (await report(ownerA.token, matchId, { scoreA: 1, scoreB: 0, players: [{ user: striker.id, side: "A", stats: { goals: 1 } }] })).body.report.id;
    await api().post(`/api/matches/reports/${rid}/confirm`).set(auth(ownerB.token));

    const publicView = await api().get(`/api/players/${striker.id}/stats`);
    expect(publicView.body.records[0].detailed).toBe(false);
    expect(publicView.body.records[0].totals).toBeUndefined();

    const selfView = await api().get(`/api/players/${striker.id}/stats`).set(auth(striker.token));
    expect(selfView.body.records[0].totals.find((t: any) => t.key === "goals").value).toBe(1);
    expect(selfView.body.records[0].derived.goals_per_match).toBe(1);

    await User.updateOne({ _id: striker.id }, { $set: { isPremium: true, membershipExpiresAt: new Date(Date.now() + 86_400_000) } });
    expect((await api().get(`/api/players/${striker.id}/stats`)).body.records[0].detailed).toBe(true);
  });

  it("the match page tells each viewer what they can do", async () => {
    const { ownerA, striker, matchId } = await playedTeamMatch();
    expect((await api().get(`/api/matches/${matchId}`).set(auth(ownerA.token))).body.viewerAuthority).toEqual(["A"]);
    expect((await api().get(`/api/matches/${matchId}`).set(auth(striker.token))).body.viewerAuthority).toEqual([]);
    const page = await api().get(`/api/matches/${matchId}`);
    expect(page.body.statDefinitions.map((d: any) => d.key)).toContain("goals");
  });
});
