// Create the first platform admin, or promote an existing account.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' ADMIN_NAME='Your Name' npm run create-admin
//   (production: npm run build && ... npm run create-admin:prod)
//
// - If no account has ADMIN_EMAIL, one is created with ADMIN_PASSWORD.
// - If it exists, it's promoted to admin and reactivated; its password is
//   left alone unless ADMIN_RESET_PASSWORD=true.
// The password is read from the environment only — never pass it on a shared
// machine's command history, and never commit it.
import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import { audit } from "../services/auditService";
import { requireEmail } from "../utils/validation";

const MIN_ADMIN_PASSWORD = 12;

async function main() {
  const email = requireEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = (process.env.ADMIN_NAME || "Platform Admin").trim().slice(0, 80);
  const resetPassword = process.env.ADMIN_RESET_PASSWORD === "true";

  await connectDB();
  const existing = await User.findOne({ email });

  if (!existing || resetPassword) {
    if (password.length < MIN_ADMIN_PASSWORD) {
      throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD} characters`);
    }
  }

  if (!existing) {
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      status: "active",
    });
    await audit({ actor: null, action: "user.admin_created", target: { type: "user", id: user._id }, after: { email, role: "admin" } });
    console.log(`[create-admin] created admin ${email}`);
    return;
  }

  const before = { role: existing.role, status: existing.status };
  const update: any = { $set: { role: "admin", status: "active", statusReason: null } };
  if (resetPassword) {
    update.$set.passwordHash = await bcrypt.hash(password, 12);
    update.$inc = { tokenVersion: 1 };
  }
  await User.updateOne({ _id: existing._id }, update);
  await audit({
    actor: null,
    action: "user.role_changed",
    target: { type: "user", id: existing._id },
    before,
    after: { role: "admin", status: "active", passwordReset: resetPassword },
    reason: "create-admin script",
  });
  console.log(`[create-admin] ${email} is now an admin${resetPassword ? " (password reset)" : ""}`);
}

main()
  .catch((err) => {
    console.error("[create-admin] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
