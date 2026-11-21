
import { api, auth, registerAdmin, registerUser } from "./helpers";
import { AuditLog } from "../src/models/AuditLog";
import { User } from "../src/models/User";

const ADMIN_ROUTES: [string, string][] = [
  ["get", "/api/admin/users"],
  ["get", "/api/admin/audit-logs"],
  ["patch", "/api/admin/users/000000000000000000000000/status"],
  ["patch", "/api/admin/users/000000000000000000000000/role"],
];

describe("admin access control (#1)", () => {
  it("rejects anonymous requests with 401", async () => {
    for (const [method, path] of ADMIN_ROUTES) {
      const res = await (api() as any)[method](path).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("rejects a normal player with 403 on every admin route", async () => {
    const p = await registerUser();
    for (const [method, path] of ADMIN_ROUTES) {
      const res = await (api() as any)[method](path).set(auth(p.token)).send({ status: "banned", role: "admin" });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("a player can't make themselves admin by forging the role claim", async () => {
    // Role comes from the database, not the token.
    const p = await registerUser();
    const res = await api().get("/api/admin/users").set(auth(p.token));
    expect(res.status).toBe(403);
  });

  it("a demoted admin loses access immediately, with the same token", async () => {
    const a = await registerAdmin();
    expect((await api().get("/api/admin/users").set(auth(a.token))).status).toBe(200);
    await User.updateOne({ _id: a.id }, { $set: { role: "player" } });
    expect((await api().get("/api/admin/users").set(auth(a.token))).status).toBe(403);
  });
});

describe("account suspension", () => {
  it("suspending signs the user out, blocks login, and is audited", async () => {
    const admin = await registerAdmin();
    const victim = await registerUser();

    const res = await api()
      .patch(`/api/admin/users/${victim.id}/status`)
      .set(auth(admin.token))
      .send({ status: "suspended", reason: "Spam listings" });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("suspended");

    const me = await api().get("/api/auth/me").set(auth(victim.token));
    expect(me.status).toBe(401); // old session revoked

    const login = await api().post("/api/auth/login").send({ email: victim.email, password: victim.password });
    expect(login.status).toBe(403);

    const log = await AuditLog.findOne({ action: "user.suspended" });
    expect(log).not.toBeNull();
    expect(log!.actor!.toString()).toBe(admin.id);
    expect(log!.target!.id!.toString()).toBe(victim.id);
    expect(log!.reason).toBe("Spam listings");
    expect(log!.requestId).toBeTruthy();
  });

  it("reactivating restores login", async () => {
    const admin = await registerAdmin();
    const u = await registerUser();
    await api().patch(`/api/admin/users/${u.id}/status`).set(auth(admin.token)).send({ status: "banned", reason: "Fraud" });
    await api().patch(`/api/admin/users/${u.id}/status`).set(auth(admin.token)).send({ status: "active" });
    expect((await api().post("/api/auth/login").send({ email: u.email, password: u.password })).status).toBe(200);
  });

  it("requires a reason to suspend, and rejects unknown statuses", async () => {
    const admin = await registerAdmin();
    const u = await registerUser();
    expect((await api().patch(`/api/admin/users/${u.id}/status`).set(auth(admin.token)).send({ status: "suspended" })).status).toBe(400);
    expect((await api().patch(`/api/admin/users/${u.id}/status`).set(auth(admin.token)).send({ status: "deleted", reason: "x" })).status).toBe(400);
  });

  it("an admin can't suspend or demote themselves", async () => {
    const admin = await registerAdmin();
    expect((await api().patch(`/api/admin/users/${admin.id}/status`).set(auth(admin.token)).send({ status: "suspended", reason: "x" })).status).toBe(400);
    expect((await api().patch(`/api/admin/users/${admin.id}/role`).set(auth(admin.token)).send({ role: "player" })).status).toBe(400);
  });
});

describe("admin user list and audit log", () => {
  it("lists users with pagination and never exposes password hashes", async () => {
    const admin = await registerAdmin();
    for (let i = 0; i < 3; i++) await registerUser();
    const res = await api().get("/api/admin/users?limit=2&page=1").set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.total).toBe(4);
    expect(res.body.pages).toBe(2);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion|resetPassword/);
  });

  it("role changes are audited with before/after values", async () => {
    const admin = await registerAdmin();
    const u = await registerUser();
    expect((await api().patch(`/api/admin/users/${u.id}/role`).set(auth(admin.token)).send({ role: "admin", reason: "New staff" })).status).toBe(200);
    const logs = await api().get("/api/admin/audit-logs?action=user.role_changed").set(auth(admin.token));
    expect(logs.status).toBe(200);
    expect(logs.body.logs[0].before).toEqual({ role: "player" });
    expect(logs.body.logs[0].after).toEqual({ role: "admin" });
  });

  it("audit entries can't be edited or deleted through the model", async () => {
    const admin = await registerAdmin();
    await api().post("/api/auth/login").send({ email: admin.email, password: admin.password });
    const entry = await AuditLog.findOne({ action: "auth.admin_login" });
    expect(entry).not.toBeNull();
    await expect(AuditLog.updateOne({ _id: entry!._id }, { $set: { action: "nothing" } })).rejects.toThrow(/immutable/);
    await expect(AuditLog.deleteOne({ _id: entry!._id })).rejects.toThrow(/immutable/);
  });
});
