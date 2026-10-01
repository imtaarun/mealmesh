import type { Ingredient } from "@prisma/client";
import type { IngredientConversion } from "@mealmesh/domain";

/** A stored ingredient → what the domain unit converter needs (nulls become absent). */
export function toConversion(ingredient: Ingredient): IngredientConversion {
  return {
    id: ingredient.id,
    baseUnit: ingredient.baseUnit,
    ...(ingredient.gramsPerPiece !== null ? { gramsPerPiece: ingredient.gramsPerPiece } : {}),
    ...(ingredient.gramsPerCup !== null ? { gramsPerCup: ingredient.gramsPerCup } : {}),
    ...(ingredient.density !== null ? { density: ingredient.density } : {}),
  };
}
