
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { api, auth, registerUser } from "./helpers";
import { User } from "../src/models/User";

const SECRET = () => process.env.JWT_SECRET!;

describe("authentication", () => {
  it("rejects an expired token (#9)", async () => {
    const u = await registerUser();
    const expired = jwt.sign({ id: u.id, role: "player", v: 0 }, SECRET(), { algorithm: "HS256", expiresIn: -10 });
    const res = await api().get("/api/auth/me").set(auth(expired));
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with another secret or with alg=none", async () => {
    const u = await registerUser();
    const forged = jwt.sign({ id: u.id, role: "admin", v: 0 }, "attacker-secret", { algorithm: "HS256" });
    expect((await api().get("/api/auth/me").set(auth(forged))).status).toBe(401);

    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ id: u.id, role: "admin", v: 0 })).toString("base64url");
    expect((await api().get("/api/auth/me").set(auth(`${header}.${payload}.`))).status).toBe(401);
  });

  it("logout-all revokes every existing session (#10)", async () => {
    const u = await registerUser();
    const second = await api().post("/api/auth/login").send({ email: u.email, password: u.password });
    expect(second.status).toBe(200);

    expect((await api().post("/api/auth/logout-all").set(auth(u.token))).status).toBe(200);
    expect((await api().get("/api/auth/me").set(auth(u.token))).status).toBe(401);
    expect((await api().get("/api/auth/me").set(auth(second.body.token))).status).toBe(401);

    // Logging in again issues a working token.
    const fresh = await api().post("/api/auth/login").send({ email: u.email, password: u.password });
    expect((await api().get("/api/auth/me").set(auth(fresh.body.token))).status).toBe(200);
  });

  it("a password reset revokes old sessions", async () => {
    const u = await registerUser();
    const resetToken = "a".repeat(64);
    await User.updateOne(
      { _id: u.id },
      {
        $set: {
          resetPasswordToken: crypto.createHash("sha256").update(resetToken).digest("hex"),
          resetPasswordExpires: new Date(Date.now() + 60_000),
        },
      }
    );
    const reset = await api().post(`/api/auth/reset-password/${resetToken}`).send({ password: "BrandNewPass42!" });
    expect(reset.status).toBe(200);
    expect((await api().get("/api/auth/me").set(auth(u.token))).status).toBe(401);
    // The reset link works once only.
    expect((await api().post(`/api/auth/reset-password/${resetToken}`).send({ password: "Another1Pass!" })).status).toBe(400);
  });

  it("accepts tokens issued before session versions existed (no v claim)", async () => {
    const u = await registerUser();
    const legacy = jwt.sign({ id: u.id, role: "player" }, SECRET(), { algorithm: "HS256", expiresIn: "1h" });
    expect((await api().get("/api/auth/me").set(auth(legacy))).status).toBe(200);
  });

  it("registration ignores role and status in the body (mass assignment)", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "Sneaky", email: "sneaky@example.com", password: "CorrectHorse9!", role: "admin", isPremium: true, status: "active" });
    expect(res.status).toBe(201);
    const user = await User.findById(res.body.user.id);
    expect(user!.role).toBe("player");
    expect(user!.isPremium).toBe(false);
  });

  it("profile updates can't set role, premium or an arbitrary photo URL", async () => {
    const u = await registerUser();
    const res = await api()
      .patch("/api/auth/me")
      .set(auth(u.token))
      .send({ name: "Renamed", role: "admin", isPremium: true, membershipExpiresAt: "2099-01-01", photo: "https://evil.example/pixel.gif" });
    expect(res.status).toBe(200);
    const user = await User.findById(u.id);
    expect(user!.name).toBe("Renamed");
    expect(user!.role).toBe("player");
    expect(user!.isPremium).toBe(false);
    expect(user!.photo).toBeNull();
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const u = await registerUser();
    const wrong = await api().post("/api/auth/login").send({ email: u.email, password: "nope-nope-nope" });
    const unknown = await api().post("/api/auth/login").send({ email: "nobody@example.com", password: "nope-nope-nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it("upgrades an old cost-10 password hash on login", async () => {
    const u = await registerUser();
    await User.updateOne({ _id: u.id }, { $set: { passwordHash: await bcrypt.hash(u.password, 10) } });
    expect((await api().post("/api/auth/login").send({ email: u.email, password: u.password })).status).toBe(200);
    const user = await User.findById(u.id).select("+passwordHash");
    expect(bcrypt.getRounds(user!.passwordHash)).toBe(12);
  });

  it("rejects NoSQL operator injection in login", async () => {
    await registerUser({ email: "victim@example.com" });
    const res = await api().post("/api/auth/login").send({ email: "victim@example.com", password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});
