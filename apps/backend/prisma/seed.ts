// Seed script — docs/product-spec.md "Seed data requirements (P0)" and
// docs/roadmap.md Phase 3: 30 recipes (with full conversion data on every referenced
// ingredient), 100 ingredients, 5 stores, 150 products, multiple prices per product,
// deals, price history, one sample pantry. Canadian pricing and terminology.
//
// Ingredients and recipes come from @mealmesh/seed-data and are upserted by their
// stable slug id, so re-running this script is safe (updates in place, no duplicates).
// Still missing before Phase 3 is fully done: 15 more recipes to reach the P0 target
// of 30, and all store/product/price/deal data — @mealmesh/seed-data only covers food
// content, not pricing (docs/open-questions.md item 1: approximate pricing, not yet
// implemented as seed data).

import { PrismaClient, type BaseUnit, type Difficulty } from "@prisma/client";
import { ingredients, recipes, validateSeedData } from "@mealmesh/seed-data";

const prisma = new PrismaClient();

async function main() {
  const errors = validateSeedData();
  if (errors.length > 0) {
    throw new Error(`@mealmesh/seed-data failed validation:\n${errors.join("\n")}`);
  }

  for (const ingredient of ingredients) {
    const data = {
      name: ingredient.name,
      aliases: ingredient.aliases,
      category: ingredient.category,
      baseUnit: ingredient.baseUnit as BaseUnit,
      gramsPerPiece: ingredient.gramsPerPiece,
      gramsPerCup: ingredient.gramsPerCup,
      density: ingredient.density,
      shelfLifeDays: ingredient.shelfLifeDays,
      isStaple: ingredient.isStaple,
    };
    await prisma.ingredient.upsert({
      where: { id: ingredient.id },
      create: { id: ingredient.id, ...data },
      update: data,
    });
  }

  for (const recipe of recipes) {
    const data = {
      title: recipe.title,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      difficulty: recipe.difficulty as Difficulty,
      cuisines: recipe.cuisines,
      dietTags: recipe.dietTags,
      instructions: recipe.instructions,
      source: "seed" as const,
    };
    await prisma.recipe.upsert({
      where: { id: recipe.id },
      create: { id: recipe.id, ...data },
      update: data,
    });

    // Replace ingredient lines wholesale rather than diffing them — simpler, and
    // correct for a small, source-controlled recipe set re-seeded from scratch.
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    await prisma.recipeIngredient.createMany({
      data: recipe.ingredients.map((line) => ({
        recipeId: recipe.id,
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        unit: line.unit,
        note: line.note,
        optional: line.optional ?? false,
      })),
    });
  }

  console.log(`Seeded ${ingredients.length} ingredients and ${recipes.length} recipes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
