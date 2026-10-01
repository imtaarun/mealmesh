import { describe, expect, it } from "vitest";
import {
  aggregateDemand,
  applyPantryAndRound,
  checkRecipeConflicts,
  convertToBaseUnit,
  mainProtein,
  optimizeBasket,
  planWeek,
  type PlannerRecipe,
  type PlanWeekInput,
  type ProductOption,
  type RecipeIngredientDemand,
} from "@mealmesh/domain";
import {
  buildCatalog,
  demoHousehold,
  ingredientsById,
  recipes,
  recipesById,
  referencePrices,
  stores,
  validateSeedData,
  type Catalog,
} from "../src/index.js";

const NOW = new Date("2026-09-25T12:00:00Z");
const catalog = buildCatalog(stores, referencePrices, NOW);

function currentPriceCents(c: Catalog, productId: string, now: Date): number {
  const inEffect = c.prices.filter(
    (p) => p.productId === productId && p.effectiveFrom <= now && (p.effectiveTo === null || p.effectiveTo > now),
  );
  return Math.min(...inEffect.map((p) => p.priceCents));
}

describe("seed data", () => {
  it("passes cross-file validation", () => {
    expect(validateSeedData()).toEqual([]);
  });

  it("has the P0 volume: 30 recipes, 100+ ingredients, 5 stores, 150+ products", () => {
    expect(recipes).toHaveLength(30);
    expect(ingredientsById.size).toBeGreaterThanOrEqual(100);
    expect(stores).toHaveLength(5);
    expect(catalog.products.length).toBeGreaterThanOrEqual(150);
  });

  it("sells every recipe ingredient at two or more stores, so the optimizer has a choice", () => {
    const storesByIngredient = new Map<string, Set<string>>();
    for (const p of catalog.products) {
      storesByIngredient.set(p.ingredientId, (storesByIngredient.get(p.ingredientId) ?? new Set()).add(p.storeId));
    }
    for (const recipe of recipes) {
      for (const line of recipe.ingredients) {
        expect(storesByIngredient.get(line.ingredientId)?.size ?? 0, `${recipe.id}: ${line.ingredientId}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("buildCatalog", () => {
  it("is deterministic — the same inputs always produce the same prices", () => {
    expect(buildCatalog(stores, referencePrices, NOW)).toEqual(catalog);
  });

  it("keeps each store's regular price within its priceFactor ± priceVariance of the reference", () => {
    const refById = new Map(referencePrices.map((r) => [r.ingredientId, r.priceCents]));
    for (const store of stores) {
      for (const product of catalog.products.filter((p) => p.storeId === store.id)) {
        const regular = catalog.prices.find((p) => p.productId === product.id && p.effectiveTo === null)!;
        const expected = refById.get(product.ingredientId)! * store.priceFactor;
        // +10 cents covers rounding to a shelf price ($x.x9).
        expect(Math.abs(regular.priceCents - expected), product.id).toBeLessThanOrEqual(expected * store.priceVariance + 10);
      }
    }
  });

  it("gives every product one current regular price plus an older one", () => {
    for (const product of catalog.products) {
      const regular = catalog.prices.filter((p) => p.productId === product.id && !p.isSale);
      expect(regular).toHaveLength(2);
      expect(regular.filter((p) => p.effectiveTo === null)).toHaveLength(1);
    }
  });

  it("prices each deal as a sale row below the regular price, in effect now", () => {
    expect(catalog.deals.length).toBe(stores.reduce((n, s) => n + s.deals.length, 0));
    for (const deal of catalog.deals) {
      const sale = catalog.prices.find((p) => p.productId === deal.productId && p.isSale)!;
      expect(sale.priceCents).toBeLessThan(sale.regularPriceCents!);
      expect(currentPriceCents(catalog, deal.productId, NOW)).toBe(sale.priceCents);
      expect(deal.startsAt <= NOW && deal.endsAt > NOW).toBe(true);
    }
  });

  it("rejects a deal on something the store doesn't carry", () => {
    const bad = [{ ...stores[3]!, deals: [{ ingredientId: "bacon", discountPercent: 10 }] }];
    expect(() => buildCatalog(bad, referencePrices, NOW)).toThrow(/doesn't carry/);
  });
});

// docs/product-spec.md: "Recipes must be chosen so ingredient reuse is genuinely
// possible — a random 30 will make the optimizer look broken." Run a realistic demo
// week (2 people, Indian + Mediterranean + North American, leftovers on) through the
// real domain pipeline against the demo pantry and the generated catalog.
describe("demo week against the seeded catalog", () => {
  const week: Array<[recipeId: string, servings: number]> = [
    ["chana-masala", 4], // cooks extra for a leftover lunch
    ["chicken-shawarma-rice-bowls", 2],
    ["greek-salad-grilled-chicken", 4],
    ["red-lentil-dal", 4],
    ["sheet-pan-chicken-veggies", 2],
    ["butter-chicken", 4],
    ["lemon-garlic-salmon-couscous", 2],
    ["veggie-omelette", 2],
    ["egg-bhurji", 2],
  ];

  const demands: RecipeIngredientDemand[] = week.flatMap(([recipeId, mealServings]) => {
    const recipe = recipesById.get(recipeId)!;
    return recipe.ingredients
      .filter((line) => !line.optional)
      .map((line) => ({ recipeId, ingredientId: line.ingredientId, quantity: line.quantity, unit: line.unit, recipeServings: recipe.servings, mealServings }));
  });
  const pantry = new Map(demoHousehold.pantry.map((p) => [p.ingredientId, p.quantity]));
  const toBuy = aggregateDemand(demands, Object.fromEntries(ingredientsById))
    .map((d) => applyPantryAndRound(d, pantry.get(d.ingredientId) ?? 0))
    .filter((line) => !line.isNominal && line.neededQuantity > 0);

  const candidatesByIngredient: Record<string, ProductOption[]> = {};
  for (const p of catalog.products) {
    (candidatesByIngredient[p.ingredientId] ??= []).push({
      productId: p.id,
      storeId: p.storeId,
      ingredientId: p.ingredientId,
      priceCents: currentPriceCents(catalog, p.id, NOW),
      packSize: p.packSize,
      packUnit: ingredientsById.get(p.ingredientId)!.baseUnit,
    });
  }
  const optimize = (strategy: "min_cost" | "min_stores" | "best_overall") =>
    optimizeBasket({
      strategy,
      items: toBuy.map((line) => ({ ingredientId: line.ingredientId, neededQuantity: line.neededQuantity })),
      candidatesByIngredient,
      storeDistances: stores.map((s) => ({ storeId: s.id, distanceKm: 3 })),
    });

  it("converts cleanly and leaves the pantry doing real work", () => {
    expect(toBuy.some((line) => line.needsReview)).toBe(false);
    expect(toBuy.some((line) => line.pantryCovered > 0)).toBe(true);
  });

  it("finds everything, and a second store saves money over the best single store", () => {
    const single = optimize("min_stores");
    const best = optimize("best_overall");
    const cheapest = optimize("min_cost");

    expect(single.unavailableItemIds).toEqual([]);
    expect(best.storeBreakdown.length).toBe(2);
    expect(best.totalCents).toBeLessThan(single.totalCents);
    expect(cheapest.totalCents).toBeLessThanOrEqual(best.totalCents);
    expect(best.topSavingsDrivers.length).toBeGreaterThan(0);
  });
});

// Plan My Week on the real library and the demo household (docs/product-spec.md demo
// scenario) — the same shaping PlanMyWeekService does, so a recipe or weighting change
// that makes the week worse fails here.
describe("Plan My Week for the demo household", () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const prefs = (type: string) => demoHousehold.preferences.filter((p) => p.type === type).map((p) => p.value);
  const unitPriceCents: Record<string, number> = {};
  for (const p of catalog.products) {
    const unit = currentPriceCents(catalog, p.id, NOW) / p.packSize;
    unitPriceCents[p.ingredientId] = Math.min(unitPriceCents[p.ingredientId] ?? Infinity, unit);
  }
  const plannerRecipes: PlannerRecipe[] = recipes
    .map((r) => ({ r, conflicts: checkRecipeConflicts({
      ingredients: r.ingredients.map((l) => ({ ingredientId: l.ingredientId, name: ingredientsById.get(l.ingredientId)!.name, aliases: ingredientsById.get(l.ingredientId)!.aliases })),
      allergyValues: prefs("allergy"),
      dislikeValues: prefs("dislike"),
    }) }))
    .filter(({ conflicts }) => !conflicts.blocked)
    .map(({ r, conflicts }) => ({
      id: r.id,
      servings: r.servings,
      totalMinutes: r.prepMinutes + r.cookMinutes,
      cuisines: r.cuisines,
      dietTags: r.dietTags,
      mealSlots: r.mealSlots,
      ingredients: r.ingredients.filter((l) => !l.optional).map((l) => {
        const ingredient = ingredientsById.get(l.ingredientId)!;
        return { ingredientId: l.ingredientId, quantity: convertToBaseUnit({ value: l.quantity, unit: l.unit }, ingredient).value, proteinGroup: ingredient.proteinGroup ?? null, isStaple: ingredient.isStaple };
      }),
      dislikeMatches: conflicts.warnings.length,
    }));
  const input: PlanWeekInput = {
    recipes: plannerRecipes,
    days: Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 5) + i * dayMs).toISOString().slice(0, 10), busy: false, eatOut: false })),
    servings: demoHousehold.defaultServings,
    maxCookMinutes: Number(prefs("max_cook_minutes")[0]),
    requiredDietTags: [],
    goalDietTags: prefs("diet"),
    likedCuisines: prefs("cuisine_like"),
    leftovers: prefs("leftover_tolerance")[0] === "true",
    pantry: Object.fromEntries(demoHousehold.pantry.map((p) => [p.ingredientId, p.quantity])),
    expiringIngredientIds: demoHousehold.pantry.filter((p) => p.expiresInDays !== undefined && p.expiresInDays <= 5).map((p) => p.ingredientId),
    dealIngredientIds: [...new Set(catalog.deals.map((d) => catalog.products.find((p) => p.id === d.productId)!.ingredientId))],
    unitPriceCents,
    avoidRecipeIds: [],
  };
  const week = planWeek(input);
  const dinners = week.filter((m) => m.slot === "dinner").map((m) => plannerRecipes.find((r) => r.id === m.recipeId)!);

  it("cooks seven different dinners, each within the 35-minute limit and suited to dinner", () => {
    expect(new Set(dinners.map((r) => r.id)).size).toBe(7);
    for (const r of dinners) {
      expect(r.totalMinutes, r.id).toBeLessThanOrEqual(35);
      expect(r.mealSlots, r.id).toContain("dinner");
    }
  });

  it("never serves the disliked mushrooms, and stays mostly healthy", () => {
    expect(dinners.every((r) => !r.ingredients.some((i) => i.ingredientId === "mushroom"))).toBe(true);
    expect(dinners.filter((r) => r.dietTags.includes("healthy")).length).toBeGreaterThanOrEqual(5);
  });

  it("varies proteins and cuisines, and uses up the spinach and yogurt about to expire", () => {
    expect(new Set(dinners.map(mainProtein)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(dinners.map((r) => r.cuisines[0])).size).toBeGreaterThanOrEqual(2);
    const used = new Set(dinners.flatMap((r) => r.ingredients.map((i) => i.ingredientId)));
    expect(used.has("spinach") && used.has("greek-yogurt")).toBe(true);
  });

  it("turns six dinners into next-day leftover lunches", () => {
    expect(week.filter((m) => m.type === "leftover")).toHaveLength(6);
  });
});
