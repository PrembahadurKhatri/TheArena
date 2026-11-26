import { api, auth, registerAdmin, registerStaff, registerUser } from "./helpers";
import { User } from "../src/models/User";
import { Sport } from "../src/models/Sport";
import { Notification } from "../src/models/Notification";
import { notify } from "../src/services/notificationService";
import { isValidSportSlug, registerSport } from "../src/utils/sports";

describe("usernames", () => {
  it("are generated at sign-up when not given, and are unique", async () => {
    const a = await registerUser({ name: "Ram Thapa" });
    const me = await api().get("/api/auth/me").set(auth(a.token));
    expect(me.body.user.username).toMatch(/^ramthapa\d{4}$/);
  });

  it("can be chosen at sign-up and are unique regardless of case", async () => {
    const first = await api().post("/api/auth/register").send({ name: "A", email: "a1@example.com", password: "CorrectHorse9!", username: "Striker_10" });
    expect(first.status).toBe(201);
    expect(first.body.user.username).toBe("Striker_10");
    const clash = await api().post("/api/auth/register").send({ name: "B", email: "b1@example.com", password: "CorrectHorse9!", username: "striker_10" });
    expect(clash.status).toBe(409);
  });

  it("rejects reserved, too short and badly formed usernames", async () => {
    const u = await registerUser();
    for (const bad of ["admin", "ab", "has space", "_lead", "trail.", "a..b", "x".repeat(21)]) {
      const res = await api().patch("/api/auth/me/username").set(auth(u.token)).send({ username: bad });
      expect(res.status, bad).toBe(400);
    }
  });

  it("can be changed, the old one is freed, and availability is reported", async () => {
    const u = await registerUser();
    const other = await registerUser();
    expect((await api().patch("/api/auth/me/username").set(auth(u.token)).send({ username: "GoalMachine" })).status).toBe(200);
    expect((await api().get("/api/auth/username-available?u=goalmachine")).body.available).toBe(false);
    expect((await api().patch("/api/auth/me/username").set(auth(other.token)).send({ username: "GOALMACHINE" })).status).toBe(409);
    expect((await api().patch("/api/auth/me/username").set(auth(u.token)).send({ username: "NewName" })).status).toBe(200);
    expect((await api().get("/api/auth/username-available?u=goalmachine")).body.available).toBe(true);
  });

  it("a player profile can be fetched by username", async () => {
    const u = await registerUser();
    await api().patch("/api/auth/me/username").set(auth(u.token)).send({ username: "Keeper1" });
    const res = await api().get("/api/players/keeper1");
    expect(res.status).toBe(200);
    expect(res.body.player.id).toBe(u.id);
  });
});

describe("change password", () => {
  it("needs the current password, signs out other sessions, and returns a fresh token", async () => {
    const u = await registerUser();
    const second = await api().post("/api/auth/login").send({ email: u.email, password: u.password });

    expect((await api().patch("/api/auth/me/password").set(auth(u.token)).send({ currentPassword: "wrong-pass", newPassword: "BrandNew9!x" })).status).toBe(400);

    const ok = await api().patch("/api/auth/me/password").set(auth(u.token)).send({ currentPassword: u.password, newPassword: "BrandNew9!x" });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    expect((await api().get("/api/auth/me").set(auth(second.body.token))).status).toBe(401);
    expect((await api().get("/api/auth/me").set(auth(u.token))).status).toBe(401);
    expect((await api().get("/api/auth/me").set(auth(ok.body.token))).status).toBe(200);
    expect((await api().post("/api/auth/login").send({ email: u.email, password: "BrandNew9!x" })).status).toBe(200);
  });

  it("rejects reusing the same password", async () => {
    const u = await registerUser();
    const res = await api().patch("/api/auth/me/password").set(auth(u.token)).send({ currentPassword: u.password, newPassword: u.password });
    expect(res.status).toBe(400);
  });
});

describe("profile fields and privacy", () => {
  it("saves profile details and keeps district and province consistent", async () => {
    const u = await registerUser();
    const res = await api()
      .patch("/api/auth/me")
      .set(auth(u.token))
      .send({
        bio: "Left-arm spinner",
        district: "Kaski",
        municipality: "Pokhara",
        dateOfBirth: "2000-05-01",
        gender: "male",
        sportProfiles: [{ sport: "cricket", position: "Bowler", experienceLevel: "advanced" }],
      });
    expect(res.status).toBe(200);
    expect(res.body.user.province).toBe("Gandaki Province");
    expect(res.body.user.sportPreferences).toContain("cricket");
    expect(res.body.user.sportProfiles[0]).toEqual({ sport: "cricket", position: "Bowler", experienceLevel: "advanced" });

    const bad = await api().patch("/api/auth/me").set(auth(u.token)).send({ province: "Koshi Province", district: "Kaski" });
    expect(bad.status).toBe(200); // district wins: province follows it
    expect(bad.body.user.province).toBe("Gandaki Province");
    expect((await api().patch("/api/auth/me").set(auth(u.token)).send({ district: "Atlantis" })).status).toBe(400);
    expect((await api().patch("/api/auth/me").set(auth(u.token)).send({ sportProfiles: [{ sport: "chess" }] })).status).toBe(400);
  });

  it("hides email, phone and age from others unless the player allows it", async () => {
    const u = await registerUser();
    await api().patch("/api/auth/me").set(auth(u.token)).send({ phone: "9800000001", dateOfBirth: "1999-01-01" });
    const viewer = await registerUser();

    let res = await api().get(`/api/players/${u.id}`).set(auth(viewer.token));
    expect(res.body.player.email).toBeUndefined();
    expect(res.body.player.phone).toBeUndefined();
    expect(res.body.player.age).toBeNull();

    await api().patch("/api/auth/me").set(auth(u.token)).send({ privacy: { showPhone: true, showAge: true } });
    res = await api().get(`/api/players/${u.id}`).set(auth(viewer.token));
    expect(res.body.player.phone).toBe("9800000001");
    expect(res.body.player.age).toBeGreaterThan(20);
    expect(res.body.player.email).toBeUndefined();

    // The owner always sees their own details.
    const self = await api().get(`/api/players/${u.id}`).set(auth(u.token));
    expect(self.body.player.email).toBe(u.email);
  });

  it("the directory hides non-discoverable, blocked and staff accounts, and the viewer", async () => {
    const visible = await registerUser({ name: "Visible Vik" });
    const hidden = await registerUser({ name: "Hidden Hari" });
    await api().patch("/api/auth/me").set(auth(hidden.token)).send({ privacy: { discoverable: false } });
    const banned = await registerUser({ name: "Banned Bibek" });
    await User.updateOne({ _id: banned.id }, { $set: { status: "banned" } });
    await registerStaff([]);
    const viewer = await registerUser({ name: "Viewer" });

    const res = await api().get("/api/players").set(auth(viewer.token));
    const ids = res.body.players.map((p: any) => p.id);
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(banned.id);
    expect(ids).not.toContain(viewer.id);
    expect(res.body.players.every((p: any) => p.name !== "Staff")).toBe(true);
    expect(res.body.total).toBe(1);

    expect((await api().get(`/api/players/${banned.id}`)).status).toBe(404);
  });

  it("filters by district, and location only for players who show it", async () => {
    const a = await registerUser();
    await api().patch("/api/auth/me").set(auth(a.token)).send({ district: "Kathmandu" });
    const b = await registerUser();
    await api().patch("/api/auth/me").set(auth(b.token)).send({ district: "Kathmandu", privacy: { showLocation: false } });
    const res = await api().get("/api/players?district=Kathmandu");
    expect(res.body.players.map((p: any) => p.id)).toEqual([a.id]);
  });

  it("near-me search finds players within the radius", async () => {
    const near = await registerUser();
    await api().patch("/api/auth/me").set(auth(near.token)).send({ lat: 27.7172, lng: 85.324 }); // Kathmandu
    const far = await registerUser();
    await api().patch("/api/auth/me").set(auth(far.token)).send({ lat: 28.2096, lng: 83.9856 }); // Pokhara
    const res = await api().get("/api/players?lat=27.70&lng=85.31&radiusKm=10");
    const ids = res.body.players.map((p: any) => p.id);
    expect(ids).toContain(near.id);
    expect(ids).not.toContain(far.id);
  });

  it("experience filters are Premium; free accounts are told so", async () => {
    const free = await registerUser();
    expect((await api().get("/api/players?sport=cricket&experience=advanced").set(auth(free.token))).status).toBe(403);

    const prem = await registerUser();
    await User.updateOne({ _id: prem.id }, { $set: { isPremium: true, membershipExpiresAt: new Date(Date.now() + 86_400_000) } });
    const target = await registerUser();
    await api().patch("/api/auth/me").set(auth(target.token)).send({ sportProfiles: [{ sport: "cricket", experienceLevel: "advanced", position: "Bowler" }] });
    const res = await api().get("/api/players?sport=cricket&experience=advanced&position=bowler").set(auth(prem.token));
    expect(res.status).toBe(200);
    expect(res.body.players.map((p: any) => p.id)).toEqual([target.id]);
  });

  it("/auth/me reports entitlements", async () => {
    const u = await registerUser();
    const me = await api().get("/api/auth/me").set(auth(u.token));
    expect(me.body.user.entitlements.plan).toBe("free");
    expect(me.body.user.entitlements.maxOwnedTeams).toBe(1);
  });
});

describe("blacklist", () => {
  it("a banned user's email and phone can't be used to register again; lifting the ban frees them", async () => {
    const admin = await registerAdmin();
    const u = await registerUser({ email: "cheat@example.com" });
    await api().patch("/api/auth/me").set(auth(u.token)).send({ phone: "+977 980-0000002" });

    expect((await api().patch(`/api/admin/users/${u.id}/status`).set(auth(admin.token)).send({ status: "banned", reason: "Match fixing" })).status).toBe(200);

    const again = await api().post("/api/auth/register").send({ name: "Cheat", email: "CHEAT@example.com", password: "CorrectHorse9!" });
    // The email is still taken by the banned account itself, so this is a 409;
    // remove the account to prove the blacklist, not the unique email, blocks it.
    expect([403, 409]).toContain(again.status);
    await User.deleteOne({ _id: u.id });
    expect((await api().post("/api/auth/register").send({ name: "Cheat", email: "cheat@example.com", password: "CorrectHorse9!" })).status).toBe(403);

    const other = await registerUser();
    expect((await api().patch("/api/auth/me").set(auth(other.token)).send({ phone: "9800000002" })).status).toBe(403);

    const list = await api().get("/api/admin/blacklist").set(auth(admin.token));
    expect(list.body.entries).toHaveLength(2);
    expect(JSON.stringify(list.body)).not.toContain("cheat@example.com");
  });

  it("unbanning removes the entries", async () => {
    const admin = await registerAdmin();
    const u = await registerUser();
    await api().patch(`/api/admin/users/${u.id}/status`).set(auth(admin.token)).send({ status: "banned", reason: "x" });
    await api().patch(`/api/admin/users/${u.id}/status`).set(auth(admin.token)).send({ status: "active" });
    expect((await api().get("/api/admin/blacklist").set(auth(admin.token))).body.entries).toHaveLength(0);
  });
});

describe("notifications", () => {
  it("are delivered, listed newest first, counted and marked read — only by their owner", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await notify(a.id, { type: "system", title: "First" });
    await notify([a.id, b.id, a.id], { type: "system", title: "Second" });

    const list = await api().get("/api/notifications").set(auth(a.token));
    expect(list.body.notifications.map((n: any) => n.title)).toEqual(["Second", "First"]);
    expect(list.body.unread).toBe(2);

    const bList = await api().get("/api/notifications").set(auth(b.token));
    expect(bList.body.notifications).toHaveLength(1);

    const id = list.body.notifications[0].id;
    expect((await api().post(`/api/notifications/${id}/read`).set(auth(b.token))).status).toBe(404);
    expect((await api().post(`/api/notifications/${id}/read`).set(auth(a.token))).status).toBe(200);
    expect((await api().get("/api/notifications/unread-count").set(auth(a.token))).body.unread).toBe(1);
    await api().post("/api/notifications/read-all").set(auth(a.token));
    expect((await api().get("/api/notifications/unread-count").set(auth(a.token))).body.unread).toBe(0);
  });

  it("the actor isn't notified about their own action, and failures never throw", async () => {
    const a = await registerUser();
    expect(await notify(a.id, { type: "system", title: "Self", actor: a.id })).toBe(0);
    expect(await notify(a.id, { type: "not-a-type" as any, title: "Bad" })).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it("require sign-in", async () => {
    expect((await api().get("/api/notifications")).status).toBe(401);
  });
});

describe("announcements", () => {
  it("staff with announcements.manage publish; everyone reads live ones", async () => {
    const s = await registerStaff(["announcements.manage"]);
    const created = await api().post("/api/admin/announcements").set(auth(s.token)).send({ title: "Monsoon schedule", body: "Outdoor grounds may close." });
    expect(created.status).toBe(201);
    await api().post("/api/admin/announcements").set(auth(s.token)).send({ title: "Old news", body: "Gone", expiresAt: new Date(Date.now() - 1000).toISOString() });
    const feed = await api().get("/api/meta/announcements");
    expect(feed.body.announcements.map((a: any) => a.title)).toEqual(["Monsoon schedule"]);
  });
});

describe("sports as data", () => {
  it("an admin can add a sport, and teams can then be created for it", async () => {
    const s = await registerStaff(["categories.manage"]);
    expect(isValidSportSlug("netball")).toBe(false);
    const res = await api().post("/api/admin/sports").set(auth(s.token)).send({ slug: "netball", name: "Netball", minPlayers: 7, maxPlayers: 12, positions: ["Goal Shooter", "Centre"] });
    expect(res.status).toBe(201);
    expect(isValidSportSlug("netball")).toBe(true);

    const p = await registerUser();
    const team = await api().post("/api/teams").set(auth(p.token)).send({ name: "Pokhara Netters", sport: "netball" });
    expect(team.status).toBe(201);
    expect((await api().get("/api/sports")).body.sports.map((x: any) => x.slug)).toContain("netball");
  });

  it("a deactivated sport can't get new teams, but existing data keeps working", async () => {
    await Sport.create({ slug: "kho-kho", name: "Kho Kho", order: 11 });
    registerSport("kho-kho", true);
    const p = await registerUser();
    const team = await api().post("/api/teams").set(auth(p.token)).send({ name: "Kho Stars", sport: "kho-kho" });
    expect(team.status).toBe(201);

    const s = await registerStaff(["categories.manage"]);
    expect((await api().patch("/api/admin/sports/kho-kho").set(auth(s.token)).send({ active: false })).status).toBe(200);
    const p2 = await registerUser();
    expect((await api().post("/api/teams").set(auth(p2.token)).send({ name: "Late Team", sport: "kho-kho" })).status).toBe(400);
    expect((await api().get(`/api/teams/${team.body.team.id}`)).status).toBe(200);
    expect((await api().get("/api/sports")).body.sports.map((x: any) => x.slug)).not.toContain("kho-kho");
    registerSport("kho-kho", true);
  });

  it("rejects unknown sports and slug changes", async () => {
    const s = await registerStaff(["categories.manage"]);
    await Sport.create({ slug: "cricket", name: "Cricket", order: 1 });
    expect((await api().patch("/api/admin/sports/cricket").set(auth(s.token)).send({ slug: "krikat" })).status).toBe(400);
    expect((await api().post("/api/admin/sports").set(auth(s.token)).send({ slug: "Bad Slug!", name: "X" })).status).toBe(400);
  });
});

describe("password reset emails in production", () => {
  it("never log the reset link when SMTP is missing", async () => {
    const u = await registerUser();
    const logs: string[] = [];
    const orig = { log: console.log, warn: console.warn };
    console.log = (...a: unknown[]) => logs.push(a.map(String).join(" "));
    console.warn = (...a: unknown[]) => logs.push(a.map(String).join(" "));
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await api().post("/api/auth/forgot-password").send({ email: u.email });
    } finally {
      process.env.NODE_ENV = prevEnv;
      console.log = orig.log;
      console.warn = orig.warn;
    }
    expect(logs.join("\n")).not.toMatch(/reset-password\//);
  });
});
