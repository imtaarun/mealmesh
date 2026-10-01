import { createHash, randomInt } from "node:crypto";

// Invite codes are typed or pasted by people, so they're short and skip look-alike
// characters (0/O, 1/I/L). 8 characters from 31 gives ~8.5e11 combinations; codes
// are single-use and expire after INVITE_TTL_MS, and only the hash is stored.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** Normalizes what a person typed ("abcd-2345 ", lower case) before hashing. */
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
}
