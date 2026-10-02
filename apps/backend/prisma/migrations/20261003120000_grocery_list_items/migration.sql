-- DropForeignKey
ALTER TABLE "GroceryListItem" DROP CONSTRAINT "GroceryListItem_ingredientId_fkey";

-- AlterTable
ALTER TABLE "GroceryListItem" ADD COLUMN     "alreadyHave" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customName" TEXT,
ADD COLUMN     "isNominal" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "ingredientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GroceryListItem" ADD CONSTRAINT "GroceryListItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

