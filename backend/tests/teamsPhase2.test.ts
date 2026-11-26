import { api, auth, futureDate, registerStaff, registerUser } from "./helpers";
import { Team } from "../src/models/Team";
import { Sport } from "../src/models/Sport";
import { Challenge } from "../src/models/Challenge";
import { Notification } from "../src/models/Notification";
import { User } from "../src/models/User";

async function makeTeam(name = "Pokhara Strikers", sport = "football", extra: Record<string, unknown> = {}) {
  const owner = await registerUser();
  const res = await api().post("/api/teams").set(auth(owner.token)).send({ name, sport, ...extra });
  if (res.status !== 201) throw new Error(`team failed ${res.status} ${JSON.stringify(res.body)}`);
  return { owner, team: res.body.team, id: res.body.team.id as string };
}

async function setUsername(token: string, username: string) {
  await api().patch("/api/auth/me/username").set(auth(token)).send({ username });
}

describe("unique team names", () => {
  it("rejects the same name in any capitalisation or spacing", async () => {
    await makeTeam("Kathmandu Kings");
    const other = await registerUser();
    for (const name of ["kathmandu kings", "KATHMANDU KINGS", "  Kathmandu   Kings "]) {
      const res = await api().post("/api/teams").set(auth(other.token)).send({ name, sport: "cricket" });
      expect(res.status, name).toBe(409);
    }
  });

  it("holds under concurrent creation", async () => {
    const users = await Promise.all([registerUser(), registerUser(), registerUser(), registerUser()]);
    const results = await Promise.all(users.map((u) => api().post("/api/teams").set(auth(u.token)).send({ name: "Race Team", sport: "futsal" })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await Team.countDocuments({ nameKey: "race team" })).toBe(1);
  });

  it("renaming checks uniqueness too; availability endpoint agrees", async () => {
    await makeTeam("Lalitpur Lions");
    const { owner, id } = await makeTeam("Bhaktapur Bulls");
    expect((await api().get("/api/teams/name-available?name=lalitpur%20LIONS")).body.available).toBe(false);
    expect((await api().patch(`/api/teams/${id}`).set(auth(owner.token)).send({ name: "LALITPUR lions" })).status).toBe(409);
    expect((await api().patch(`/api/teams/${id}`).set(auth(owner.token)).send({ name: "Bhaktapur Bulls FC" })).status).toBe(200);
  });

  it("teams get a slug and can be fetched by it", async () => {
    const { team } = await makeTeam("Dharan Dragons");
    expect(team.slug).toBe("dharan-dragons");
    expect((await api().get("/api/teams/dharan-dragons")).body.team.id).toBe(team.id);
  });

  it("the free plan limit can't be beaten with parallel requests", async () => {
    const u = await registerUser();
    const results = await Promise.all(
      ["A1 Team", "A2 Team", "A3 Team"].map((name) => api().post("/api/teams").set(auth(u.token)).send({ name, sport: "cricket" }))
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });
});

describe("roles", () => {
  it("the owner assigns captain and vice-captain; one person per role", async () => {
    const { owner, id } = await makeTeam();
    const a = await registerUser();
    const b = await registerUser();
    for (const p of [a, b]) {
      await api().post(`/api/teams/${id}/join-requests`).set(auth(p.token));
      await api().patch(`/api/teams/${id}/join-requests/${p.id}`).set(auth(owner.token)).send({ action: "accept" });
    }
    await api().patch(`/api/teams/${id}/members/${a.id}/role`).set(auth(owner.token)).send({ role: "captain" });
    let res = await api().patch(`/api/teams/${id}/members/${b.id}/role`).set(auth(owner.token)).send({ role: "captain" });
    expect(res.body.team.captainId).toBe(b.id);
    expect(res.body.team.members.find((m: any) => m.id === a.id).role).toBe("player");

    res = await api().patch(`/api/teams/${id}/members/${a.id}/role`).set(auth(owner.token)).send({ role: "vice_captain" });
    expect(res.body.team.viceCaptainId).toBe(a.id);

    // Only the owner can assign roles.
    expect((await api().patch(`/api/teams/${id}/members/${a.id}/role`).set(auth(b.token)).send({ role: "captain" })).status).toBe(403);
  });

  it("captains handle join requests and invitations; vice-captains and players can't", async () => {
    const { owner, id } = await makeTeam();
    const captain = await registerUser();
    const vice = await registerUser();
    for (const p of [captain, vice]) {
      await api().post(`/api/teams/${id}/join-requests`).set(auth(p.token));
      await api().patch(`/api/teams/${id}/join-requests/${p.id}`).set(auth(owner.token)).send({ action: "accept" });
    }
    await api().patch(`/api/teams/${id}/members/${captain.id}/role`).set(auth(owner.token)).send({ role: "captain" });
    await api().patch(`/api/teams/${id}/members/${vice.id}/role`).set(auth(owner.token)).send({ role: "vice_captain" });

    const applicant = await registerUser();
    await api().post(`/api/teams/${id}/join-requests`).set(auth(applicant.token));
    expect((await api().patch(`/api/teams/${id}/join-requests/${applicant.id}`).set(auth(vice.token)).send({ action: "accept" })).status).toBe(403);
    expect((await api().patch(`/api/teams/${id}/join-requests/${applicant.id}`).set(auth(captain.token)).send({ action: "accept" })).status).toBe(200);

    // But only the owner edits the team or removes players.
    expect((await api().patch(`/api/teams/${id}`).set(auth(captain.token)).send({ name: "Captain's Team" })).status).toBe(403);
    expect((await api().delete(`/api/teams/${id}/members/${applicant.id}`).set(auth(captain.token))).status).toBe(403);

    // Managers see pending requests; plain players don't.
    expect((await api().get(`/api/teams/${id}`).set(auth(captain.token))).body.team.pendingRequests).toBeDefined();
    expect((await api().get(`/api/teams/${id}`).set(auth(vice.token))).body.team.pendingRequests).toBeUndefined();
  });
});

describe("invitations", () => {
  it("invite by username, accept, and everyone is notified", async () => {
    const { owner, id } = await makeTeam();
    const friend = await registerUser();
    await setUsername(friend.token, "FastWinger");

    expect((await api().post(`/api/teams/${id}/invitations`).set(auth(owner.token)).send({ username: "@fastwinger" })).status).toBe(200);
    expect((await api().post(`/api/teams/${id}/invitations`).set(auth(owner.token)).send({ username: "fastwinger" })).status).toBe(400);

    const mine = await api().get("/api/my/invitations").set(auth(friend.token));
    expect(mine.body.invitations).toHaveLength(1);
    expect(await Notification.countDocuments({ recipient: friend.id, type: "team.invitation" })).toBe(1);

    const accepted = await api().post(`/api/teams/${id}/invitations/respond`).set(auth(friend.token)).send({ action: "accept" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.team.members.map((m: any) => m.id)).toContain(friend.id);
    expect(await Notification.countDocuments({ recipient: owner.id, type: "team.join_response" })).toBe(1);
    expect((await api().get("/api/my/invitations").set(auth(friend.token))).body.invitations).toHaveLength(0);
  });

  it("declining removes the invitation; strangers can't answer it", async () => {
    const { owner, id } = await makeTeam();
    const friend = await registerUser();
    const stranger = await registerUser();
    await api().post(`/api/teams/${id}/invitations`).set(auth(owner.token)).send({ userId: friend.id });
    expect((await api().post(`/api/teams/${id}/invitations/respond`).set(auth(stranger.token)).send({ action: "accept" })).status).toBe(404);
    await api().post(`/api/teams/${id}/invitations/respond`).set(auth(friend.token)).send({ action: "decline" });
    const team = await Team.findById(id);
    expect(team!.invitations).toHaveLength(0);
    expect(team!.members.map(String)).not.toContain(friend.id);
  });

  it("can't invite staff or banned accounts", async () => {
    const { owner, id } = await makeTeam();
    const staff = await registerStaff([]);
    const banned = await registerUser();
    await User.updateOne({ _id: banned.id }, { $set: { status: "banned" } });
    expect((await api().post(`/api/teams/${id}/invitations`).set(auth(owner.token)).send({ userId: staff.id })).status).toBe(404);
    expect((await api().post(`/api/teams/${id}/invitations`).set(auth(owner.token)).send({ userId: banned.id })).status).toBe(404);
  });
});

describe("leaving and ownership", () => {
  it("members can leave; the owner must transfer first", async () => {
    const { owner, id } = await makeTeam();
    const m = await registerUser();
    await api().post(`/api/teams/${id}/invitations`).set(auth(owner.token)).send({ userId: m.id });
    await api().post(`/api/teams/${id}/invitations/respond`).set(auth(m.token)).send({ action: "accept" });

    expect((await api().post(`/api/teams/${id}/leave`).set(auth(owner.token))).status).toBe(400);
    expect((await api().post(`/api/teams/${id}/transfer-ownership`).set(auth(m.token)).send({ userId: m.id })).status).toBe(403);
    const t = await api().post(`/api/teams/${id}/transfer-ownership`).set(auth(owner.token)).send({ userId: m.id });
    expect(t.status).toBe(200);
    expect(t.body.team.owner.id).toBe(m.id);
    expect((await api().post(`/api/teams/${id}/leave`).set(auth(owner.token))).status).toBe(200);
    expect((await Team.findById(id))!.members.map(String)).toEqual([m.id]);
  });

  it("transfer respects the new owner's plan limit", async () => {
    const { owner, id } = await makeTeam("Team Alpha");
    const { owner: other } = await makeTeam("Team Beta");
    await api().post(`/api/teams/${id}/invitations`).set(auth(owner.token)).send({ userId: other.id });
    await api().post(`/api/teams/${id}/invitations/respond`).set(auth(other.token)).send({ action: "accept" });
    expect((await api().post(`/api/teams/${id}/transfer-ownership`).set(auth(owner.token)).send({ userId: other.id })).status).toBe(409);
  });
});

describe("roster limits and sport lock", () => {
  it("a full roster accepts nobody else", async () => {
    await Sport.create({ slug: "badminton", name: "Badminton", order: 7, maxPlayers: 2 });
    const { owner, id } = await makeTeam("Shuttle Squad", "badminton");
    const a = await registerUser();
    const b = await registerUser();
    await api().post(`/api/teams/${id}/join-requests`).set(auth(a.token));
    await api().post(`/api/teams/${id}/join-requests`).set(auth(b.token));
    expect((await api().patch(`/api/teams/${id}/join-requests/${a.id}`).set(auth(owner.token)).send({ action: "accept" })).status).toBe(200);
    expect((await api().patch(`/api/teams/${id}/join-requests/${b.id}`).set(auth(owner.token)).send({ action: "accept" })).status).toBe(409);
  });

  it("the sport can't change once the team has a match", async () => {
    const { owner, id } = await makeTeam("Lock Test", "football");
    expect((await api().patch(`/api/teams/${id}`).set(auth(owner.token)).send({ sport: "futsal" })).status).toBe(200);
    await Challenge.create({ sport: "futsal", mode: "team", challenger: owner.id, challengerTeam: id, date: futureDate(), startTime: "10:00", endTime: "11:00" });
    expect((await api().patch(`/api/teams/${id}`).set(auth(owner.token)).send({ sport: "football" })).status).toBe(400);
  });

  it("deleting a team calls off its open challenges", async () => {
    const { owner, id } = await makeTeam("Gone Soon", "football");
    const c = await Challenge.create({ sport: "football", mode: "team", challenger: owner.id, challengerTeam: id, date: futureDate(), startTime: "10:00", endTime: "11:00", status: "open" });
    expect((await api().delete(`/api/teams/${id}`).set(auth(owner.token))).status).toBe(200);
    expect((await Challenge.findById(c._id))!.status).toBe("cancelled");
  });
});

describe("discovery", () => {
  it("filters by district and paginates", async () => {
    await makeTeam("Pokhara One", "football", { district: "Kaski" });
    await makeTeam("Pokhara Two", "football", { district: "Kaski" });
    await makeTeam("Ktm One", "football", { district: "Kathmandu" });
    const res = await api().get("/api/teams?district=Kaski&limit=1");
    expect(res.body.total).toBe(2);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.pages).toBe(2);
    expect(res.body.teams[0].province).toBe("Gandaki Province");
  });

  it("near-me finds teams within the radius", async () => {
    await makeTeam("Near FC", "football", { lat: 27.7172, lng: 85.324 });
    await makeTeam("Far FC", "football", { lat: 28.2096, lng: 83.9856 });
    const res = await api().get("/api/teams?lat=27.70&lng=85.31&radiusKm=15");
    expect(res.body.teams.map((t: any) => t.name)).toEqual(["Near FC"]);
  });
});

describe("admin moderation", () => {
  it("a suspended team is hidden and frozen; deletion needs a reason", async () => {
    const { id } = await makeTeam("Bad Actors");
    const mod = await registerStaff(["teams.moderate"]);
    expect((await api().patch(`/api/admin/teams/${id}/status`).set(auth(mod.token)).send({ status: "suspended" })).status).toBe(400);
    expect((await api().patch(`/api/admin/teams/${id}/status`).set(auth(mod.token)).send({ status: "suspended", reason: "Fake team" })).status).toBe(200);

    expect((await api().get("/api/teams")).body.teams.map((t: any) => t.id)).not.toContain(id);
    const p = await registerUser();
    expect((await api().post(`/api/teams/${id}/join-requests`).set(auth(p.token))).status).toBe(403);

    expect((await api().delete(`/api/admin/teams/${id}`).set(auth(mod.token)).send({})).status).toBe(400);
    expect((await api().delete(`/api/admin/teams/${id}`).set(auth(mod.token)).send({ reason: "Fake team" })).status).toBe(200);
    expect(await Team.exists({ _id: id })).toBeNull();
  });
});
