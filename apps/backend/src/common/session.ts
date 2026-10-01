import { createHash, randomBytes } from "node:crypto";

// Tokens are random, so a fast hash is enough (passwords use bcrypt).

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
