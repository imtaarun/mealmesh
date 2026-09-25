import { createHash, randomBytes } from "node:crypto";

// Session tokens are high-entropy random bytes, not user secrets — a fast
// cryptographic hash is the right tool here, unlike passwords (bcrypt, in
// auth.service.ts) which must be deliberately slow to resist brute-forcing.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
