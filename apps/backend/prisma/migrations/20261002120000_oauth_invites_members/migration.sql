-- Generated with `prisma migrate diff` (prisma migrate dev needs a TTY that isn't
-- available in this environment), plus the backfill at the end.
-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'member');

-- AlterTable
ALTER TABLE "HouseholdMember" ADD COLUMN     "costShare" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "role" "MemberRole" NOT NULL DEFAULT 'member',
ADD COLUMN     "profileCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdInvite" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "householdId" TEXT NOT NULL,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_subject_key" ON "OAuthAccount"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_codeHash_key" ON "HouseholdInvite"("codeHash");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: every existing user becomes the owner member of their household, so the
-- housemates screen and the cost split include them. They already went through
-- onboarding, so their profile counts as complete.
INSERT INTO "HouseholdMember" ("id", "name", "householdId", "userId", "role", "profileCompletedAt")
SELECT gen_random_uuid()::text, split_part(u."email", '@', 1), u."householdId", u."id", 'owner', CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "HouseholdMember" m WHERE m."userId" = u."id");
