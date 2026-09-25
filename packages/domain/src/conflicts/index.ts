// Conflict checking for Build My Week — docs/ux.md "Build My Week", refined in
// docs/open-questions.md item 9. Allergies are a hard veto; dislikes are a
// dismissible warning. The user resolves both in the moment of picking a dish, not
// through an automated resolution algorithm (that only applies to the Pro
// auto-generate path, per item 9).
//
// Known simplification: matching is case-insensitive substring matching between a
// preference value and an ingredient's name/aliases (e.g. allergy "peanut" matches
// ingredient "Peanut Butter"). It does not understand allergen categories (e.g.
// allergy "tree_nut" will not match ingredient "Almonds") — that needs a real
// ingredient -> allergen classification, which docs/open-questions.md notes as an
// unmodelled gap. This is deliberately conservative in the direction that's safe:
// it will miss some matches, but it will never invent a false negative from a typo
// in either direction being silently "smart-matched."

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
