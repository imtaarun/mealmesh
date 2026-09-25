import { describe, expect, it } from "vitest";
import { aggregateDemand, applyPantryAndRound } from "../src/aggregation/index.js";
import type { IngredientConversion, RecipeIngredientDemand } from "../src/types.js";

const onion: IngredientConversion = { id: "onion", baseUnit: "g", gramsPerPiece: 150 };
const spinachWithFactor: IngredientConversion = { id: "spinach", baseUnit: "g", gramsPerPiece: 300 };
const spinachNoFactor: IngredientConversion = { id: "spinach", baseUnit: "g" };
const rice: IngredientConversion = { id: "rice", baseUnit: "g", gramsPerCup: 185 };

describe("aggregateDemand", () => {
  it("1 onion + 1/2 onion + 2 onions sums to 3.5 onions, not three separate list rows", () => {
    // docs/algorithms.md states this example as "= 3 onions", which is arithmetically
    // loose (1 + 0.5 + 2 = 3.5) — illustrating "sum, don't concatenate" rather than an
    // exact number. Asserting the correct sum here, not the doc's rounded prose.
    const demands: RecipeIngredientDemand[] = [
      { recipeId: "r1", ingredientId: "onion", quantity: 1, unit: "piece", recipeServings: 1, mealServings: 1 },
      { recipeId: "r2", ingredientId: "onion", quantity: 0.5, unit: "piece", recipeServings: 1, mealServings: 1 },
      { recipeId: "r3", ingredientId: "onion", quantity: 2, unit: "piece", recipeServings: 1, mealServings: 1 },
    ];
    const [result] = aggregateDemand(demands, { onion });
    expect(result).toMatchObject({ ingredientId: "onion", unit: "g", needsReview: false });
    expect(result!.totalQuantity).toBe(3.5 * 150);
  });

  it("200g spinach + 1 bunch spinach combine into a single gram figure when gramsPerPiece is known", () => {
    const demands: RecipeIngredientDemand[] = [
      { recipeId: "r1", ingredientId: "spinach", quantity: 200, unit: "g", recipeServings: 1, mealServings: 1 },
      { recipeId: "r2", ingredientId: "spinach", quantity: 1, unit: "bunch", recipeServings: 1, mealServings: 1 },
    ];
    const results = aggregateDemand(demands, { spinach: spinachWithFactor });
    expect(results).toHaveLength(1);
    expect(results[0]!.totalQuantity).toBe(500);
    expect(results[0]!.needsReview).toBe(false);
  });

  it("200g spinach + 1 bunch spinach stay as two needsReview lines when gramsPerPiece is unknown", () => {
    const demands: RecipeIngredientDemand[] = [
      { recipeId: "r1", ingredientId: "spinach", quantity: 200, unit: "g", recipeServings: 1, mealServings: 1 },
      { recipeId: "r2", ingredientId: "spinach", quantity: 1, unit: "bunch", recipeServings: 1, mealServings: 1 },
    ];
    const results = aggregateDemand(demands, { spinach: spinachNoFactor });
    expect(results).toHaveLength(2);
    const grams = results.find((r) => r.unit === "g");
    const bunches = results.find((r) => r.unit === "bunch");
    expect(grams).toMatchObject({ totalQuantity: 200, needsReview: false });
    expect(bunches).toMatchObject({ totalQuantity: 1, needsReview: true });
  });

  it("a leftover meal contributes zero demand because it is excluded before aggregation", () => {
    // Leftover Meals never enter the RecipeIngredientDemand list in the first place —
    // that's the service layer's job (data-model.md invariant: "a leftover Meal ...
    // contributes zero grocery demand"). This documents the contract: aggregateDemand
    // has no special-case for it, because there's nothing to special-case.
    const onlyTheCookedMeal: RecipeIngredientDemand[] = [
      { recipeId: "r1", ingredientId: "onion", quantity: 2, unit: "piece", recipeServings: 4, mealServings: 4 },
    ];
    const [result] = aggregateDemand(onlyTheCookedMeal, { onion });
    expect(result!.totalQuantity).toBe(300);
  });
});

describe("applyPantryAndRound", () => {
  it("pantry has 500g rice, week needs 400g -> rice absent from the buy list", () => {
    const [demand] = aggregateDemand(
      [{ recipeId: "r1", ingredientId: "rice", quantity: 400, unit: "g", recipeServings: 1, mealServings: 1 }],
      { rice },
    );
    const line = applyPantryAndRound(demand!, 500);
    expect(line.finalQuantity).toBe(0);
    expect(line.pantryCovered).toBe(400);
  });

  it("rounds up to the purchase increment after summing, not per recipe", () => {
    const [demand] = aggregateDemand(
      [{ recipeId: "r1", ingredientId: "rice", quantity: 220, unit: "g", recipeServings: 1, mealServings: 1 }],
      { rice },
    );
    const line = applyPantryAndRound(demand!, 0);
    expect(line.neededQuantity).toBe(220);
    expect(line.finalQuantity).toBe(250); // next 50g step
  });
});
