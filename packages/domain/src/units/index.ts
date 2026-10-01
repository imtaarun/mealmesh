// docs/algorithms.md §1. Never guesses: without conversion data the value stays in its
// own unit with needsReview.

import type { ConvertedQuantity, IngredientConversion, MassUnit, NominalUnit, Quantity, Unit, VolumeUnit } from "../types.js";

const MASS_TO_GRAMS: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_TO_ML: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
};

const NOMINAL_UNITS: readonly NominalUnit[] = ["pinch", "to_taste", "handful"];
const COUNT_UNITS = new Set(["piece", "clove", "bunch", "can"]);

function isMassUnit(unit: Unit): unit is MassUnit {
  return unit in MASS_TO_GRAMS;
}

function isVolumeUnit(unit: Unit): unit is VolumeUnit {
  return unit in VOLUME_TO_ML;
}

function isCountUnit(unit: Unit): boolean {
  return COUNT_UNITS.has(unit);
}

function isNominalUnit(unit: Unit): unit is NominalUnit {
  return (NOMINAL_UNITS as readonly string[]).includes(unit);
}

function ok(ingredientId: string, value: number, unit: Unit): ConvertedQuantity {
  return { ingredientId, value, unit, needsReview: false, isNominal: false };
}

function review(ingredientId: string, value: number, originalUnit: Unit): ConvertedQuantity {
  return { ingredientId, value, unit: originalUnit, needsReview: true, isNominal: false };
}

/** Grams already known — finish the hop into the ingredient's actual baseUnit. */
function fromGrams(ingredientId: string, grams: number, ingredient: IngredientConversion, originalUnit: Unit): ConvertedQuantity {
  if (ingredient.baseUnit === "g") return ok(ingredientId, grams, "g");
  if (ingredient.baseUnit === "ml") {
    if (ingredient.density) return ok(ingredientId, grams / ingredient.density, "ml");
    return review(ingredientId, grams, originalUnit);
  }
  // baseUnit === "piece": mass can't be turned into a count without gramsPerPiece.
  if (ingredient.gramsPerPiece) return ok(ingredientId, grams / ingredient.gramsPerPiece, "piece");
  return review(ingredientId, grams, originalUnit);
}

/** Millilitres already known — finish the hop into the ingredient's actual baseUnit. */
function fromMl(ingredientId: string, ml: number, ingredient: IngredientConversion, originalUnit: Unit): ConvertedQuantity {
  if (ingredient.baseUnit === "ml") return ok(ingredientId, ml, "ml");
  if (ingredient.baseUnit === "g") {
    if (ingredient.density) return ok(ingredientId, ml * ingredient.density, "g");
    return review(ingredientId, ml, originalUnit);
  }
  return review(ingredientId, ml, originalUnit);
}

export function convertToBaseUnit(quantity: Quantity, ingredient: IngredientConversion): ConvertedQuantity {
  const { value, unit } = quantity;

  if (isNominalUnit(unit)) {
    return { ingredientId: ingredient.id, value: 0, unit: ingredient.baseUnit, needsReview: false, isNominal: true };
  }

  if (isMassUnit(unit)) {
    const grams = value * MASS_TO_GRAMS[unit];
    return fromGrams(ingredient.id, grams, ingredient, unit);
  }

  if (isVolumeUnit(unit)) {
    // For dry goods, gramsPerCup beats density.
    if (unit === "cup" && ingredient.gramsPerCup !== undefined) {
      if (ingredient.baseUnit === "g") return ok(ingredient.id, value * ingredient.gramsPerCup, "g");
    }
    const ml = value * VOLUME_TO_ML[unit];
    return fromMl(ingredient.id, ml, ingredient, unit);
  }

  if (isCountUnit(unit)) {
    if (ingredient.baseUnit === "piece") return ok(ingredient.id, value, "piece");
    if (ingredient.gramsPerPiece !== undefined) {
      const grams = value * ingredient.gramsPerPiece;
      return fromGrams(ingredient.id, grams, ingredient, unit);
    }
    return review(ingredient.id, value, unit);
  }

  throw new Error(`convertToBaseUnit: unrecognized unit "${unit}"`);
}

export const unitTables = { MASS_TO_GRAMS, VOLUME_TO_ML, NOMINAL_UNITS };
export { isMassUnit, isVolumeUnit, isCountUnit, isNominalUnit };
