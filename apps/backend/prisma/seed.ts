// Seed script — docs/product-spec.md "Seed data requirements (P0)" and
// docs/roadmap.md Phase 3: 30 recipes (with full conversion data on every referenced
// ingredient), 100 ingredients, 5 stores, 150 products, multiple prices per product,
// deals, price history, one sample pantry. Canadian pricing and terminology.
//
// Everything comes from @mealmesh/seed-data and is upserted by a stable id, so
// re-running this script is safe (updates in place, no duplicates). Child rows —
// recipe ingredient lines, product prices, deals, the demo pantry and preferences —
// are replaced wholesale on each run. Deals run from 2 days before the seed to 5 days
// after (packages/seed-data/src/catalog.ts); re-run the seed to roll them forward.
//
// Prices are approximate, not live retailer data (docs/open-questions.md item 1).
// PriceHistory is not seeded: it records what a household actually paid (receipts,
// P2); the price timeline lives on ProductPrice (effectiveFrom/effectiveTo).

import { PrismaClient, type BaseUnit, type BudgetTier, type Difficulty, type PreferenceType, type SubscriptionTier } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import {
  buildCatalog,
  demoHousehold,
  ingredients,
  ingredientsById,
  recipes,
  referencePrices,
  stores,
  validateSeedData,
} from "@mealmesh/seed-data";

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

  const now = new Date();
  const catalog = buildCatalog(stores, referencePrices, now);

  for (const store of stores) {
    const data = { name: store.name, chain: store.chain, address: store.address, lat: store.lat, lng: store.lng, isDemo: true };
    await prisma.store.upsert({ where: { id: store.id }, create: { id: store.id, ...data }, update: data });
  }

  for (const product of catalog.products) {
    const data = {
      name: product.name,
      brand: product.brand,
      packSize: product.packSize,
      packUnit: ingredientsById.get(product.ingredientId)!.baseUnit as BaseUnit,
      storeId: product.storeId,
      ingredientId: product.ingredientId,
    };
    await prisma.product.upsert({ where: { id: product.id }, create: { id: product.id, ...data }, update: data });
  }

  const productIds = catalog.products.map((p) => p.id);
  await prisma.productPrice.deleteMany({ where: { productId: { in: productIds }, source: "mock" } });
  await prisma.productPrice.createMany({ data: catalog.prices.map((price) => ({ ...price, source: "mock" as const })) });
  await prisma.deal.deleteMany({ where: { productId: { in: productIds }, mealPlanId: null } });
  await prisma.deal.createMany({ data: catalog.deals });

  await seedDemoHousehold(now);

  console.log(
    `Seeded ${ingredients.length} ingredients, ${recipes.length} recipes, ${stores.length} stores, ` +
      `${catalog.products.length} products, ${catalog.prices.length} prices, ${catalog.deals.length} deals, ` +
      `and the demo household (${demoHousehold.email}).`,
  );
}

/** docs/product-spec.md "Demo scenario": one account with preferences and a sample pantry. */
async function seedDemoHousehold(now: Date) {
  const demo = demoHousehold;
  const householdData = {
    name: demo.householdName,
    weeklyBudgetCents: demo.weeklyBudgetCents,
    budgetTier: demo.budgetTier as BudgetTier,
    subscriptionTier: demo.subscriptionTier as SubscriptionTier,
    defaultServings: demo.defaultServings,
    timezone: demo.timezone,
  };

  const existing = await prisma.user.findUnique({ where: { email: demo.email } });
  const householdId = existing
    ? (await prisma.household.update({ where: { id: existing.householdId }, data: householdData })).id
    : (await prisma.household.create({ data: householdData })).id;
  if (!existing) {
    await prisma.user.create({
      data: { email: demo.email, passwordHash: await bcrypt.hash(demo.password, 10), householdId },
    });
  }

  await prisma.preference.deleteMany({ where: { householdId } });
  await prisma.preference.createMany({
    data: demo.preferences.map((p) => ({ type: p.type as PreferenceType, value: p.value, householdId })),
  });

  await prisma.pantryItem.deleteMany({ where: { householdId } });
  await prisma.pantryItem.createMany({
    data: demo.pantry.map((item) => ({
      householdId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: ingredientsById.get(item.ingredientId)!.baseUnit as BaseUnit,
      location: item.location,
      expiresAt: item.expiresInDays === undefined ? null : new Date(now.getTime() + item.expiresInDays * 24 * 60 * 60 * 1000),
    })),
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
