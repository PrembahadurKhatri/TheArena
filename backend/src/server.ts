import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";

const PORT = process.env.PORT ?? 5050;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] The Arena API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
