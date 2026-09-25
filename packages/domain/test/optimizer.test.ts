import { describe, expect, it } from "vitest";
import { DEFAULT_TRIP_COST_CENTS, optimizeBasket, type BasketItem } from "../src/optimizer/index.js";
import type { ProductOption, StoreDistance } from "../src/types.js";

const items: BasketItem[] = [
  { ingredientId: "chicken", neededQuantity: 100 },
  { ingredientId: "rice", neededQuantity: 100 },
];

function product(id: string, storeId: string, ingredientId: string, priceCents: number): ProductOption {
  return { productId: id, storeId, ingredientId, priceCents, packSize: 100, packUnit: "g" };
}

describe("optimizeBasket — best_overall", () => {
  it("rejects a two-store split when the per-item savings don't clear the trip cost", () => {
    const candidatesByIngredient: Record<string, ProductOption[]> = {
      chicken: [product("a-chicken", "storeA", "chicken", 1000), product("b-chicken", "storeB", "chicken", 950)],
      rice: [product("a-rice", "storeA", "rice", 500), product("b-rice", "storeB", "rice", 800)],
    };
    const storeDistances: StoreDistance[] = [
      { storeId: "storeA", distanceKm: 1 },
      { storeId: "storeB", distanceKm: 2 },
    ];

    const result = optimizeBasket({ strategy: "best_overall", items, candidatesByIngredient, storeDistances });

    // storeA (1500c total) is cheaper overall than storeB (1750c), so it's the anchor.
    // Moving just the chicken to storeB only saves 50c, nowhere near the $6 trip cost.
    expect(result.totalCents).toBe(1500);
    expect(result.storeBreakdown).toHaveLength(1);
    expect(result.storeBreakdown[0]!.storeId).toBe("storeA");
    expect(result.savingsCents).toBe(0);
  });

  it("accepts a two-store split when savings clear the trip cost", () => {
    const candidatesByIngredient: Record<string, ProductOption[]> = {
      chicken: [product("a-chicken", "storeA", "chicken", 1000), product("c-chicken", "storeC", "chicken", 300)],
      rice: [product("a-rice", "storeA", "rice", 500), product("c-rice", "storeC", "rice", 1400)],
    };
    const storeDistances: StoreDistance[] = [
      { storeId: "storeA", distanceKm: 1 },
      { storeId: "storeC", distanceKm: 2 },
    ];

    const result = optimizeBasket({ strategy: "best_overall", items, candidatesByIngredient, storeDistances });

    // storeA (1500c) is still the anchor (storeC alone would be 1700c). Moving just the
    // chicken to storeC saves 700c, which clears the $6 (600c) trip cost.
    expect(result.totalCents).toBe(800); // storeA's rice (500) + storeC's chicken (300)
    expect(result.storeBreakdown).toHaveLength(2);
    expect(result.savingsCents).toBe(700);
    expect(result.topSavingsDrivers[0]).toBe("chicken");
  });

  it("never accepts a second stop outside the max detour distance", () => {
    const candidatesByIngredient: Record<string, ProductOption[]> = {
      chicken: [product("a-chicken", "storeA", "chicken", 1000), product("c-chicken", "storeC", "chicken", 300)],
      rice: [product("a-rice", "storeA", "rice", 500)],
    };
    const storeDistances: StoreDistance[] = [
      { storeId: "storeA", distanceKm: 1 },
      { storeId: "storeC", distanceKm: 999 }, // far outside any sensible detour
    ];

    const result = optimizeBasket({
      strategy: "best_overall",
      items,
      candidatesByIngredient,
      storeDistances,
      maxDetourKm: 5,
    });

    expect(result.totalCents).toBe(1500);
    expect(result.storeBreakdown).toHaveLength(1);
  });
});

describe("optimizeBasket — min_cost and min_stores", () => {
  const candidatesByIngredient: Record<string, ProductOption[]> = {
    chicken: [product("a-chicken", "storeA", "chicken", 1000), product("b-chicken", "storeB", "chicken", 700)],
    rice: [product("a-rice", "storeA", "rice", 500)],
  };
  const storeDistances: StoreDistance[] = [
    { storeId: "storeA", distanceKm: 1 },
    { storeId: "storeB", distanceKm: 2 },
  ];

  it("min_cost picks the cheapest product per item regardless of store count", () => {
    const result = optimizeBasket({ strategy: "min_cost", items, candidatesByIngredient, storeDistances });
    expect(result.totalCents).toBe(1200); // 700 (storeB chicken) + 500 (storeA rice)
    expect(result.storeBreakdown).toHaveLength(2);
  });

  it("min_stores picks the cheapest single store, pricing gaps at the cheapest elsewhere", () => {
    const result = optimizeBasket({ strategy: "min_stores", items, candidatesByIngredient, storeDistances });
    // storeA covers both items (1500c); storeB only carries chicken (700c) and would need
    // rice priced elsewhere too — storeA is cheaper and complete, so it wins outright.
    expect(result.totalCents).toBe(1500);
    expect(result.storeBreakdown).toEqual([{ storeId: "storeA", subtotalCents: 1500, itemIds: expect.arrayContaining(["chicken", "rice"]) }]);
  });

  it("default trip cost constant matches the $6 assumed in docs/algorithms.md", () => {
    expect(DEFAULT_TRIP_COST_CENTS).toBe(600);
  });
});
