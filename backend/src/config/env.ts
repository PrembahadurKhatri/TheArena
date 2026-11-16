// Central place for reading and validating environment variables. Called once
// at startup (server.ts) so a misconfigured deploy fails fast with a clear
// message instead of failing on the first request that needs the value.

export const isProduction = process.env.NODE_ENV === "production";

const REQUIRED = ["MONGO_URI", "JWT_SECRET"] as const;

export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (isProduction) {
    if ((process.env.JWT_SECRET ?? "").length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters in production");
    }
    if (getAllowedOrigins().length === 0) {
      throw new Error("CLIENT_URL must be set in production (your Vercel frontend URL)");
    }
  }
}

// CLIENT_URL may hold one origin or a comma-separated list, e.g.
// "https://thearena.vercel.app,https://www.thearena.com.np".
export function getAllowedOrigins(): string[] {
  const raw = process.env.CLIENT_URL ?? (isProduction ? "" : "http://localhost:5173");
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// The frontend origin used in emails (password reset links): the first
// entry of CLIENT_URL.
export function getPrimaryClientUrl(): string {
  return getAllowedOrigins()[0] ?? "http://localhost:5173";
}

// Test-mode payments let the logged-in user confirm their own payment with
// no gateway involved. That is fine in development and for a demo, but in
// production it means anyone can grant themselves premium / mark orders as
// paid — so it must be switched on explicitly there.
export function isTestPaymentsEnabled(): boolean {
  if (process.env.PAYMENT_MODE) return process.env.PAYMENT_MODE === "test";
  return !isProduction;
}
