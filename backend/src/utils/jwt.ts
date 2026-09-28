import jwt from "jsonwebtoken";
import { Types } from "mongoose";

export interface JwtPayload {
  id: string;
  role: "player" | "admin";
}

export function signToken(userId: Types.ObjectId | string, role: "player" | "admin"): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in .env");
  }
  return jwt.sign({ id: userId.toString(), role }, secret, { expiresIn: "7d" });
}

export function verifyJwt(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in .env");
  }
  return jwt.verify(token, secret) as JwtPayload;
}
