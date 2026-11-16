import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  mongoose.connection.on("disconnected", () => console.warn("[db] disconnected — the driver will keep retrying"));
  mongoose.connection.on("reconnected", () => console.log("[db] reconnected"));
  mongoose.connection.on("error", (err) => console.error("[db] connection error:", err.message));

  await mongoose.connect(uri, {
    // Fail the startup within 15s if Atlas is unreachable (wrong URI, IP not
    // allow-listed) instead of hanging the deploy.
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
    // Only used when the URI does not name a database itself.
    dbName: process.env.MONGO_DB_NAME || undefined,
  });
  console.log(`[db] connected -> ${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.connection.close();
}

export function isDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
