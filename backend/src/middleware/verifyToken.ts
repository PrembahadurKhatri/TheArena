import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt";
import { User, IUser } from "../models/User";

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

// Loads the user for a token and lazily downgrades an expired premium
// membership, so every downstream check (team limit, booking discount,
// tournament creation, /auth/me) sees the real membership state.
async function loadUser(token: string): Promise<IUser | null> {
  const payload = verifyJwt(token);
  const user = await User.findById(payload.id);
  if (!user) return null;

  if (user.isPremium && user.membershipExpiresAt && user.membershipExpiresAt < new Date()) {
    user.isPremium = false;
    await user.save();
  }
  return user;
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  let user: IUser | null;
  try {
    user = await loadUser(token);
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
  if (!user) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}

// For public routes that show extra data to a logged-in viewer (e.g. a team
// owner seeing pending join requests). Never rejects: a missing or bad token
// just means an anonymous request.
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (token) {
    try {
      const user = await loadUser(token);
      if (user) req.user = user;
    } catch {
      // ignore — treat as anonymous
    }
  }
  next();
}
