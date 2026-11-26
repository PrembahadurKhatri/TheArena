import { api, auth, registerAdmin, registerStaff, registerUser } from "./helpers";
import { User } from "../src/models/User";
import { StaffRole } from "../src/models/StaffRole";
import { AuditLog } from "../src/models/AuditLog";
import { ensureDefaultStaffRoles } from "../src/services/staffService";
import { DEFAULT_STAFF_ROLES } from "../src/config/permissions";

const ZERO = "000000000000000000000000";

// Every admin route and what it needs. A new admin route must be added here,
// or the "covers every route" test below fails.
const ROUTES: { method: string; path: string; needs: string | "super" | "staff" }[] = [
  { method: "get", path: "/api/admin/me/permissions", needs: "staff" },
  { method: "get", path: "/api/admin/users", needs: "users.read" },
  { method: "patch", path: `/api/admin/users/${ZERO}/status`, needs: "users.suspend" },
  { method: "patch", path: `/api/admin/users/${ZERO}/role`, needs: "super" },
  { method: "get", path: "/api/admin/audit-logs", needs: "audit.read" },
  { method: "get", path: "/api/admin/staff", needs: "super" },
  { method: "post", path: "/api/admin/staff", needs: "super" },
  { method: "patch", path: `/api/admin/staff/${ZERO}`, needs: "super" },
  { method: "delete", path: `/api/admin/staff/${ZERO}`, needs: "super" },
  { method: "patch", path: `/api/admin/staff/${ZERO}/super-admin`, needs: "super" },
  { method: "get", path: "/api/admin/staff-roles", needs: "super" },
  { method: "post", path: "/api/admin/staff-roles", needs: "super" },
  { method: "patch", path: `/api/admin/staff-roles/${ZERO}`, needs: "super" },
  { method: "delete", path: `/api/admin/staff-roles/${ZERO}`, needs: "super" },
  { method: "get", path: `/api/admin/users/${ZERO}`, needs: "users.read" },
  { method: "get", path: "/api/admin/blacklist", needs: "users.blacklist" },
  { method: "delete", path: `/api/admin/blacklist/${ZERO}`, needs: "users.blacklist" },
  { method: "get", path: "/api/admin/announcements", needs: "announcements.manage" },
  { method: "post", path: "/api/admin/announcements", needs: "announcements.manage" },
  { method: "patch", path: `/api/admin/announcements/${ZERO}`, needs: "announcements.manage" },
  { method: "delete", path: `/api/admin/announcements/${ZERO}`, needs: "announcements.manage" },
  { method: "get", path: "/api/admin/sports", needs: "categories.manage" },
  { method: "post", path: "/api/admin/sports", needs: "categories.manage" },
  { method: "patch", path: "/api/admin/sports/no-such-sport", needs: "categories.manage" },
  { method: "get", path: "/api/admin/teams", needs: "teams.moderate" },
  { method: "patch", path: `/api/admin/teams/${ZERO}/status`, needs: "teams.moderate" },
  { method: "delete", path: `/api/admin/teams/${ZERO}`, needs: "teams.moderate" },
  { method: "get", path: "/api/admin/match-reports", needs: "reports.verify" },
  { method: "post", path: `/api/admin/match-reports/${ZERO}/resolve`, needs: "disputes.resolve" },
  { method: "get", path: "/api/admin/tournaments", needs: "tournaments.review" },
  { method: "post", path: `/api/admin/tournaments/${ZERO}/review`, needs: "tournaments.review" },
  { method: "post", path: `/api/admin/tournaments/${ZERO}/cancel`, needs: "tournaments.review" },
  { method: "get", path: "/api/admin/grounds", needs: "grounds.review" },
  { method: "post", path: `/api/admin/grounds/${ZERO}/review`, needs: "grounds.review" },
  { method: "post", path: "/api/admin/grounds", needs: "grounds.manage" },
  { method: "patch", path: `/api/admin/grounds/${ZERO}`, needs: "grounds.manage" },
  { method: "get", path: "/api/admin/plans", needs: "plans.manage" },
  { method: "post", path: "/api/admin/plans", needs: "plans.manage" },
  { method: "patch", path: `/api/admin/plans/${ZERO}`, needs: "plans.manage" },
  { method: "get", path: "/api/admin/subscriptions", needs: "subscriptions.manage" },
  { method: "post", path: `/api/admin/subscriptions/${ZERO}/end`, needs: "subscriptions.manage" },
  { method: "get", path: "/api/admin/payments", needs: "payments.read" },
  { method: "post", path: `/api/admin/payments/${ZERO}/verify`, needs: "payments.verify" },
  { method: "post", path: `/api/admin/payments/${ZERO}/reject`, needs: "payments.verify" },
  { method: "post", path: `/api/admin/payments/${ZERO}/refund`, needs: "payments.refund" },
  { method: "get", path: "/api/admin/merchants", needs: "merchants.review" },
  { method: "post", path: `/api/admin/merchants/${ZERO}/review`, needs: "merchants.review" },
  { method: "get", path: "/api/admin/products", needs: "products.review" },
  { method: "post", path: `/api/admin/products/${ZERO}/review`, needs: "products.review" },
  { method: "get", path: "/api/admin/orders", needs: "orders.manage" },
  { method: "post", path: `/api/admin/reviews/${ZERO}/visibility`, needs: "products.review" },
  { method: "get", path: "/api/admin/shop-categories", needs: "categories.manage" },
  { method: "post", path: "/api/admin/shop-categories", needs: "categories.manage" },
  { method: "patch", path: `/api/admin/shop-categories/${ZERO}`, needs: "categories.manage" },
  { method: "get", path: "/api/admin/overview", needs: "analytics.read" },
  { method: "get", path: "/api/admin/reports", needs: "moderation.reports" },
  { method: "post", path: `/api/admin/reports/${ZERO}/resolve`, needs: "moderation.reports" },
  { method: "get", path: "/api/admin/settings", needs: "super" },
  { method: "patch", path: "/api/admin/settings", needs: "super" },
  { method: "patch", path: `/api/admin/users/${ZERO}`, needs: "users.edit" },
];

const call = (method: string, path: string, token: string, body: object = {}) =>
  (api() as any)[method](path).set(auth(token)).send(body);

describe("RBAC route protection", () => {
  it("the route table covers every admin route", async () => {
    const router = (await import("../src/routes/adminRoutes")).default as any;
    const registered = router.stack.filter((l: any) => l.route).length;
    expect(registered).toBe(ROUTES.length);
  });

  it("staff with no permissions are denied everything except their own permission list", async () => {
    const s = await registerStaff([]);
    for (const r of ROUTES) {
      const res = await call(r.method, r.path, s.token);
      if (r.needs === "staff") expect(res.status, `${r.method} ${r.path}`).toBe(200);
      else expect(res.status, `${r.method} ${r.path}`).toBe(403);
    }
  });

  // Checks every route against every other route, so it needs a longer timeout.
  it("each permission opens only its own route", async () => {
    for (const r of ROUTES.filter((x) => x.needs !== "super" && x.needs !== "staff")) {
      const s = await registerStaff([r.needs]);
      const own = await call(r.method, r.path, s.token, { status: "active" });
      expect(own.status, `${r.method} ${r.path} with ${r.needs}`).not.toBe(403);
      for (const other of ROUTES.filter((x) => x.needs !== r.needs && x.needs !== "staff")) {
        const res = await call(other.method, other.path, s.token);
        expect(res.status, `${other.method} ${other.path} with only ${r.needs}`).toBe(403);
      }
    }
  }, 300_000);

  it("no permission opens Super Admin routes, even every grantable one together", async () => {
    const all = DEFAULT_STAFF_ROLES.flatMap((r) => r.permissions);
    const s = await registerStaff([...new Set(all)]);
    for (const r of ROUTES.filter((x) => x.needs === "super")) {
      expect((await call(r.method, r.path, s.token)).status, `${r.method} ${r.path}`).toBe(403);
    }
  });

  it("reserved permissions stored in the database are ignored", async () => {
    const s = await registerStaff(["staff.manage", "settings.manage"]);
    const me = await api().get("/api/admin/me/permissions").set(auth(s.token));
    expect(me.body.permissions).toEqual([]);
    expect((await api().get("/api/admin/staff").set(auth(s.token))).status).toBe(403);
  });

  it("permissions come from the database: revoking one takes effect on the next request", async () => {
    const s = await registerStaff(["users.read"]);
    expect((await api().get("/api/admin/users").set(auth(s.token))).status).toBe(200);
    await User.updateOne({ _id: s.id }, { $set: { "permissionOverrides.revoke": ["users.read"] } });
    expect((await api().get("/api/admin/users").set(auth(s.token))).status).toBe(403);
  });

  it("a player who has leftover staff fields holds no permissions", async () => {
    const p = await registerUser();
    await User.updateOne({ _id: p.id }, { $set: { isSuperAdmin: true, permissionOverrides: { grant: ["users.read"], revoke: [] } } });
    expect((await api().get("/api/admin/users").set(auth(p.token))).status).toBe(403);
    expect((await api().get("/api/admin/me/permissions").set(auth(p.token))).status).toBe(403);
  });

  it("role permissions apply, and a deleted role fails closed", async () => {
    await ensureDefaultStaffRoles();
    const hr = await StaffRole.findOne({ key: "hr_manager" });
    const s = await registerStaff([], hr!._id.toString());
    expect((await api().get("/api/admin/users").set(auth(s.token))).status).toBe(200);
    expect((await api().get("/api/admin/audit-logs").set(auth(s.token))).status).toBe(200);
    await StaffRole.deleteOne({ _id: hr!._id });
    expect((await api().get("/api/admin/users").set(auth(s.token))).status).toBe(403);
  });
});

describe("staff management escalation rules", () => {
  it("only a Super Admin can promote users; a staff member can't make anyone admin", async () => {
    const s = await registerStaff(["users.read", "users.suspend"]);
    const p = await registerUser();
    expect((await call("patch", `/api/admin/users/${p.id}/role`, s.token, { role: "admin" })).status).toBe(403);
    expect((await call("post", "/api/admin/staff", s.token, { userId: p.id })).status).toBe(403);
    expect((await User.findById(p.id))!.role).toBe("player");
  });

  it("a staff member can't change their own access", async () => {
    const s = await registerStaff(["users.suspend"]);
    expect((await call("patch", `/api/admin/users/${s.id}/status`, s.token, { status: "active" })).status).toBe(400);
    expect((await call("patch", `/api/admin/staff/${s.id}`, s.token, { grant: ["users.read"] })).status).toBe(403);
  });

  it("a Super Admin can't change their own staff access", async () => {
    const a = await registerAdmin();
    expect((await call("patch", `/api/admin/staff/${a.id}`, a.token, { grant: ["users.read"] })).status).toBe(400);
    expect((await call("patch", `/api/admin/staff/${a.id}/super-admin`, a.token, { value: false })).status).toBe(400);
    expect((await call("delete", `/api/admin/staff/${a.id}`, a.token)).status).toBe(400);
  });

  it("staff can't suspend or ban other staff or a Super Admin", async () => {
    const s = await registerStaff(["users.suspend", "users.blacklist"]);
    const colleague = await registerStaff([]);
    const boss = await registerAdmin();
    for (const target of [colleague, boss]) {
      const res = await call("patch", `/api/admin/users/${target.id}/status`, s.token, { status: "suspended", reason: "coup" });
      expect(res.status).toBe(403);
    }
    expect((await User.findById(boss.id))!.status).toBe("active");
  });

  it("banning needs users.blacklist on top of users.suspend", async () => {
    const s = await registerStaff(["users.suspend"]);
    const p = await registerUser();
    expect((await call("patch", `/api/admin/users/${p.id}/status`, s.token, { status: "banned", reason: "fraud" })).status).toBe(403);
    expect((await call("patch", `/api/admin/users/${p.id}/status`, s.token, { status: "suspended", reason: "spam" })).status).toBe(200);

    const strong = await registerStaff(["users.suspend", "users.blacklist"]);
    expect((await call("patch", `/api/admin/users/${p.id}/status`, strong.token, { status: "banned", reason: "fraud" })).status).toBe(200);
    // Lifting a ban also needs users.blacklist.
    expect((await call("patch", `/api/admin/users/${p.id}/status`, s.token, { status: "active" })).status).toBe(403);
  });

  it("the last Super Admin can't be removed, demoted or blocked", async () => {
    const a = await registerAdmin();
    const b = await registerAdmin();
    // Two exist: a can remove b's Super Admin status.
    expect((await call("patch", `/api/admin/staff/${b.id}/super-admin`, a.token, { value: false })).status).toBe(200);
    // b is now plain staff and can't act on a.
    expect((await call("patch", `/api/admin/staff/${a.id}/super-admin`, b.token, { value: false })).status).toBe(403);
    expect((await call("patch", `/api/admin/users/${a.id}/role`, b.token, { role: "player" })).status).toBe(403);
    expect((await User.findById(a.id))!.isSuperAdmin).toBe(true);
  });

  it("two Super Admins demoting each other at once can't leave none", async () => {
    const a = await registerAdmin();
    const b = await registerAdmin();
    const results = await Promise.all([
      call("patch", `/api/admin/staff/${b.id}/super-admin`, a.token, { value: false }),
      call("patch", `/api/admin/staff/${a.id}/super-admin`, b.token, { value: false }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await User.countDocuments({ role: "admin", isSuperAdmin: true })).toBe(1);
  });

  it("reserved and unknown permissions can't be put in a role or granted", async () => {
    const a = await registerAdmin();
    const p = await registerUser();
    for (const bad of [["staff.manage"], ["settings.manage"], ["everything"]]) {
      expect((await call("post", "/api/admin/staff-roles", a.token, { key: "x_role", name: "X", permissions: bad })).status).toBe(400);
      expect((await call("post", "/api/admin/staff", a.token, { userId: p.id, grant: bad })).status).toBe(400);
    }
  });

  it("demoting staff to player clears every staff field", async () => {
    const a = await registerAdmin();
    const s = await registerStaff(["users.read"]);
    expect((await call("patch", `/api/admin/users/${s.id}/role`, a.token, { role: "player" })).status).toBe(200);
    const u = await User.findById(s.id);
    expect(u!.role).toBe("player");
    expect(u!.isSuperAdmin).toBe(false);
    expect(u!.permissionOverrides.grant).toEqual([]);
    // Promoted again via the role route, they start with nothing.
    expect((await call("patch", `/api/admin/users/${s.id}/role`, a.token, { role: "admin" })).status).toBe(200);
    expect((await api().get("/api/admin/users").set(auth(s.token))).status).toBe(403);
  });
});

describe("staff and role management (Super Admin)", () => {
  it("full lifecycle: create role, add staff, update, remove — all audited", async () => {
    const a = await registerAdmin();
    const p = await registerUser();

    const role = await call("post", "/api/admin/staff-roles", a.token, {
      key: "moderator",
      name: "Moderator",
      permissions: ["users.read", "moderation.reports"],
    });
    expect(role.status).toBe(201);

    const added = await call("post", "/api/admin/staff", a.token, { userId: p.id, staffRoleId: role.body.role.id, revoke: ["moderation.reports"] });
    expect(added.status).toBe(201);
    expect(added.body.staff.effectivePermissions).toEqual(["users.read"]);
    expect((await api().get("/api/admin/users").set(auth(p.token))).status).toBe(200);

    const me = await api().get("/api/auth/me").set(auth(p.token));
    expect(me.body.user.permissions).toEqual(["users.read"]);
    expect(me.body.user.isSuperAdmin).toBe(false);

    const updated = await call("patch", `/api/admin/staff/${p.id}`, a.token, { grant: ["audit.read"] });
    expect(updated.body.staff.effectivePermissions).toEqual(["audit.read", "users.read"]);

    const list = await api().get("/api/admin/staff-roles").set(auth(a.token));
    expect(list.body.roles.find((r: any) => r.key === "moderator").memberCount).toBe(1);

    // Can't delete a role that's in use.
    expect((await call("delete", `/api/admin/staff-roles/${role.body.role.id}`, a.token)).status).toBe(409);

    expect((await call("delete", `/api/admin/staff/${p.id}`, a.token)).status).toBe(200);
    expect((await api().get("/api/admin/users").set(auth(p.token))).status).toBe(403);
    expect((await call("delete", `/api/admin/staff-roles/${role.body.role.id}`, a.token)).status).toBe(200);

    const actions = (await AuditLog.find().select("action").lean()).map((l) => l.action);
    for (const act of ["staff_role.created", "staff.added", "staff.updated", "staff.removed", "staff_role.deleted"]) {
      expect(actions).toContain(act);
    }
  });

  it("built-in roles are seeded once, editable, and not deletable", async () => {
    expect(await ensureDefaultStaffRoles()).toBe(DEFAULT_STAFF_ROLES.length);
    expect(await ensureDefaultStaffRoles()).toBe(0);
    const a = await registerAdmin();
    const fin = await StaffRole.findOne({ key: "finance_manager" });
    const edit = await call("patch", `/api/admin/staff-roles/${fin!._id}`, a.token, { permissions: ["payments.read"] });
    expect(edit.status).toBe(200);
    expect(edit.body.role.permissions).toEqual(["payments.read"]);
    expect((await call("delete", `/api/admin/staff-roles/${fin!._id}`, a.token)).status).toBe(400);
    // Re-seeding never overwrites an edited role.
    await ensureDefaultStaffRoles();
    expect((await StaffRole.findById(fin!._id))!.permissions).toEqual(["payments.read"]);
  });

  it("players' /auth/me has no permission fields", async () => {
    const p = await registerUser();
    const me = await api().get("/api/auth/me").set(auth(p.token));
    expect(me.body.user.permissions).toBeUndefined();
    expect(me.body.user.isSuperAdmin).toBeUndefined();
  });
});
