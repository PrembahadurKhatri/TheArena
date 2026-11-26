import { api, auth, futureDate, registerAdmin, registerStaff, registerUser } from "./helpers";
import { Report } from "../src/models/Report";
import { User } from "../src/models/User";
import { loadSettings } from "../src/services/settingsService";

describe("admin overview", () => {
  it("needs analytics.read and reports platform totals and queues", async () => {
    await registerUser();
    const nobody = await registerStaff([]);
    expect((await api().get("/api/admin/overview").set(auth(nobody.token))).status).toBe(403);
    const analyst = await registerStaff(["analytics.read"]);
    const res = await api().get("/api/admin/overview").set(auth(analyst.token));
    expect(res.status).toBe(200);
    expect(res.body.totals.users).toBe(1);
    expect(res.body.pending).toMatchObject({ merchants: 0, products: 0, grounds: 0, tournaments: 0, disputes: 0, reports: 0 });
  });
});

describe("reports", () => {
  it("users report once per target; staff resolve and every reporter is told", async () => {
    const bad = await registerUser();
    const a = await registerUser();
    const b = await registerUser();
    expect((await api().post("/api/reports").send({ targetType: "user", targetId: bad.id, reason: "abuse" })).status).toBe(401);
    expect((await api().post("/api/reports").set(auth(a.token)).send({ targetType: "user", targetId: a.id, reason: "abuse" })).status).toBe(400);
    expect((await api().post("/api/reports").set(auth(a.token)).send({ targetType: "user", targetId: bad.id, reason: "nonsense" })).status).toBe(400);
    expect((await api().post("/api/reports").set(auth(a.token)).send({ targetType: "user", targetId: bad.id, reason: "abuse", details: "Rude in chat" })).status).toBe(201);
    expect((await api().post("/api/reports").set(auth(a.token)).send({ targetType: "user", targetId: bad.id, reason: "spam" })).status).toBe(409);
    await api().post("/api/reports").set(auth(b.token)).send({ targetType: "user", targetId: bad.id, reason: "spam" });

    const mod = await registerStaff(["moderation.reports"]);
    const list = await api().get("/api/admin/reports").set(auth(mod.token));
    expect(list.body.reports).toHaveLength(2);
    expect(list.body.reports[0].openReports).toBe(2);
    expect(list.body.reports[0].target.label).toBeTruthy();

    expect((await api().post(`/api/admin/reports/${list.body.reports[0].id}/resolve`).set(auth(mod.token)).send({ status: "dismissed" })).status).toBe(400);
    const done = await api().post(`/api/admin/reports/${list.body.reports[0].id}/resolve`).set(auth(mod.token)).send({ status: "actioned", resolution: "Account suspended" });
    expect(done.body.updated).toBe(2);
    expect(await Report.countDocuments({ status: "actioned" })).toBe(2);
    expect((await api().get("/api/admin/reports").set(auth(mod.token))).body.reports).toHaveLength(0);
  });

  it("rejects reports about things that don't exist", async () => {
    const a = await registerUser();
    expect((await api().post("/api/reports").set(auth(a.token)).send({ targetType: "team", targetId: "000000000000000000000000", reason: "fake" })).status).toBe(404);
  });
});

describe("platform settings", () => {
  afterEach(async () => {
    await loadSettings();
  });

  it("only Super Admins change them, values are range-checked, and changes apply at once", async () => {
    const staff = await registerStaff(["users.read", "audit.read"]);
    expect((await api().get("/api/admin/settings").set(auth(staff.token))).status).toBe(403);
    const admin = await registerAdmin();
    const list = await api().get("/api/admin/settings").set(auth(admin.token));
    expect(list.body.settings.map((s: any) => s.key)).toContain("maxChallengeCounters");
    expect((await api().patch("/api/admin/settings").set(auth(admin.token)).send({ maxChallengeCounters: 99 })).status).toBe(400);
    expect((await api().patch("/api/admin/settings").set(auth(admin.token)).send({ unknownKey: 1 })).status).toBe(400);
    expect((await api().patch("/api/admin/settings").set(auth(admin.token)).send({ maxChallengeCounters: 1 })).status).toBe(200);

    // With one counter allowed, the second proposal is refused.
    const a = await registerUser();
    const b = await registerUser();
    const id = (await api().post("/api/challenges").set(auth(a.token)).send({ sport: "tennis", mode: "player", opponentUserId: b.id, date: futureDate(4), startTime: "10:00", endTime: "11:00" })).body.challenge.id;
    expect((await api().post(`/api/challenges/${id}/counter`).set(auth(b.token)).send({ date: futureDate(5), startTime: "10:00", endTime: "11:00" })).status).toBe(200);
    expect((await api().post(`/api/challenges/${id}/counter`).set(auth(a.token)).send({ date: futureDate(6), startTime: "10:00", endTime: "11:00" })).status).toBe(400);

    // null restores the default.
    const reset = await api().patch("/api/admin/settings").set(auth(admin.token)).send({ maxChallengeCounters: null });
    expect(reset.body.settings.find((s: any) => s.key === "maxChallengeCounters")).toMatchObject({ value: 5, overridden: false });
  });
});

describe("staff editing users", () => {
  it("users.edit corrects profile details, audited; staff accounts need a Super Admin", async () => {
    const u = await registerUser();
    const hr = await registerStaff(["users.edit"]);
    const res = await api().patch(`/api/admin/users/${u.id}`).set(auth(hr.token)).send({ name: "Corrected Name", district: "Kaski", role: "admin" });
    expect(res.status).toBe(200);
    const fresh = await User.findById(u.id);
    expect([fresh!.name, fresh!.province, fresh!.role]).toEqual(["Corrected Name", "Gandaki Province", "player"]);
    const other = await registerStaff([]);
    expect((await api().patch(`/api/admin/users/${other.id}`).set(auth(hr.token)).send({ name: "Nope" })).status).toBe(403);
  });
});
