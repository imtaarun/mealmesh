// docs/algorithms.md §2. Round to purchase increments after summing, never per recipe.

import { convertToBaseUnit } from "../units/index.js";
import type { AggregatedDemand, GroceryLineItem, IngredientConversion, RecipeIngredientDemand, Unit } from "../types.js";

/** One line per ingredient and unit; lines that couldn't convert stay separate rather than adding up wrongly. */
export function aggregateDemand(
  demands: RecipeIngredientDemand[],
  ingredients: Record<string, IngredientConversion>,
): AggregatedDemand[] {
  const groups = new Map<string, AggregatedDemand>();

  for (const demand of demands) {
    const ingredient = ingredients[demand.ingredientId];
    if (!ingredient) {
      throw new Error(`aggregateDemand: unknown ingredientId "${demand.ingredientId}"`);
    }

    const scaledQuantity = demand.quantity * (demand.mealServings / demand.recipeServings);
    const converted = convertToBaseUnit({ value: scaledQuantity, unit: demand.unit }, ingredient);

    const groupKey = converted.isNominal
      ? `${demand.ingredientId}|nominal`
      : `${demand.ingredientId}|${converted.unit}`;

    const existing = groups.get(groupKey);
    if (existing) {
      existing.totalQuantity += converted.value;
    } else {
      groups.set(groupKey, {
        ingredientId: demand.ingredientId,
        totalQuantity: converted.value,
        unit: converted.unit,
        needsReview: converted.needsReview,
        isNominal: converted.isNominal,
      });
    }
  }

  return [...groups.values()];
}

const PURCHASE_INCREMENTS: Partial<Record<Unit, number>> = {
  piece: 1,
  g: 50,
  ml: 50,
};

/** The step a quantity of this unit is bought in; 1 when there's no sensible step. */
export function purchaseIncrement(unit: Unit): number {
  return PURCHASE_INCREMENTS[unit] ?? 1;
}

export function roundUpToPurchaseIncrement(quantity: number, unit: Unit): number {
  if (quantity <= 0) return 0;
  const increment = PURCHASE_INCREMENTS[unit];
  if (!increment) return quantity; // no sensible increment for this unit — pass through
  return Math.ceil(quantity / increment) * increment;
}

/** needsReview and nominal lines pass through: they can't be compared with pantry quantities. */
export function applyPantryAndRound(demand: AggregatedDemand, pantryQuantity: number): GroceryLineItem {
  if (demand.needsReview || demand.isNominal) {
    return {
      ingredientId: demand.ingredientId,
      neededQuantity: demand.totalQuantity,
      pantryCovered: 0,
      finalQuantity: demand.totalQuantity,
      unit: demand.unit,
      needsReview: demand.needsReview,
      isNominal: demand.isNominal,
    };
  }

  const needed = Math.max(0, demand.totalQuantity - pantryQuantity);
  const finalQuantity = roundUpToPurchaseIncrement(needed, demand.unit);

  return {
    ingredientId: demand.ingredientId,
    neededQuantity: needed,
    pantryCovered: Math.min(pantryQuantity, demand.totalQuantity),
    finalQuantity,
    unit: demand.unit,
    needsReview: false,
    isNominal: false,
  };
}

/** Produce with a known piece weight is bought by count: "Onions — 3", not "450 g". */
export function soldByCount(ingredient: { category: string; gramsPerPiece?: number | null }): boolean {
  return ingredient.category === "Produce" && !!ingredient.gramsPerPiece;
}

/**
 * The week's shopping lines: summed, pantry subtracted, rounded. Count-sold produce is
 * converted to whole pieces; "to taste" lines drop off when the pantry has any.
 */
export function buildGroceryList(
  demands: RecipeIngredientDemand[],
  ingredients: Record<string, IngredientConversion & { category: string }>,
  pantry: Record<string, number>,
): GroceryLineItem[] {
  return aggregateDemand(demands, ingredients).flatMap((demand) => {
    const have = pantry[demand.ingredientId] ?? 0;
    if (demand.isNominal && have > 0) return [];
    const line = applyPantryAndRound(demand, have);
    const ingredient = ingredients[demand.ingredientId]!;
    if (!soldByCount(ingredient) || line.isNominal || line.needsReview) return [line];
    const perPiece = ingredient.gramsPerPiece!;
    const pieces = line.neededQuantity / perPiece;
    return [{ ...line, unit: "piece" as const, neededQuantity: pieces, pantryCovered: line.pantryCovered / perPiece, finalQuantity: Math.ceil(pieces - 1e-9) }];
  });
}
