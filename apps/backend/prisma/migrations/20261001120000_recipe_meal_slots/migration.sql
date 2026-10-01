-- Generated with `prisma migrate diff` (prisma migrate dev needs a TTY that isn't
-- available in this environment).
-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "mealSlots" "MealSlot"[] DEFAULT ARRAY['lunch', 'dinner']::"MealSlot"[];
