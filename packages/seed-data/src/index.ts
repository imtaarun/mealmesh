import taxonomiesJson from "./taxonomies.json";
import ingredientsJson from "./ingredients.json";
import recipesJson from "./recipes.json";
import referencePricesJson from "./reference-prices.json";
import storesJson from "./stores.json";
import demoHouseholdJson from "./demo-household.json";
import { convertToBaseUnit } from "@mealmesh/domain";
import type { SeedDemoHousehold, SeedIngredient, SeedRecipe, SeedReferencePrice, SeedStore, Taxonomies } from "./types.js";

export const taxonomies = taxonomiesJson as Taxonomies;
export const ingredients = ingredientsJson as SeedIngredient[];
export const recipes = recipesJson as SeedRecipe[];
export const referencePrices = referencePricesJson as SeedReferencePrice[];
export const stores = storesJson as SeedStore[];
export const demoHousehold = demoHouseholdJson as SeedDemoHousehold;

export const ingredientsById: ReadonlyMap<string, SeedIngredient> = new Map(
  ingredients.map((i) => [i.id, i]),
);

export const recipesById: ReadonlyMap<string, SeedRecipe> = new Map(recipes.map((r) => [r.id, r]));

export * from "./types.js";
export { buildCatalog, type Catalog, type CatalogDeal, type CatalogPrice, type CatalogProduct } from "./catalog.js";

/**
 * Cross-checks the JSON files against each other: every ingredientId, unit, cuisine,
 * dietTag, and difficulty referenced by a recipe, store, price, or the demo pantry must
 * exist in the corresponding source of truth, and every ingredient must have a
 * reference price. Run this whenever the JSON changes —
 * apps/backend/prisma/seed.ts should call it before writing anything to the database,
 * so a typo in a recipe never silently seeds a broken reference.
 */
export function validateSeedData(): string[] {
  const errors: string[] = [];
  const validUnits = new Set([
    ...taxonomies.units.mass,
    ...taxonomies.units.volume,
    ...taxonomies.units.count,
    ...taxonomies.units.nominal,
  ]);
  const validCuisines = new Set(taxonomies.cuisines);
  const validDietTags = new Set(taxonomies.dietTags);
  const validDifficulty = new Set(taxonomies.difficulty);

  for (const recipe of recipes) {
    if (!validDifficulty.has(recipe.difficulty)) {
      errors.push(`${recipe.id}: unknown difficulty "${recipe.difficulty}"`);
    }
    for (const cuisine of recipe.cuisines) {
      if (!validCuisines.has(cuisine)) errors.push(`${recipe.id}: unknown cuisine "${cuisine}"`);
    }
    for (const tag of recipe.dietTags) {
      if (!validDietTags.has(tag)) errors.push(`${recipe.id}: unknown dietTag "${tag}"`);
    }
    for (const line of recipe.ingredients) {
      if (!ingredientsById.has(line.ingredientId)) {
        errors.push(`${recipe.id}: unknown ingredientId "${line.ingredientId}"`);
      }
      if (!validUnits.has(line.unit)) {
        errors.push(`${recipe.id}: unknown unit "${line.unit}" on ${line.ingredientId}`);
      }
      // docs/algorithms.md §1: seed data must carry conversion factors for every
      // ingredient the seed recipes use, so nothing lands on the list as needsReview.
      const ingredient = ingredientsById.get(line.ingredientId);
      if (ingredient && convertToBaseUnit({ value: line.quantity, unit: line.unit }, ingredient).needsReview) {
        errors.push(`${recipe.id}: ${line.quantity} ${line.unit} of ${line.ingredientId} can't convert to ${ingredient.baseUnit}`);
      }
    }
    const stepNumbers = recipe.instructions.map((s) => s.step);
    const expected = stepNumbers.map((_, i) => i + 1);
    if (JSON.stringify(stepNumbers) !== JSON.stringify(expected)) {
      errors.push(`${recipe.id}: instruction steps are not sequential starting at 1`);
    }
  }

  const pricedIds = new Set(referencePrices.map((p) => p.ingredientId));
  for (const ingredient of ingredients) {
    if (!pricedIds.has(ingredient.id)) errors.push(`reference-prices.json: no price for ${ingredient.id}`);
  }
  for (const price of referencePrices) {
    if (!ingredientsById.has(price.ingredientId)) {
      errors.push(`reference-prices.json: unknown ingredientId "${price.ingredientId}"`);
    }
  }
  for (const store of stores) {
    const ids = [
      ...(store.onlyIngredientIds ?? []),
      ...(store.excludedIngredientIds ?? []),
      ...store.deals.map((d) => d.ingredientId),
    ];
    for (const id of ids) {
      if (!ingredientsById.has(id)) errors.push(`stores.json: ${store.id} references unknown ingredientId "${id}"`);
    }
  }
  for (const item of demoHousehold.pantry) {
    if (!ingredientsById.has(item.ingredientId)) {
      errors.push(`demo-household.json: unknown pantry ingredientId "${item.ingredientId}"`);
    }
  }

  return errors;
}
