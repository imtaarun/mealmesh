// docs/algorithms.md §6.

import type { MealPlanScore, MealPlanScoreInput } from "../types.js";

export const SCORE_WEIGHTS = {
  budget: 0.25,
  ingredientEfficiency: 0.25,
  wasteReduction: 0.2,
  convenience: 0.15,
  variety: 0.15,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** 100 at <=85% of budget, 0 at >=125% of budget, linear between. */
function budgetScore(spendCents: number, budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  const ratio = spendCents / budgetCents;
  if (ratio <= 0.85) return 100;
  if (ratio >= 1.25) return 0;
  return clamp(100 - ((ratio - 0.85) / (1.25 - 0.85)) * 100);
}

/** Share of ingredient cost that comes from ingredients used in >=2 meals. */
function ingredientEfficiencyScore(usageCounts: Record<string, number>, costCents: Record<string, number>): number {
  const ingredientIds = Object.keys(costCents);
  const totalCost = ingredientIds.reduce((sum, id) => sum + costCents[id]!, 0);
  if (totalCost <= 0) return 0;
  const reusedCost = ingredientIds
    .filter((id) => (usageCounts[id] ?? 0) >= 2)
    .reduce((sum, id) => sum + costCents[id]!, 0);
  return clamp((reusedCost / totalCost) * 100);
}

function wasteReductionScore(input: MealPlanScoreInput): number {
  const consumedRatio = input.spendCents > 0 ? input.consumedValueCents / input.spendCents : 0;
  const base = clamp(consumedRatio * 100) * 0.8;
  const expiringBonus = input.expiringItemsTotal > 0 ? (input.expiringItemsUsed / input.expiringItemsTotal) * 20 : 0;
  return clamp(base + expiringBonus);
}

function convenienceScore(input: MealPlanScoreInput): number {
  if (input.mealCount <= 0 || input.preferredMaxCookMinutes <= 0) return 100;
  const avgMinutesPerMeal = input.totalActiveCookMinutes / input.mealCount;
  const ratio = avgMinutesPerMeal / input.preferredMaxCookMinutes;
  if (ratio <= 1) return 100;
  const busyMultiplier = 1 + input.busyDayCount * 0.1;
  return clamp(100 - (ratio - 1) * 100 * busyMultiplier);
}

/** Cooking methods are left out when not supplied, rather than scored as 0. */
function varietyScore(input: MealPlanScoreInput): number {
  const proteinScore = clamp((input.distinctProteins / 3) * 100);
  const cuisineScore = clamp((input.distinctCuisines / 3) * 100);
  if (input.distinctCookingMethods === undefined) return (proteinScore + cuisineScore) / 2;
  const methodScore = clamp((input.distinctCookingMethods / 3) * 100);
  return (proteinScore + cuisineScore + methodScore) / 3;
}

export function computeMealPlanScore(input: MealPlanScoreInput): MealPlanScore {
  const budget = budgetScore(input.spendCents, input.budgetCents);
  const ingredientEfficiency = ingredientEfficiencyScore(input.ingredientUsageCounts, input.ingredientCostCents);
  const wasteReduction = wasteReductionScore(input);
  const convenience = convenienceScore(input);
  const variety = varietyScore(input);

  const total = Math.round(
    SCORE_WEIGHTS.budget * budget +
      SCORE_WEIGHTS.ingredientEfficiency * ingredientEfficiency +
      SCORE_WEIGHTS.wasteReduction * wasteReduction +
      SCORE_WEIGHTS.convenience * convenience +
      SCORE_WEIGHTS.variety * variety,
  );

  return {
    total,
    budget: Math.round(budget),
    ingredientEfficiency: Math.round(ingredientEfficiency),
    wasteReduction: Math.round(wasteReduction),
    convenience: Math.round(convenience),
    variety: Math.round(variety),
  };
}
