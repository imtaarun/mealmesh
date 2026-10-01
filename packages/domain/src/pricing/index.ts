import type { ProductOption } from "../types.js";

export interface PricedCandidate {
  candidate: ProductOption;
  packsNeeded: number;
  cents: number;
}

/** Candidate with the lowest total cost to cover `quantity` — not the lowest unit price. */
export function cheapestForQuantity(candidates: ProductOption[], quantity: number): PricedCandidate | null {
  let best: PricedCandidate | null = null;
  for (const candidate of candidates) {
    const packsNeeded = quantity <= 0 ? 0 : Math.ceil(quantity / candidate.packSize);
    const cents = packsNeeded * candidate.priceCents;
    if (!best || cents < best.cents) best = { candidate, packsNeeded, cents };
  }
  return best;
}

/** Cheapest price per base unit (g, ml, or piece) for each ingredient, across every product that sells it. */
export function cheapestUnitPriceCents(candidates: ProductOption[]): Record<string, number> {
  const unitPrices: Record<string, number> = {};
  for (const c of candidates) {
    unitPrices[c.ingredientId] = Math.min(unitPrices[c.ingredientId] ?? Infinity, c.priceCents / c.packSize);
  }
  return unitPrices;
}
