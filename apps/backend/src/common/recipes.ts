import type { Ingredient, Prisma } from "@prisma/client";
import { checkRecipeConflicts, convertToBaseUnit, type IngredientConversion, type PlannerRecipe, type Unit } from "@mealmesh/domain";

export type RecipeWithIngredients = Prisma.RecipeGetPayload<{ include: { ingredients: { include: { ingredient: true } } } }>;

export function toConversion(ingredient: Ingredient): IngredientConversion {
  return {
    id: ingredient.id,
    baseUnit: ingredient.baseUnit,
    ...(ingredient.gramsPerPiece !== null ? { gramsPerPiece: ingredient.gramsPerPiece } : {}),
    ...(ingredient.gramsPerCup !== null ? { gramsPerCup: ingredient.gramsPerCup } : {}),
    ...(ingredient.density !== null ? { density: ingredient.density } : {}),
  };
}

/** Optional lines dropped, quantities in base units. */
export function toPlannerRecipe(recipe: RecipeWithIngredients, dislikeMatches = 0): PlannerRecipe {
  return {
    id: recipe.id,
    servings: recipe.servings,
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
    cuisines: recipe.cuisines,
    dietTags: recipe.dietTags,
    mealSlots: recipe.mealSlots,
    ingredients: recipe.ingredients
      .filter((line) => !line.optional)
      .map((line) => ({
        ingredientId: line.ingredientId,
        quantity: convertToBaseUnit({ value: line.quantity, unit: line.unit as Unit }, toConversion(line.ingredient)).value,
        proteinGroup: line.ingredient.proteinGroup,
        isStaple: line.ingredient.isStaple,
      })),
    dislikeMatches,
  };
}

export function recipeConflicts(recipe: RecipeWithIngredients, preferences: Array<{ type: string; value: string }>) {
  const values = (type: string) => preferences.filter((p) => p.type === type).map((p) => p.value);
  return checkRecipeConflicts({
    ingredients: recipe.ingredients.map((ri) => ({ ingredientId: ri.ingredientId, name: ri.ingredient.name, aliases: ri.ingredient.aliases })),
    allergyValues: values("allergy"),
    dislikeValues: values("dislike"),
  });
}
