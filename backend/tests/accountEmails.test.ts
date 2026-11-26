import { vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
vi.mock("../src/utils/sendEmail", () => ({
  sendEmail: vi.fn(async (o: { to: string; subject: string }) => {
    sent.push({ to: o.to, subject: o.subject });
  }),
}));

import { api } from "./helpers";
import { User } from "../src/models/User";

const flush = () => new Promise((r) => setTimeout(r, 20));

describe("account emails", () => {
  const prev = process.env.SMTP_HOST;
  beforeAll(() => {
    process.env.SMTP_HOST = "smtp.example.com";
  });
  afterAll(() => {
    process.env.SMTP_HOST = prev;
  });
  beforeEach(() => {
    sent.length = 0;
  });

  it("sends a welcome email on sign-up and a sign-in alert on login", async () => {
    const reg = await api().post("/api/auth/register").send({ name: "Mail Person", email: "mail.person@gmail.com", password: "Str0ng!Passw0rd" });
    expect(reg.status).toBe(201);
    await flush();
    expect(sent).toEqual([{ to: "mail.person@gmail.com", subject: "Welcome to The Arena" }]);

    sent.length = 0;
    const login = await api().post("/api/auth/login").send({ email: "mail.person@gmail.com", password: "Str0ng!Passw0rd" });
    expect(login.status).toBe(200);
    await flush();
    expect(sent).toEqual([{ to: "mail.person@gmail.com", subject: "New sign-in to your The Arena account" }]);
  });

  it("respects the email opt-out for sign-in alerts", async () => {
    await api().post("/api/auth/register").send({ name: "Quiet Person", email: "quiet.person@gmail.com", password: "Str0ng!Passw0rd" });
    await User.updateOne({ email: "quiet.person@gmail.com" }, { $set: { "privacy.emailNotifications": false } });
    await flush();
    sent.length = 0;
    await api().post("/api/auth/login").send({ email: "quiet.person@gmail.com", password: "Str0ng!Passw0rd" });
    await flush();
    expect(sent).toEqual([]);
  });

  it("never emails reserved test domains (demo data)", async () => {
    await api().post("/api/auth/register").send({ name: "Demo Person", email: "demo.person@demo.thearena.test", password: "Str0ng!Passw0rd" });
    await api().post("/api/auth/login").send({ email: "demo.person@demo.thearena.test", password: "Str0ng!Passw0rd" });
    await flush();
    expect(sent).toEqual([]);
  });
});
