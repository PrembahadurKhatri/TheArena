import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { api, auth } from "./helpers";
import { User } from "../src/models/User";

// Users created before Phase 2 have no status / tokenVersion / lastLoginAt.
// They must keep working without a migration.
describe("existing (pre-Phase-2) user documents", () => {
  async function insertLegacyUser() {
    const { insertedId } = await mongoose.connection.db!.collection("users").insertOne({
      name: "Old Player",
      email: "old@example.com",
      passwordHash: await bcrypt.hash("OldPassword1!", 10),
      role: "player",
      isPremium: false,
      membershipExpiresAt: null,
      sportPreferences: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return insertedId.toString();
  }

  it("can still log in", async () => {
    await insertLegacyUser();
    const res = await api().post("/api/auth/login").send({ email: "old@example.com", password: "OldPassword1!" });
    expect(res.status).toBe(200);
  });

  it("keeps working with a token issued before the upgrade", async () => {
    const id = await insertLegacyUser();
    const oldToken = jwt.sign({ id, role: "player" }, process.env.JWT_SECRET!, { algorithm: "HS256", expiresIn: "7d" });
    const res = await api().get("/api/auth/me").set(auth(oldToken));
    expect(res.status).toBe(200);
    const user = await User.findById(id);
    expect(user!.status).toBe("active");
  });
});
