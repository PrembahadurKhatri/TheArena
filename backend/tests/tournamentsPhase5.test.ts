import { api, auth, futureDate, registerStaff, registerUser } from "./helpers";
import { User } from "../src/models/User";
import { Match } from "../src/models/Match";
import { Tournament } from "../src/models/Tournament";
import { TeamSportStats } from "../src/models/SportStats";
import { Notification } from "../src/models/Notification";

type U = Awaited<ReturnType<typeof registerUser>>;

async function premium() {
  const u = await registerUser();
  await User.updateOne({ _id: u.id }, { $set: { isPremium: true, membershipExpiresAt: new Date(Date.now() + 30 * 86_400_000) } });
  return u;
}

async function createTournament(org: U, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/tournaments")
    .set(auth(org.token))
    .send({ name: `Cup ${Math.random().toString(36).slice(2, 7)}`, sport: "football", maxTeams: 8, startDate: futureDate(20), province: "Bagmati Province", ...extra });
  if (res.status !== 201) throw new Error(`create ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.tournament.id as string;
}

/** n teams, each with its own owner, registered and approved. */
async function fill(tid: string, org: U, n: number) {
  const owners: U[] = [];
  const teams: string[] = [];
  for (let i = 0; i < n; i++) {
    const o = await registerUser();
    const team = await api().post("/api/teams").set(auth(o.token)).send({ name: `FC ${tid.slice(-4)} ${i} ${Math.random()}`, sport: "football" });
    const reg = await api().post(`/api/tournaments/${tid}/registrations`).set(auth(o.token)).send({ teamId: team.body.team.id });
    await api().patch(`/api/tournaments/${tid}/registrations/${reg.body.registration.id}`).set(auth(org.token)).send({ action: "approve" });
    owners.push(o);
    teams.push(team.body.team.id);
  }
  return { owners, teams };
}

async function approveAndStart(tid: string, org: U) {
  expect((await api().post(`/api/tournaments/${tid}/submit-review`).set(auth(org.token))).status).toBe(200);
  const reviewer = await registerStaff(["tournaments.review"]);
  expect((await api().post(`/api/admin/tournaments/${tid}/review`).set(auth(reviewer.token)).send({ decision: "approve" })).status).toBe(200);
  const started = await api().post(`/api/tournaments/${tid}/start`).set(auth(org.token));
  expect(started.status).toBe(200);
  return started.body.matches as any[];
}

/** Organizer reports, a team owner confirms. Side A wins unless told otherwise. */
async function play(matchId: string, org: U, ownerOf: Map<string, U>, scoreA = 2, scoreB = 1) {
  const m = await Match.findById(matchId);
  const tid = m!.tournament!.toString();
  const r = await api().patch(`/api/tournaments/${tid}/matches/${matchId}`).set(auth(org.token)).send({ scoreA, scoreB });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const report = (await api().get(`/api/matches/${matchId}`)).body.reports[0];
  const confirmer = ownerOf.get(m!.teamA!.toString())!;
  expect((await api().post(`/api/matches/reports/${report.id}/confirm`).set(auth(confirmer.token))).status).toBe(200);
}

describe("creating tournaments", () => {
  it("needs Premium, at least 4 teams and a valid format", async () => {
    const free = await registerUser();
    expect((await api().post("/api/tournaments").set(auth(free.token)).send({ name: "Free Cup", sport: "football", maxTeams: 8, startDate: futureDate(10), province: "Bagmati Province" })).status).toBe(403);
    const org = await premium();
    const base = { name: "Bad Cup", sport: "football", startDate: futureDate(10), province: "Bagmati Province" };
    expect((await api().post("/api/tournaments").set(auth(org.token)).send({ ...base, maxTeams: 3 })).status).toBe(400);
    expect((await api().post("/api/tournaments").set(auth(org.token)).send({ ...base, maxTeams: 8, minTeams: 2 })).status).toBe(400);
    expect((await api().post("/api/tournaments").set(auth(org.token)).send({ ...base, maxTeams: 8, format: "swiss" })).status).toBe(400);
    const ok = await api().post("/api/tournaments").set(auth(org.token)).send({ ...base, name: "Good Cup", maxTeams: 8, format: "league", prizes: "Rs 20,000", entryFee: 500 });
    expect(ok.status).toBe(201);
    expect(ok.body.tournament).toMatchObject({ status: "open", format: "league", minTeams: 4, entryFee: 500, slug: "good-cup" });
  });
});

describe("registration", () => {
  it("team owners or captains request; the organizer approves; plain players can't", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    const owner = await registerUser();
    const team = (await api().post("/api/teams").set(auth(owner.token)).send({ name: "Requesters FC", sport: "football" })).body.team.id;
    const player = await registerUser();
    await api().post(`/api/teams/${team}/invitations`).set(auth(owner.token)).send({ userId: player.id });
    await api().post(`/api/teams/${team}/invitations/respond`).set(auth(player.token)).send({ action: "accept" });

    expect((await api().post(`/api/tournaments/${tid}/registrations`).set(auth(player.token)).send({ teamId: team })).status).toBe(403);
    const reg = await api().post(`/api/tournaments/${tid}/registrations`).set(auth(owner.token)).send({ teamId: team });
    expect(reg.status).toBe(201);
    expect(reg.body.registration.status).toBe("requested");
    expect(await Notification.countDocuments({ recipient: org.id, type: "tournament.registration" })).toBe(1);
    expect((await api().post(`/api/tournaments/${tid}/registrations`).set(auth(owner.token)).send({ teamId: team })).status).toBe(400);

    // Only the organizer decides.
    expect((await api().patch(`/api/tournaments/${tid}/registrations/${reg.body.registration.id}`).set(auth(owner.token)).send({ action: "approve" })).status).toBe(403);
    const approved = await api().patch(`/api/tournaments/${tid}/registrations/${reg.body.registration.id}`).set(auth(org.token)).send({ action: "approve" });
    expect(approved.body.registrations[0].status).toBe("approved");
    expect(approved.body.tournament.teamsCount).toBe(1);
  });

  it("wrong-sport teams are refused", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    const owner = await registerUser();
    const team = (await api().post("/api/teams").set(auth(owner.token)).send({ name: "Cricketers", sport: "cricket" })).body.team.id;
    expect((await api().post(`/api/tournaments/${tid}/registrations`).set(auth(owner.token)).send({ teamId: team })).status).toBe(400);
  });
});

describe("the 4-team rule and staff approval", () => {
  it("can't go for review with fewer than 4 approved teams; staff approval is required to start", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    await fill(tid, org, 3);
    expect((await api().post(`/api/tournaments/${tid}/submit-review`).set(auth(org.token))).status).toBe(400);
    expect((await api().post(`/api/tournaments/${tid}/start`).set(auth(org.token))).status).toBe(400);

    await fill(tid, org, 1);
    const detail = await api().get(`/api/tournaments/${tid}`).set(auth(org.token));
    expect(detail.body.eligibility).toMatchObject({ approvedTeams: 4, readyForReview: true });
    // Four eligible teams make it eligible for review; they don't start it.
    expect(detail.body.tournament.status).toBe("open");

    expect((await api().post(`/api/tournaments/${tid}/submit-review`).set(auth(org.token))).body.tournament.status).toBe("under_review");
    expect((await api().post(`/api/tournaments/${tid}/start`).set(auth(org.token))).status).toBe(400);

    const nobody = await registerStaff([]);
    expect((await api().post(`/api/admin/tournaments/${tid}/review`).set(auth(nobody.token)).send({ decision: "approve" })).status).toBe(403);
    const reviewer = await registerStaff(["tournaments.review"]);
    expect((await api().get("/api/admin/tournaments").set(auth(reviewer.token))).body.tournaments.map((t: any) => t.id)).toContain(tid);
    expect((await api().post(`/api/admin/tournaments/${tid}/review`).set(auth(reviewer.token)).send({ decision: "reject" })).status).toBe(400); // reason needed
    expect((await api().post(`/api/admin/tournaments/${tid}/review`).set(auth(reviewer.token)).send({ decision: "approve" })).body.tournament.status).toBe("approved");
    expect(await Notification.countDocuments({ recipient: org.id, type: "tournament.review" })).toBe(1);
  });

  it("teams run by the organizer alone don't make it eligible", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    for (let i = 0; i < 4; i++) {
      const team = (await api().post("/api/teams").set(auth(org.token)).send({ name: `Own Team ${i}`, sport: "football" })).body.team.id;
      const reg = await api().post(`/api/tournaments/${tid}/registrations`).set(auth(org.token)).send({ teamId: team });
      await api().patch(`/api/tournaments/${tid}/registrations/${reg.body.registration.id}`).set(auth(org.token)).send({ action: "approve" });
    }
    const res = await api().post(`/api/tournaments/${tid}/submit-review`).set(auth(org.token));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/two different people/);
  });

  it("a rejected tournament can be edited and resubmitted", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    await fill(tid, org, 4);
    await api().post(`/api/tournaments/${tid}/submit-review`).set(auth(org.token));
    const reviewer = await registerStaff(["tournaments.review"]);
    await api().post(`/api/admin/tournaments/${tid}/review`).set(auth(reviewer.token)).send({ decision: "reject", note: "Add the rules" });
    expect((await Tournament.findById(tid))!.status).toBe("rejected");
    const edited = await api().patch(`/api/tournaments/${tid}`).set(auth(org.token)).send({ rules: "Standard FIFA rules, 2x30 min" });
    expect(edited.body.tournament.status).toBe("open");
    expect((await api().post(`/api/tournaments/${tid}/submit-review`).set(auth(org.token))).body.tournament.status).toBe("under_review");
  });
});

describe("playing a knockout", () => {
  it("the bracket moves only on verified results, and the champion is declared", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    const { owners, teams } = await fill(tid, org, 4);
    const ownerOf = new Map(teams.map((t, i) => [t, owners[i]]));
    const matches = await approveAndStart(tid, org);
    expect(matches).toHaveLength(3);
    expect((await Tournament.findById(tid))!.status).toBe("ongoing");

    const semis = await Match.find({ tournament: tid, round: 1 });
    const final = await Match.findOne({ tournament: tid, round: 2 });

    // Reported but not confirmed: nothing moves.
    await api().patch(`/api/tournaments/${tid}/matches/${semis[0]._id}`).set(auth(org.token)).send({ scoreA: 1, scoreB: 0 });
    expect((await Match.findById(final!._id))!.teamA).toBeNull();
    // A knockout draw is refused.
    expect((await api().patch(`/api/tournaments/${tid}/matches/${semis[1]._id}`).set(auth(org.token)).send({ scoreA: 1, scoreB: 1, outcome: "draw" })).status).toBe(400);

    const report = (await api().get(`/api/matches/${semis[0]._id}`)).body.reports[0];
    await api().post(`/api/matches/reports/${report.id}/confirm`).set(auth(ownerOf.get(semis[0].teamA!.toString())!.token));
    expect((await Match.findById(final!._id))!.teamA!.toString()).toBe(semis[0].teamA!.toString());

    await play(semis[1]._id.toString(), org, ownerOf, 0, 2);
    const ready = await Match.findById(final!._id);
    expect(ready!.teamB!.toString()).toBe(semis[1].teamB!.toString());

    await play(final!._id.toString(), org, ownerOf, 3, 1);
    const done = await Tournament.findById(tid);
    expect(done!.status).toBe("completed");
    expect(done!.winner!.toString()).toBe(semis[0].teamA!.toString());
    expect((await TeamSportStats.findOne({ team: done!.winner }))!.tournamentsWon).toBe(1);
    expect((await TeamSportStats.findOne({ team: teams[0] }))!.tournamentsPlayed).toBe(1);
  });

  it("a bracket of 5 gives byes to the top seeds", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    await fill(tid, org, 5);
    const matches = await approveAndStart(tid, org);
    expect(matches).toHaveLength(7);
    const byes = await Match.find({ tournament: tid, round: 1, status: "completed" });
    expect(byes).toHaveLength(3);
  });

  it("registration closes when the tournament starts", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    await fill(tid, org, 4);
    await approveAndStart(tid, org);
    const late = await registerUser();
    const team = (await api().post("/api/teams").set(auth(late.token)).send({ name: "Late FC", sport: "football" })).body.team.id;
    expect((await api().post(`/api/tournaments/${tid}/registrations`).set(auth(late.token)).send({ teamId: team })).status).toBe(400);
  });
});

describe("table formats", () => {
  it("round robin: everyone plays everyone; the table leader wins", async () => {
    const org = await premium();
    const tid = await createTournament(org, { format: "round_robin" });
    const { owners, teams } = await fill(tid, org, 4);
    const ownerOf = new Map(teams.map((t, i) => [t, owners[i]]));
    const matches = await approveAndStart(tid, org);
    expect(matches).toHaveLength(6);
    for (const m of matches) {
      // Team 0 always wins; everyone else draws.
      const a = m.teamA.id ?? m.teamA;
      const b = m.teamB.id ?? m.teamB;
      const [sa, sb] = a === teams[0] ? [2, 0] : b === teams[0] ? [0, 2] : [1, 1];
      await play(m.id, org, ownerOf, sa, sb);
    }
    const done = await Tournament.findById(tid);
    expect(done!.status).toBe("completed");
    expect(done!.winner!.toString()).toBe(teams[0]);
    const table = (await api().get(`/api/tournaments/${tid}/standings`)).body.standings[0];
    expect(table.rows[0]).toMatchObject({ team: { id: teams[0] }, points: 9, won: 3 });
  });

  it("groups then knockout: group winners meet in the final", async () => {
    const org = await premium();
    const tid = await createTournament(org, { format: "group_knockout", groups: 2, advancePerGroup: 1 });
    const { owners, teams } = await fill(tid, org, 6);
    const ownerOf = new Map(teams.map((t, i) => [t, owners[i]]));
    const groupMatches = await approveAndStart(tid, org);
    expect(groupMatches).toHaveLength(6); // two groups of three
    for (const m of groupMatches) await play(m.id, org, ownerOf, 1, 0);

    const ko = await Match.find({ tournament: tid, stage: "knockout" });
    expect(ko).toHaveLength(1);
    expect(ko[0].teamA && ko[0].teamB).toBeTruthy();
    await play(ko[0]._id.toString(), org, ownerOf, 2, 1);
    expect((await Tournament.findById(tid))!.status).toBe("completed");
  });
});

describe("organizer tools", () => {
  it("schedules fixtures and cancels with a reason", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    await fill(tid, org, 4);
    const matches = await approveAndStart(tid, org);
    const m = matches[0];
    const res = await api().patch(`/api/tournaments/${tid}/matches/${m.id}/schedule`).set(auth(org.token)).send({ date: futureDate(25), startTime: "14:00", endTime: "15:30", venueNote: "ANFA Complex" });
    expect(res.body.match).toMatchObject({ startTime: "14:00", venueNote: "ANFA Complex" });

    expect((await api().post(`/api/tournaments/${tid}/cancel`).set(auth(org.token)).send({})).status).toBe(400);
    expect((await api().post(`/api/tournaments/${tid}/cancel`).set(auth(org.token)).send({ reason: "Ground flooded" })).status).toBe(200);
    expect(await Match.countDocuments({ tournament: tid, status: "pending" })).toBe(0);
  });

  it("my tournaments lists what I organize and what my teams entered", async () => {
    const org = await premium();
    const tid = await createTournament(org);
    const { owners } = await fill(tid, org, 1);
    expect((await api().get("/api/my/tournaments").set(auth(org.token))).body.tournaments[0]).toMatchObject({ id: tid, isOrganizer: true });
    expect((await api().get("/api/my/tournaments").set(auth(owners[0].token))).body.tournaments[0]).toMatchObject({ id: tid, registration: "approved" });
  });
});
