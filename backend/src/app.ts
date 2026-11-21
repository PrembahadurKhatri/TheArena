import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";

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
import shopRoutes from "./routes/shopRoutes";
import challengesRoutes from "./routes/challengesRoutes";
import adminRoutes from "./routes/adminRoutes";
import { requestContext, getRequestContext } from "./middleware/requestContext";
import { AppError } from "./utils/AppError";
import { uploadsDir } from "./utils/upload";
import { getAllowedOrigins, isProduction, isTestPaymentsEnabled } from "./config/env";
import { isDBConnected } from "./config/db";
import { apiLimiter, sanitizeBody } from "./middleware/security";

const app = express();

// Render terminates TLS at its proxy; trust one hop so req.ip (used by the
// rate limiter) is the real client IP, not the proxy's.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(requestContext);

app.use(
  helmet({
    // The Vercel frontend (a different origin) must be able to <img> our
    // /uploads files.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: same-origin, curl, Render's health check.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(sanitizeBody);

app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "7d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

// Health check for Render — no rate limit, reports DB state. Returns 503
// while Mongo is down so Render can see the instance is unhealthy.
app.get("/api/health", (_req, res) => {
  const db = isDBConnected();
  res.status(db ? 200 : 503).json({
    ok: db,
    service: "the-arena-backend",
    db: db ? "connected" : "disconnected",
    paymentMode: isTestPaymentsEnabled() ? "test" : "disabled",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use("/api", apiLimiter);

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
app.use("/api/shop", shopRoutes);
app.use("/api/challenges", challengesRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.path}` });
});

// Central error handler — every thrown/rejected error lands here and is
// shaped into the contract's `{ message: string }` error body. Internal
// details and stack traces are logged server-side only.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  if (err && err.name === "ValidationError") {
    const first = err.errors ? (Object.values(err.errors)[0] as any) : null;
    res.status(400).json({ message: first?.message ?? "Invalid data" });
    return;
  }

  if (err && (err.type === "entity.parse.failed" || err.type === "entity.too.large")) {
    res.status(err.status ?? 400).json({ message: err.type === "entity.too.large" ? "Request body too large" : "Malformed JSON body" });
    return;
  }

  if (err && err.name === "CastError") {
    res.status(400).json({ message: "Invalid id" });
    return;
  }

  if (err && err.code === 11000) {
    res.status(409).json({ message: "Duplicate value violates a unique constraint" });
    return;
  }

  if (err && err.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : err.message;
    res.status(400).json({ message });
    return;
  }

  const requestId = getRequestContext()?.requestId;
  console.error(`[error] ${req.method} ${req.originalUrl} requestId=${requestId}`, isProduction ? err?.message ?? err : err);
  if (isProduction && err?.stack) console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
