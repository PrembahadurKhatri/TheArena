import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import type { UserRole } from "../models/User";

export interface JwtPayload {
  id: string;
  role: UserRole;
  // Session version (User.tokenVersion) at the time the token was issued.
  // Tokens from before this claim existed have none and count as version 0.
  v?: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(user: { _id: Types.ObjectId | string; role: UserRole; tokenVersion?: number }): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
  const payload: JwtPayload = { id: user._id.toString(), role: user.role, v: user.tokenVersion ?? 0 };
  return jwt.sign(payload, getSecret(), { expiresIn, algorithm: "HS256" });
}

export function verifyJwt(token: string): JwtPayload {
  // Pin the algorithm so a token signed with anything else is rejected.
  return jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as JwtPayload;
}
