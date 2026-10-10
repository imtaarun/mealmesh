import { createHash, randomInt } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

// No look-alike characters (0/O, 1/I/L). Single-use and expiring; only the hash is stored.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** Normalizes what a person typed ("abcd-2345 ", lower case) before hashing. */
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
}

/** Marks a valid invite used, atomically: of two people racing with one code, only one gets in. */
export async function claimInvite(tx: Prisma.TransactionClient, code: string) {
  const codeHash = hashInviteCode(code);
  const claimed = await tx.householdInvite.updateMany({
    where: { codeHash, acceptedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count !== 1) throw new BadRequestException("That invite code isn't valid any more — ask for a new one");
  return tx.householdInvite.findUniqueOrThrow({ where: { codeHash } });
}
