import { Request, Response, NextFunction } from "express";

export async function requirePremium(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const expired = user.membershipExpiresAt !== null && user.membershipExpiresAt < new Date();

  if (expired && user.isPremium) {
    user.isPremium = false;
    await user.save();
  }

  if (!user.isPremium || expired) {
    res.status(403).json({ message: "Premium membership required" });
    return;
  }

  next();
}
