import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/authRoutes";
import sportsRoutes from "./routes/sportsRoutes";
import teamsRoutes from "./routes/teamsRoutes";
import playersRoutes from "./routes/playersRoutes";
import tournamentsRoutes from "./routes/tournamentsRoutes";
import groundsRoutes from "./routes/groundsRoutes";
import groundBookingsRoutes from "./routes/groundBookingsRoutes";
import myBookingsRoutes from "./routes/myBookingsRoutes";
import paymentsRoutes from "./routes/paymentsRoutes";
import membershipRoutes from "./routes/membershipRoutes";
import rankingsRoutes from "./routes/rankingsRoutes";
import { AppError } from "./utils/AppError";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "the-arena-backend" });
});

// Route mounts are added here as each resource is built.
app.use("/api/auth", authRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/tournaments", tournamentsRoutes);
app.use("/api/grounds", groundsRoutes);
app.use("/api/ground-bookings", groundBookingsRoutes);
app.use("/api/my", myBookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/rankings", rankingsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
});

// Central error handler — every thrown/rejected error lands here and is
// shaped into the contract's `{ message: string }` error body.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  if (err && err.name === "ValidationError") {
    res.status(400).json({ message: err.message });
    return;
  }

  if (err && err.type === "entity.parse.failed") {
    res.status(400).json({ message: "Malformed JSON body" });
    return;
  }

  if (err && err.name === "CastError") {
    res.status(400).json({ message: `Invalid id: ${err.value}` });
    return;
  }

  if (err && err.code === 11000) {
    res.status(409).json({ message: "Duplicate value violates a unique constraint" });
    return;
  }

  if (err && (err.name === "MulterError" || err.message === "Only image files are allowed")) {
    res.status(400).json({ message: err.message });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
