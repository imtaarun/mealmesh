import { describe, expect, it } from "vitest";
import { computeMealPlanScore } from "../src/score/index.js";
import type { MealPlanScoreInput } from "../src/types.js";

function baseInput(overrides: Partial<MealPlanScoreInput> = {}): MealPlanScoreInput {
  return {
    budgetCents: 12000,
    spendCents: 10000,
    ingredientUsageCounts: { chicken: 3, onion: 4, garlic: 5, salmon: 1 },
    ingredientCostCents: { chicken: 3000, onion: 300, garlic: 200, salmon: 2000 },
    consumedValueCents: 9000,
    expiringItemsUsed: 2,
    expiringItemsTotal: 3,
    totalActiveCookMinutes: 180,
    mealCount: 7,
    preferredMaxCookMinutes: 30,
    busyDayCount: 2,
    distinctProteins: 3,
    distinctCuisines: 2,
    distinctCookingMethods: 3,
    ...overrides,
  };
}

describe("computeMealPlanScore", () => {
  it("is identical across two runs of the same plan", () => {
    const input = baseInput();
    expect(computeMealPlanScore(input)).toEqual(computeMealPlanScore(baseInput()));
  });

  it("scores budget 100 at or under 85% of budget", () => {
    const result = computeMealPlanScore(baseInput({ budgetCents: 10000, spendCents: 8000 }));
    expect(result.budget).toBe(100);
  });

  it("scores budget 0 at or over 125% of budget", () => {
    const result = computeMealPlanScore(baseInput({ budgetCents: 10000, spendCents: 13000 }));
    expect(result.budget).toBe(0);
  });

  it("rewards ingredient reuse in the efficiency sub-score", () => {
    const allReused = computeMealPlanScore(
      baseInput({ ingredientUsageCounts: { a: 2, b: 2 }, ingredientCostCents: { a: 500, b: 500 } }),
    );
    const noneReused = computeMealPlanScore(
      baseInput({ ingredientUsageCounts: { a: 1, b: 1 }, ingredientCostCents: { a: 500, b: 500 } }),
    );
    expect(allReused.ingredientEfficiency).toBe(100);
    expect(noneReused.ingredientEfficiency).toBe(0);
  });

  it("gives convenience credit when average cook time is under the household's preference", () => {
    const result = computeMealPlanScore(baseInput({ totalActiveCookMinutes: 70, mealCount: 7, preferredMaxCookMinutes: 30 }));
    expect(result.convenience).toBe(100);
  });

  it("penalizes convenience harder on busier weeks when running over time", () => {
    const calmWeek = computeMealPlanScore(
      baseInput({ totalActiveCookMinutes: 280, mealCount: 7, preferredMaxCookMinutes: 30, busyDayCount: 0 }),
    );
    const busyWeek = computeMealPlanScore(
      baseInput({ totalActiveCookMinutes: 280, mealCount: 7, preferredMaxCookMinutes: 30, busyDayCount: 5 }),
    );
    expect(busyWeek.convenience).toBeLessThan(calmWeek.convenience);
    expect(busyWeek.convenience).toBeGreaterThan(0); // still a meaningful comparison, not both clamped to the floor
  });

  it("keeps every sub-score and the total within 0-100", () => {
    const result = computeMealPlanScore(baseInput({ spendCents: 999999, distinctProteins: 0, distinctCuisines: 0 }));
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
