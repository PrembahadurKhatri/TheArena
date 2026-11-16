import jwt from "jsonwebtoken";
import { Types } from "mongoose";

export interface JwtPayload {
  id: string;
  role: "player" | "admin";
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(userId: Types.ObjectId | string, role: "player" | "admin"): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
  return jwt.sign({ id: userId.toString(), role }, getSecret(), { expiresIn, algorithm: "HS256" });
}

export function verifyJwt(token: string): JwtPayload {
  // Pin the algorithm so a token signed with anything else is rejected.
  return jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as JwtPayload;
}
