// Idempotent: upserts by stable id and replaces child rows. Re-run to roll deals forward.

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
      proteinGroup: ingredient.proteinGroup ?? null,
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
      mealSlots: recipe.mealSlots,
      instructions: recipe.instructions,
      source: "seed" as const,
    };
    await prisma.recipe.upsert({
      where: { id: recipe.id },
      create: { id: recipe.id, ...data },
      update: data,
    });

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

  // The demo account's password is public (README), so it never goes into production by accident.
  const withDemo = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_SEED === "true";
  if (withDemo) await seedDemoHousehold(now);
  else console.log("NODE_ENV=production: skipping the demo account (set ALLOW_DEMO_SEED=true to include it).");

  console.log(
    `Seeded ${ingredients.length} ingredients, ${recipes.length} recipes, ${stores.length} stores, ` +
      `${catalog.products.length} products, ${catalog.prices.length} prices, ${catalog.deals.length} deals, ` +
      (withDemo ? `and the demo household (${demoHousehold.email}).` : "and no demo account."),
  );
}

/** The product-spec demo scenario: one account, preferences, and a sample pantry. */
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
  const userId =
    existing?.id ??
    (await prisma.user.create({ data: { email: demo.email, passwordHash: await bcrypt.hash(demo.password, 10), householdId } })).id;
  await prisma.user.update({ where: { id: userId }, data: { birthYear: 1990, ageConfirmedAt: now } });
  const member = { name: "Demo", role: "owner" as const, profileCompletedAt: now };
  await prisma.householdMember.upsert({ where: { userId }, create: { ...member, householdId, userId }, update: member });

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
