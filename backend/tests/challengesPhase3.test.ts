import { api, auth, futureDate, makeGround, registerUser } from "./helpers";
import { Challenge } from "../src/models/Challenge";
import { Match } from "../src/models/Match";
import { Notification } from "../src/models/Notification";
import { expireStaleChallenges } from "../src/services/challengesService";

async function teamFor(sport = "football", name?: string) {
  const owner = await registerUser();
  const res = await api().post("/api/teams").set(auth(owner.token)).send({ name: name ?? `Team ${Math.random().toString(36).slice(2, 8)}`, sport });
  return { owner, id: res.body.team.id as string };
}

async function addCaptain(teamId: string, ownerToken: string) {
  const c = await registerUser();
  await api().post(`/api/teams/${teamId}/invitations`).set(auth(ownerToken)).send({ userId: c.id });
  await api().post(`/api/teams/${teamId}/invitations/respond`).set(auth(c.token)).send({ action: "accept" });
  await api().patch(`/api/teams/${teamId}/members/${c.id}/role`).set(auth(ownerToken)).send({ role: "captain" });
  return c;
}

const slot = (days = 4, start = "16:00", end = "17:30") => ({ date: futureDate(days), startTime: start, endTime: end });

describe("team challenges and captains", () => {
  it("a captain can challenge; a plain player can't", async () => {
    const home = await teamFor();
    const away = await teamFor();
    const captain = await addCaptain(home.id, home.owner.token);
    const player = await registerUser();
    await api().post(`/api/teams/${home.id}/invitations`).set(auth(home.owner.token)).send({ userId: player.id });
    await api().post(`/api/teams/${home.id}/invitations/respond`).set(auth(player.token)).send({ action: "accept" });

    const body = { sport: "football", mode: "team", teamId: home.id, opponentTeamId: away.id, ...slot() };
    expect((await api().post("/api/challenges").set(auth(player.token)).send(body)).status).toBe(403);
    const res = await api().post("/api/challenges").set(auth(captain.token)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.challenge.awaiting).toBe("opponent");
    expect(await Notification.countDocuments({ recipient: away.owner.id, type: "challenge.received" })).toBe(1);
  });

  it("the opponent's captain accepts, which creates the match", async () => {
    const home = await teamFor();
    const away = await teamFor();
    const awayCaptain = await addCaptain(away.id, away.owner.token);
    const c = await api().post("/api/challenges").set(auth(home.owner.token)).send({ sport: "football", mode: "team", teamId: home.id, opponentTeamId: away.id, ...slot() });
    const acc = await api().post(`/api/challenges/${c.body.challenge.id}/accept`).set(auth(awayCaptain.token)).send({});
    expect(acc.status).toBe(200);
    expect(acc.body.challenge.status).toBe("accepted");
    const m = await Match.findById(acc.body.challenge.matchId);
    expect(m!.source).toBe("challenge");
    expect(m!.teamA!.toString()).toBe(home.id);
    expect(m!.teamB!.toString()).toBe(away.id);
    expect(m!.status).toBe("pending");
    // Accepting again can't create a second match.
    expect((await api().post(`/api/challenges/${c.body.challenge.id}/accept`).set(auth(away.owner.token)).send({})).status).toBe(400);
    expect(await Match.countDocuments({ challenge: c.body.challenge.id })).toBe(1);
  });
});

describe("counter-proposals", () => {
  it("turns alternate, the latest terms win, and only the awaited side can answer", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const c = await api().post("/api/challenges").set(auth(a.token)).send({ sport: "tennis", mode: "player", opponentUserId: b.id, ...slot(4) });
    const id = c.body.challenge.id;

    // The challenger can't counter their own challenge before the opponent answers.
    expect((await api().post(`/api/challenges/${id}/counter`).set(auth(a.token)).send(slot(5))).status).toBe(400);

    const countered = await api().post(`/api/challenges/${id}/counter`).set(auth(b.token)).send({ ...slot(6, "07:00", "08:00"), message: "Morning works better" });
    expect(countered.status).toBe(200);
    expect(countered.body.challenge.status).toBe("countered");
    expect(countered.body.challenge.awaiting).toBe("challenger");
    expect(await Notification.countDocuments({ recipient: a.id, type: "challenge.countered" })).toBe(1);

    // b can't accept their own proposal.
    expect((await api().post(`/api/challenges/${id}/accept`).set(auth(b.token)).send({})).status).toBe(400);

    const accepted = await api().post(`/api/challenges/${id}/accept`).set(auth(a.token)).send({});
    expect(accepted.status).toBe(200);
    expect(accepted.body.challenge.date).toBe(futureDate(6));
    expect(accepted.body.challenge.startTime).toBe("07:00");
    const m = await Match.findOne({ challenge: id });
    expect(m!.userA!.toString()).toBe(a.id);
    expect(m!.userB!.toString()).toBe(b.id);
    expect(m!.startTime).toBe("07:00");
    expect(await Notification.countDocuments({ recipient: b.id, type: "challenge.accepted" })).toBe(1);
  });

  it("stops after five proposals", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "tennis", mode: "player", opponentUserId: b.id, ...slot(4) })).body.challenge.id;
    const turns = [b, a, b, a, b];
    for (const [i, who] of turns.entries()) {
      expect((await api().post(`/api/challenges/${id}/counter`).set(auth(who.token)).send(slot(5 + i))).status).toBe(200);
    }
    expect((await api().post(`/api/challenges/${id}/counter`).set(auth(a.token)).send(slot(11))).status).toBe(400);
  });

  it("decline is for the awaited side only", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "tennis", mode: "player", opponentUserId: b.id, ...slot() })).body.challenge.id;
    expect((await api().post(`/api/challenges/${id}/decline`).set(auth(a.token))).status).toBe(400);
    expect((await api().post(`/api/challenges/${id}/decline`).set(auth(b.token))).body.challenge.status).toBe("declined");
  });
});

describe("cancelling", () => {
  it("either side can call off an accepted match; the match is cancelled and the other side told", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "tennis", mode: "player", opponentUserId: b.id, ...slot() })).body.challenge.id;
    await api().post(`/api/challenges/${id}/accept`).set(auth(b.token)).send({});
    expect((await api().post(`/api/challenges/${id}/cancel`).set(auth(b.token))).status).toBe(200);
    expect((await Match.findOne({ challenge: id }))!.status).toBe("cancelled");
    expect(await Notification.countDocuments({ recipient: a.id, type: "challenge.cancelled" })).toBe(1);
  });

  it("strangers can't cancel", async () => {
    const a = await registerUser();
    const stranger = await registerUser();
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "tennis", mode: "player", ...slot() })).body.challenge.id;
    expect((await api().post(`/api/challenges/${id}/cancel`).set(auth(stranger.token))).status).toBe(403);
  });
});

describe("grounds and challenges", () => {
  it("an accepted challenge naming a ground does not block the slot for paying customers (N3)", async () => {
    const ground = await makeGround();
    const a = await registerUser();
    const b = await registerUser();
    const s = slot(5, "10:00", "11:00");
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "football", mode: "player", opponentUserId: b.id, groundId: ground._id, ...s })).body.challenge.id;
    await api().post(`/api/challenges/${id}/accept`).set(auth(b.token)).send({});

    const customer = await registerUser();
    const booking = await api().post("/api/ground-bookings").set(auth(customer.token)).send({ groundId: ground._id, ...s });
    expect(booking.status).toBe(201);
  });

  it("participants can book a ground for the accepted match; it then holds the slot", async () => {
    const ground = await makeGround();
    const a = await registerUser();
    const b = await registerUser();
    const s = slot(6, "18:00", "19:00");
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "football", mode: "player", opponentUserId: b.id, ...s })).body.challenge.id;

    expect((await api().post(`/api/challenges/${id}/book-ground`).set(auth(a.token)).send({ groundId: ground._id })).status).toBe(400); // not accepted yet
    await api().post(`/api/challenges/${id}/accept`).set(auth(b.token)).send({});

    const nearby = await api().get(`/api/challenges/${id}/nearby-grounds`);
    expect(nearby.body.grounds[0]).toMatchObject({ ground: { id: ground._id.toString() }, available: true });

    const stranger = await registerUser();
    expect((await api().post(`/api/challenges/${id}/book-ground`).set(auth(stranger.token)).send({ groundId: ground._id })).status).toBe(403);

    const booked = await api().post(`/api/challenges/${id}/book-ground`).set(auth(b.token)).send({ groundId: ground._id });
    expect(booked.status).toBe(201);
    expect(booked.body.challenge.bookingId).toBeTruthy();
    expect((await Match.findOne({ challenge: id }))!.ground!.toString()).toBe(ground._id.toString());

    // A second booking for the match is refused, and the slot is taken for others.
    expect((await api().post(`/api/challenges/${id}/book-ground`).set(auth(a.token)).send({ groundId: ground._id })).status).toBe(409);
    expect((await api().post("/api/ground-bookings").set(auth(stranger.token)).send({ groundId: ground._id, ...s })).status).toBe(409);
    expect((await api().get(`/api/challenges/${id}/nearby-grounds`)).body.grounds[0].available).toBe(false);
  });
});

describe("expiry and match lists", () => {
  it("unanswered challenges expire once their time has passed", async () => {
    const a = await registerUser();
    const c = await Challenge.create({ sport: "tennis", mode: "player", challenger: a.id, date: "2020-01-01", startTime: "10:00", endTime: "11:00", status: "open" });
    expect(await expireStaleChallenges()).toBe(1);
    expect((await Challenge.findById(c._id))!.status).toBe("expired");
  });

  it("matches show up publicly and in each player's list", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const stranger = await registerUser();
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "tennis", mode: "player", opponentUserId: b.id, ...slot() })).body.challenge.id;
    await api().post(`/api/challenges/${id}/accept`).set(auth(b.token)).send({});

    const pub = await api().get("/api/matches?status=upcoming");
    expect(pub.body.matches).toHaveLength(1);
    expect(pub.body.matches[0]).toMatchObject({ source: "challenge", mode: "player", sport: "tennis" });
    expect((await api().get("/api/my/matches").set(auth(a.token))).body.matches).toHaveLength(1);
    expect((await api().get("/api/my/matches").set(auth(stranger.token))).body.matches).toHaveLength(0);
  });

  it("team members see their team's matches", async () => {
    const home = await teamFor();
    const away = await teamFor();
    const member = await registerUser();
    await api().post(`/api/teams/${home.id}/invitations`).set(auth(home.owner.token)).send({ userId: member.id });
    await api().post(`/api/teams/${home.id}/invitations/respond`).set(auth(member.token)).send({ action: "accept" });
    const c = await api().post("/api/challenges").set(auth(home.owner.token)).send({ sport: "football", mode: "team", teamId: home.id, opponentTeamId: away.id, ...slot() });
    await api().post(`/api/challenges/${c.body.challenge.id}/accept`).set(auth(away.owner.token)).send({});
    expect((await api().get("/api/my/matches").set(auth(member.token))).body.matches).toHaveLength(1);
  });
});
