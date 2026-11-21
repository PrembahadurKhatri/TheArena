// Runs before every test file. Tests never read backend/.env: they get an
// in-memory MongoDB and safe dummy settings, so they can't touch Atlas,
// Cloudinary or Resend.
import os from "os";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";


process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing-000";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.MEMBERSHIP_MONTHLY_PRICE = "299";
process.env.MEMBERSHIP_YEARLY_PRICE = "2999";
process.env.RATE_LIMIT_MAX = "100000";
process.env.AUTH_RATE_LIMIT_MAX = "100000";
for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "SMTP_HOST", "PAYMENT_MODE", "MONGO_URI"]) {
  delete process.env[key];
}
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "arena-test-uploads-"));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("arena-test"));
  // Build unique indexes (e.g. one pending payment per order) before tests run.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
