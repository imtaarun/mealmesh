// docs/algorithms.md §4. Greedy is good enough; no solver.

import type { BasketPick, OptimizationResult, OptimizationStrategy, ProductOption, StoreDistance } from "../types.js";
import { cheapestForQuantity } from "../pricing/index.js";

export const DEFAULT_TRIP_COST_CENTS = 600;
export const DEFAULT_MAX_DETOUR_KM = 5;

export interface BasketItem {
  ingredientId: string;
  neededQuantity: number; // in the ingredient's baseUnit
}

export interface OptimizeBasketInput {
  strategy: OptimizationStrategy;
  items: BasketItem[];
  candidatesByIngredient: Record<string, ProductOption[]>;
  storeDistances: StoreDistance[];
  tripCostCents?: number;
  maxDetourKm?: number;
}

interface PricedItem extends BasketPick {
  storeId: string;
}

/** Cheapest way to buy one item at one specific store, or null if that store doesn't carry it. */
function priceAtStore(item: BasketItem, storeId: string, candidatesByIngredient: Record<string, ProductOption[]>): PricedItem | null {
  const candidates = (candidatesByIngredient[item.ingredientId] ?? []).filter((c) => c.storeId === storeId);
  const priced = cheapestForQuantity(candidates, item.neededQuantity);
  if (!priced) return null;
  return { ingredientId: item.ingredientId, productId: priced.candidate.productId, storeId, packs: priced.packsNeeded, cents: priced.cents };
}

/** Cheapest way to buy one item across every store. */
function priceAnywhere(item: BasketItem, candidatesByIngredient: Record<string, ProductOption[]>): PricedItem | null {
  const candidates = candidatesByIngredient[item.ingredientId] ?? [];
  const priced = cheapestForQuantity(candidates, item.neededQuantity);
  if (!priced) return null;
  return { ingredientId: item.ingredientId, productId: priced.candidate.productId, storeId: priced.candidate.storeId, packs: priced.packsNeeded, cents: priced.cents };
}

interface SingleStoreBasket {
  storeId: string;
  totalCents: number;
  pricedItems: PricedItem[]; // one per item that has a price anywhere (at this store, or elsewhere if missing)
  missingIngredientIds: string[]; // not carried by this store at all
  unavailableIngredientIds: string[]; // not carried by ANY store
}

/** Missing items are priced at the cheapest store elsewhere. */
function singleStoreBasket(
  storeId: string,
  items: BasketItem[],
  candidatesByIngredient: Record<string, ProductOption[]>,
): SingleStoreBasket {
  let totalCents = 0;
  const pricedItems: PricedItem[] = [];
  const missingIngredientIds: string[] = [];
  const unavailableIngredientIds: string[] = [];

  for (const item of items) {
    const here = priceAtStore(item, storeId, candidatesByIngredient);
    if (here) {
      totalCents += here.cents;
      pricedItems.push(here);
      continue;
    }
    const elsewhere = priceAnywhere(item, candidatesByIngredient);
    if (!elsewhere) {
      unavailableIngredientIds.push(item.ingredientId);
      continue;
    }
    missingIngredientIds.push(item.ingredientId);
    totalCents += elsewhere.cents;
    pricedItems.push(elsewhere);
  }

  return { storeId, totalCents, pricedItems, missingIngredientIds, unavailableIngredientIds };
}

function allStoreIds(storeDistances: StoreDistance[], candidatesByIngredient: Record<string, ProductOption[]>): string[] {
  const ids = new Set(storeDistances.map((s) => s.storeId));
  for (const candidates of Object.values(candidatesByIngredient)) {
    for (const c of candidates) ids.add(c.storeId);
  }
  return [...ids];
}

function toBreakdown(pricedItems: PricedItem[]): OptimizationResult["storeBreakdown"] {
  const byStore = new Map<string, { subtotalCents: number; items: BasketPick[] }>();
  for (const { storeId, ...pick } of pricedItems) {
    const entry = byStore.get(storeId) ?? { subtotalCents: 0, items: [] };
    entry.subtotalCents += pick.cents;
    entry.items.push(pick);
    byStore.set(storeId, entry);
  }
  return [...byStore.entries()].map(([storeId, v]) => ({ storeId, ...v }));
}

function topDrivers(baseline: PricedItem[], optimized: PricedItem[]): string[] {
  const baselineByIngredient = new Map(baseline.map((p) => [p.ingredientId, p.cents]));
  const savingsByIngredient = new Map<string, number>();
  for (const p of optimized) {
    const baselineCents = baselineByIngredient.get(p.ingredientId) ?? p.cents;
    const savings = baselineCents - p.cents;
    if (savings > 0) savingsByIngredient.set(p.ingredientId, savings);
  }
  return [...savingsByIngredient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ingredientId]) => ingredientId);
}

/** The single store every strategy's savings are measured against. */
function pickAnchor(baskets: SingleStoreBasket[]): SingleStoreBasket {
  return baskets.reduce((best, basket) => {
    if (basket.missingIngredientIds.length !== best.missingIngredientIds.length) {
      return basket.missingIngredientIds.length < best.missingIngredientIds.length ? basket : best;
    }
    return basket.totalCents < best.totalCents ? basket : best;
  });
}

export function optimizeBasket(input: OptimizeBasketInput): OptimizationResult {
  const { strategy, items, candidatesByIngredient, storeDistances } = input;
  const tripCostCents = input.tripCostCents ?? DEFAULT_TRIP_COST_CENTS;
  const maxDetourKm = input.maxDetourKm ?? DEFAULT_MAX_DETOUR_KM;

  const storeIds = allStoreIds(storeDistances, candidatesByIngredient);
  if (storeIds.length === 0) {
    return {
      strategy,
      totalCents: 0,
      storeBreakdown: [],
      unavailableItemIds: items.map((i) => i.ingredientId),
      savingsCents: 0,
      topSavingsDrivers: [],
    };
  }

  const singleStoreBaskets = storeIds.map((id) => singleStoreBasket(id, items, candidatesByIngredient));
  const anchor = pickAnchor(singleStoreBaskets);

  if (strategy === "min_cost") {
    const pricedItems: PricedItem[] = [];
    const unavailable: string[] = [];
    for (const item of items) {
      const priced = priceAnywhere(item, candidatesByIngredient);
      if (priced) pricedItems.push(priced);
      else unavailable.push(item.ingredientId);
    }
    const totalCents = pricedItems.reduce((sum, p) => sum + p.cents, 0);
    return {
      strategy,
      totalCents,
      storeBreakdown: toBreakdown(pricedItems),
      unavailableItemIds: unavailable,
      savingsCents: Math.max(0, anchor.totalCents - totalCents),
      topSavingsDrivers: topDrivers(anchor.pricedItems, pricedItems),
    };
  }

  if (strategy === "min_stores") {
    return {
      strategy,
      totalCents: anchor.totalCents,
      storeBreakdown: toBreakdown(anchor.pricedItems),
      unavailableItemIds: anchor.unavailableIngredientIds,
      savingsCents: 0,
      topSavingsDrivers: [],
    };
  }

  // best_overall: min_stores alone, or any pair of nearby stores, charging TRIP_COST per
  // extra stop. Cap 2 stores, apart from unavoidable stops.
  const withTrips = (pricedItems: PricedItem[]) =>
    pricedItems.reduce((sum, p) => sum + p.cents, 0) +
    tripCostCents * (new Set(pricedItems.map((p) => p.storeId)).size - 1);
  const distanceByStore = new Map(storeDistances.map((s) => [s.storeId, s.distanceKm]));
  const reachable = storeIds.filter((id) => (distanceByStore.get(id) ?? Infinity) <= maxDetourKm);
  let chosenItems = anchor.pricedItems;
  let chosenCents = withTrips(anchor.pricedItems);

  for (let i = 0; i < reachable.length; i++) {
    for (let j = i + 1; j < reachable.length; j++) {
      const pairItems: PricedItem[] = [];
      for (const item of items) {
        const atFirst = priceAtStore(item, reachable[i]!, candidatesByIngredient);
        const atSecond = priceAtStore(item, reachable[j]!, candidatesByIngredient);
        const priced =
          atFirst && atSecond
            ? atSecond.cents < atFirst.cents ? atSecond : atFirst
            : atFirst ?? atSecond ?? priceAnywhere(item, candidatesByIngredient);
        if (priced) pairItems.push(priced);
      }
      const pairCents = withTrips(pairItems);
      if (pairCents < chosenCents) {
        chosenItems = pairItems;
        chosenCents = pairCents;
      }
    }
  }

  const totalCents = chosenItems.reduce((sum, p) => sum + p.cents, 0);

  return {
    strategy,
    totalCents,
    storeBreakdown: toBreakdown(chosenItems),
    unavailableItemIds: anchor.unavailableIngredientIds,
    savingsCents: Math.max(0, anchor.totalCents - totalCents),
    topSavingsDrivers: topDrivers(anchor.pricedItems, chosenItems),
  };
}
