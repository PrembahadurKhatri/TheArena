import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt";
import { User } from "../models/User";

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const payload = verifyJwt(token);
    const user = await User.findById(payload.id);
    if (!user) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
