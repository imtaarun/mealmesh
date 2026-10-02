import { describe, expect, it } from "vitest";
import { aggregateDemand, applyPantryAndRound, buildGroceryList } from "../src/aggregation/index.js";
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

describe("buildGroceryList", () => {
  const ingredients = {
    onion: { ...onion, category: "Produce" },
    rice: { ...rice, category: "Pantry" },
    salt: { id: "salt", baseUnit: "g" as const, category: "Pantry" },
  };
  const line = (ingredientId: string, quantity: number, unit: RecipeIngredientDemand["unit"]): RecipeIngredientDemand =>
    ({ recipeId: "r", ingredientId, quantity, unit, recipeServings: 1, mealServings: 1 });

  it("1 + ½ + 2 onions is one line of whole onions", () => {
    const [onions] = buildGroceryList([line("onion", 1, "piece"), line("onion", 0.5, "piece"), line("onion", 2, "piece")], ingredients, {});
    expect(onions).toMatchObject({ unit: "piece", neededQuantity: 3.5, finalQuantity: 4 });
  });

  it("subtracts the pantry before counting onions", () => {
    const [onions] = buildGroceryList([line("onion", 3, "piece")], ingredients, { onion: 300 });
    expect(onions).toMatchObject({ unit: "piece", pantryCovered: 2, finalQuantity: 1 });
  });

  it("keeps a fully covered line, with nothing to buy", () => {
    const [riceLine] = buildGroceryList([line("rice", 400, "g")], ingredients, { rice: 500 });
    expect(riceLine).toMatchObject({ unit: "g", pantryCovered: 400, finalQuantity: 0 });
  });

  it("drops salt to taste when the pantry has salt, and keeps it otherwise", () => {
    expect(buildGroceryList([line("salt", 1, "to_taste")], ingredients, { salt: 800 })).toEqual([]);
    expect(buildGroceryList([line("salt", 1, "to_taste")], ingredients, {})).toMatchObject([{ isNominal: true }]);
  });

  it("leaves non-produce in its base unit", () => {
    const [riceLine] = buildGroceryList([line("rice", 420, "g")], ingredients, {});
    expect(riceLine).toMatchObject({ unit: "g", finalQuantity: 450 });
  });
});
