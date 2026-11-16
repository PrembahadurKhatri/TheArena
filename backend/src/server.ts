import dotenv from "dotenv";
dotenv.config();

import { Server } from "http";
import app from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { validateEnv } from "./config/env";
import { startExpirySweeper, stopExpirySweeper } from "./services/expiryService";

const PORT = Number(process.env.PORT) || 5050;
const HOST = process.env.HOST || "0.0.0.0";

let server: Server | null = null;
let shuttingDown = false;

async function start() {
  validateEnv();
  await connectDB();
  server = app.listen(PORT, HOST, () => {
    console.log(`[server] The Arena API listening on ${HOST}:${PORT} (${process.env.NODE_ENV ?? "development"})`);
  });
  startExpirySweeper();
}

// Render sends SIGTERM before stopping/replacing an instance. Stop taking new
// connections, let in-flight requests finish, close Mongo, then exit.
async function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error("[server] graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  stopExpirySweeper();
  try {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await disconnectDB();
  } catch (err) {
    console.error("[server] error during shutdown:", err);
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandled promise rejection:", reason);
});

// After an uncaught exception the process state is unknown — log it and
// exit so Render restarts a clean instance.
process.on("uncaughtException", (err) => {
  console.error("[server] uncaught exception:", err);
  shutdown("uncaughtException", 1);
});

start().catch((err) => {
  console.error("[server] failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
