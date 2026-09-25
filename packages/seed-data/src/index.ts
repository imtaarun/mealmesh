import taxonomiesJson from "./taxonomies.json";
import ingredientsJson from "./ingredients.json";
import recipesJson from "./recipes.json";
import type { SeedIngredient, SeedRecipe, Taxonomies } from "./types.js";

export const taxonomies = taxonomiesJson as Taxonomies;
export const ingredients = ingredientsJson as SeedIngredient[];
export const recipes = recipesJson as SeedRecipe[];

export const ingredientsById: ReadonlyMap<string, SeedIngredient> = new Map(
  ingredients.map((i) => [i.id, i]),
);

export const recipesById: ReadonlyMap<string, SeedRecipe> = new Map(recipes.map((r) => [r.id, r]));

export * from "./types.js";

/**
 * Cross-checks recipes.json against ingredients.json and taxonomies.json: every
 * ingredientId, unit, cuisine, dietTag, and difficulty referenced by a recipe must
 * exist in the corresponding source of truth. Run this whenever the JSON changes —
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
    }
    const stepNumbers = recipe.instructions.map((s) => s.step);
    const expected = stepNumbers.map((_, i) => i + 1);
    if (JSON.stringify(stepNumbers) !== JSON.stringify(expected)) {
      errors.push(`${recipe.id}: instruction steps are not sequential starting at 1`);
    }
  }

  return errors;
}
