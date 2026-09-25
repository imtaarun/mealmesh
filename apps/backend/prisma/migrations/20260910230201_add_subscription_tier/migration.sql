-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('free', 'pro');

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'free';
