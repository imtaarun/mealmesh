// Grocery aggregation — docs/algorithms.md section 2.
// demand = sum over non-leftover meals of (recipe qty * mealServings/recipeServings),
// converted to base unit, grouped by ingredientId. needed = demand - pantry (floor 0).
// Round to a purchase increment AFTER summing, never per recipe.

import { convertToBaseUnit } from "../units/index.js";
import type { AggregatedDemand, GroceryLineItem, IngredientConversion, RecipeIngredientDemand, Unit } from "../types.js";

/**
 * Aggregate recipe-ingredient demand across a plan into one line per
 * (ingredientId, resolved unit). Same-ingredient lines that converted cleanly to the
 * ingredient's baseUnit are summed together; lines that couldn't convert (needsReview)
 * are kept separate per their original unit, so "200g spinach" and "1 bunch spinach"
 * with no gramsPerPiece stay as two honest lines instead of a wrong combined number.
 * Nominal quantities ("a pinch of salt") never contribute to the sum, but still need a
 * line so the ingredient shows up on the list.
 */
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

function roundUpToPurchaseIncrement(quantity: number, unit: Unit): number {
  if (quantity <= 0) return 0;
  const increment = PURCHASE_INCREMENTS[unit];
  if (!increment) return quantity; // no sensible increment for this unit — pass through
  return Math.ceil(quantity / increment) * increment;
}

/**
 * needed = demand - pantryQuantity (floor 0); round up to a purchase increment.
 * Pantry subtraction only applies to lines that resolved to the ingredient's real
 * baseUnit — a needsReview or nominal line can't be safely compared against a
 * baseUnit pantry quantity, so it passes through unrounded and uncovered.
 */
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
