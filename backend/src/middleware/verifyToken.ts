import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt";
import { User, IUser, UserRole } from "../models/User";

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

type LoadResult = { user: IUser } | { error: "invalid" | "blocked"; status?: string };

// Loads the user for a token. A token is only valid while:
//  - its signature and expiry check out,
//  - the user still exists,
//  - its session version matches the user's (password reset, logout from all
//    devices and suspension bump the version, killing older tokens),
//  - the account is active.
// It also lazily downgrades an expired premium membership, so every
// downstream check sees the real membership state.
async function loadUser(token: string): Promise<LoadResult> {
  let payload;
  try {
    payload = verifyJwt(token);
  } catch {
    return { error: "invalid" };
  }
  const user = await User.findById(payload.id).select("+tokenVersion");
  if (!user) return { error: "invalid" };
  if ((payload.v ?? 0) !== (user.tokenVersion ?? 0)) return { error: "invalid" };
  if (user.status !== "active") return { error: "blocked", status: user.status };

  if (user.isPremium && user.membershipExpiresAt && user.membershipExpiresAt < new Date()) {
    user.isPremium = false;
    await user.save();
  }
  return { user };
}

function blockedMessage(status?: string) {
  return status === "banned"
    ? "This account has been banned. Contact support if you think this is a mistake."
    : "This account is suspended. Contact support for help.";
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  let result: LoadResult;
  try {
    result = await loadUser(token);
  } catch (err) {
    next(err);
    return;
  }
  if ("error" in result) {
    if (result.error === "blocked") {
      res.status(403).json({ message: blockedMessage(result.status), code: "ACCOUNT_BLOCKED" });
    } else {
      res.status(401).json({ message: "Invalid or expired token" });
    }
    return;
  }

  req.user = result.user;
  next();
}

// For public routes that show extra data to a logged-in viewer (e.g. a team
// owner seeing pending join requests). Never rejects: a missing, bad or
// blocked token just means an anonymous request.
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (token) {
    try {
      const result = await loadUser(token);
      if ("user" in result) req.user = result.user;
    } catch {
      // ignore — treat as anonymous
    }
  }
  next();
}

/**
 * Allow only the given platform roles. Must come after verifyToken. The role
 * is read from the database user (loaded by verifyToken), never from the
 * token, so a demoted admin loses access immediately.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "You don't have permission to do this" });
      return;
    }
    next();
  };
}
