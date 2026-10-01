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

  // docs/open-questions.md item 14: the 50 g purchase increment rounds 3 g up to 50 g,
  // but costing works from the real need — pack sizes do the rounding.
  it("needs 3g oregano, sold in 25g jars -> one jar, even though the list rounds to 50g", () => {
    const item: GroceryLineItem = {
      ingredientId: "oregano",
      neededQuantity: 3,
      pantryCovered: 0,
      finalQuantity: 50,
      unit: "g",
      needsReview: false,
      isNominal: false,
    };
    const candidates: ProductOption[] = [
      { productId: "p1", storeId: "s1", ingredientId: "oregano", priceCents: 349, packSize: 25, packUnit: "g" },
    ];

    const result = costLine(item, candidates);

    expect(result.packsNeeded).toBe(1);
    expect(result.spendCents).toBe(349);
    expect(result.consumedValueCents).toBe(42); // 3g * (349c / 25g)
  });
});

describe("cheapestUnitPriceCents", () => {
  it("takes the lowest price per gram across stores and pack sizes", async () => {
    const { cheapestUnitPriceCents } = await import("../src/pricing/index.js");
    expect(
      cheapestUnitPriceCents([
        { productId: "a", storeId: "s1", ingredientId: "rice", priceCents: 999, packSize: 2000, packUnit: "g" },
        { productId: "b", storeId: "s2", ingredientId: "rice", priceCents: 300, packSize: 900, packUnit: "g" },
        { productId: "c", storeId: "s1", ingredientId: "milk", priceCents: 529, packSize: 2000, packUnit: "ml" },
      ]),
    ).toEqual({ rice: 300 / 900, milk: 529 / 2000 });
  });
});
