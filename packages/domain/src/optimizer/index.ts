// Basket optimization — docs/algorithms.md section 4.
// Three strategies: min_cost (cheapest product per item, any store), min_stores
// (cheapest single store covering the basket, gaps priced/counted as a required second
// stop), best_overall (anchor on the best single store; accept a second store only when
// savings > TRIP_COST and detour <= maxDetourKm; cap 2 stores in the MVP). Greedy is
// correct enough here — no ILP solver.

import type { OptimizationResult, OptimizationStrategy, ProductOption, StoreDistance } from "../types.js";
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

interface PricedItem {
  ingredientId: string;
  productId: string;
  storeId: string;
  cents: number;
}

/** Cheapest way to buy one item at one specific store, or null if that store doesn't carry it. */
function priceAtStore(item: BasketItem, storeId: string, candidatesByIngredient: Record<string, ProductOption[]>): PricedItem | null {
  const candidates = (candidatesByIngredient[item.ingredientId] ?? []).filter((c) => c.storeId === storeId);
  const priced = cheapestForQuantity(candidates, item.neededQuantity);
  if (!priced) return null;
  return { ingredientId: item.ingredientId, productId: priced.candidate.productId, storeId, cents: priced.cents };
}

/** Cheapest way to buy one item across every store. */
function priceAnywhere(item: BasketItem, candidatesByIngredient: Record<string, ProductOption[]>): PricedItem | null {
  const candidates = candidatesByIngredient[item.ingredientId] ?? [];
  const priced = cheapestForQuantity(candidates, item.neededQuantity);
  if (!priced) return null;
  return { ingredientId: item.ingredientId, productId: priced.candidate.productId, storeId: priced.candidate.storeId, cents: priced.cents };
}

interface SingleStoreBasket {
  storeId: string;
  totalCents: number;
  pricedItems: PricedItem[]; // one per item that has a price anywhere (at this store, or elsewhere if missing)
  missingIngredientIds: string[]; // not carried by this store at all
  unavailableIngredientIds: string[]; // not carried by ANY store
}

/**
 * Cost of buying the whole basket from one store. Items the store doesn't carry are
 * priced at the cheapest option elsewhere and flagged as requiring a second stop —
 * docs/algorithms.md §4 min_stores.
 */
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
  const byStore = new Map<string, { subtotalCents: number; itemIds: string[] }>();
  for (const p of pricedItems) {
    const entry = byStore.get(p.storeId) ?? { subtotalCents: 0, itemIds: [] };
    entry.subtotalCents += p.cents;
    entry.itemIds.push(p.ingredientId);
    byStore.set(p.storeId, entry);
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

/** The single store that covers the most of the basket for the least money — the
 * anchor every strategy's savings figure is measured against. */
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

  // best_overall: try every other store as a potential second stop; accept the one
  // whose net savings (savings - trip cost) is highest, if any clears the trip cost
  // and detour budget. Cap at 2 stores.
  const distanceByStore = new Map(storeDistances.map((s) => [s.storeId, s.distanceKm]));
  let bestSecondStop: { basket: SingleStoreBasket; pricedItems: PricedItem[]; netSavingsCents: number } | null = null;

  for (const candidateStore of singleStoreBaskets) {
    if (candidateStore.storeId === anchor.storeId) continue;
    const detourKm = distanceByStore.get(candidateStore.storeId) ?? Infinity;
    if (detourKm > maxDetourKm) continue;

    const merged: PricedItem[] = [];
    let savingsCents = 0;
    for (const item of items) {
      const atAnchor = anchor.pricedItems.find((p) => p.ingredientId === item.ingredientId);
      const atCandidate = priceAtStore(item, candidateStore.storeId, candidatesByIngredient);
      if (atCandidate && (!atAnchor || atCandidate.cents < atAnchor.cents)) {
        merged.push(atCandidate);
        if (atAnchor) savingsCents += atAnchor.cents - atCandidate.cents;
      } else if (atAnchor) {
        merged.push(atAnchor);
      }
    }

    const netSavingsCents = savingsCents - tripCostCents;
    if (savingsCents > tripCostCents && (!bestSecondStop || netSavingsCents > bestSecondStop.netSavingsCents)) {
      bestSecondStop = { basket: candidateStore, pricedItems: merged, netSavingsCents };
    }
  }

  const chosenItems = bestSecondStop?.pricedItems ?? anchor.pricedItems;
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
