-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "totalMinutes" INTEGER NOT NULL DEFAULT 0;

UPDATE "Recipe" SET "totalMinutes" = "prepMinutes" + "cookMinutes";
