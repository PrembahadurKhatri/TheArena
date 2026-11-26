import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

// Strips MongoDB operator keys ("$gt", "$ne", ...) and dotted keys from the
// JSON/form body so a payload like { "email": { "$ne": null } } can never
// reach a query as an operator. (Express 5's default query parser only
// yields strings/arrays, so req.query cannot carry operator objects.)
function stripOperators(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOperators);
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      clean[key] = stripOperators(v);
    }
    return clean;
  }
  return value;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = stripOperators(req.body);
  }
  next();
}

const json429 = (message: string) => ({
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ message });
  },
});

// Broad cap for the whole API, per IP.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 600,
  ...json429("Too many requests, please slow down and try again shortly."),
});

// Login / register: brute-force and signup-spam protection.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  ...json429("Too many attempts. Please wait 15 minutes and try again."),
});

// Actions that create content for other people (invitations, challenges,
// reports, reviews, listings): stop one client flooding them.
export const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.ACTION_RATE_LIMIT_MAX) || 60,
  ...json429("You're doing that a lot. Please wait a few minutes and try again."),
});

// Password reset emails: stop the endpoint being used to spam inboxes.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  ...json429("Too many password reset requests. Please try again in an hour."),
});
