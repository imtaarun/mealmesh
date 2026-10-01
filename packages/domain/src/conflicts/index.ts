// Allergies veto, dislikes warn. Substring match on name and aliases only — no allergen
// categories ("tree_nut" won't match "Almonds").

import type { ConflictCheckInput, ConflictCheckResult, ConflictMatch, RecipeIngredientName } from "../types.js";

function matches(ingredient: RecipeIngredientName, preferenceValue: string): boolean {
  const needle = preferenceValue.trim().toLowerCase();
  if (!needle) return false;
  const haystacks = [ingredient.name, ...ingredient.aliases].map((s) => s.toLowerCase());
  return haystacks.some((h) => h.includes(needle));
}

function findMatches(ingredients: RecipeIngredientName[], values: string[]): ConflictMatch[] {
  const found: ConflictMatch[] = [];
  for (const ingredient of ingredients) {
    for (const value of values) {
      if (matches(ingredient, value)) {
        found.push({ ingredientId: ingredient.ingredientId, preferenceValue: value });
      }
    }
  }
  return found;
}

export function checkRecipeConflicts(input: ConflictCheckInput): ConflictCheckResult {
  const blockedMatches = findMatches(input.ingredients, input.allergyValues);
  const warnings = findMatches(input.ingredients, input.dislikeValues);

  return {
    blocked: blockedMatches.length > 0,
    blockedMatches,
    warnings,
  };
}
