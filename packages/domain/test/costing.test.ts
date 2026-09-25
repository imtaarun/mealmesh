import { describe, expect, it } from "vitest";
import { costLine } from "../src/costing/index.js";
import type { GroceryLineItem, ProductOption } from "../src/types.js";

describe("costLine", () => {
  it("needs 200g parmesan, only a 500g pack exists -> spend = 1 pack, consumed value = 200g worth", () => {
    const item: GroceryLineItem = {
      ingredientId: "parmesan",
      neededQuantity: 200,
      pantryCovered: 0,
      finalQuantity: 200,
      unit: "g",
      needsReview: false,
      isNominal: false,
    };
    const candidates: ProductOption[] = [
      { productId: "p1", storeId: "s1", ingredientId: "parmesan", priceCents: 800, packSize: 500, packUnit: "g" },
    ];

    const result = costLine(item, candidates);

    expect(result.packsNeeded).toBe(1);
    expect(result.spendCents).toBe(800);
    expect(result.consumedValueCents).toBe(320); // 200g * (800c / 500g)
    expect(result.consumedValueCents).toBeLessThan(result.spendCents);
  });

  it("picks the cheapest candidate by total cost for the needed quantity, not unit price", () => {
    const item: GroceryLineItem = {
      ingredientId: "rice",
      neededQuantity: 1000,
      pantryCovered: 0,
      finalQuantity: 1000,
      unit: "g",
      needsReview: false,
      isNominal: false,
    };
    const candidates: ProductOption[] = [
      { productId: "small-bag", storeId: "s1", ingredientId: "rice", priceCents: 300, packSize: 500, packUnit: "g" }, // 0.6c/g, 2 packs = 600c
      { productId: "big-bag", storeId: "s1", ingredientId: "rice", priceCents: 900, packSize: 2000, packUnit: "g" }, // 0.45c/g, 1 pack = 900c
    ];

    const result = costLine(item, candidates);

    expect(result.productId).toBe("small-bag");
    expect(result.packsNeeded).toBe(2);
    expect(result.spendCents).toBe(600);
  });
});
