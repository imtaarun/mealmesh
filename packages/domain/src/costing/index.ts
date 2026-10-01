// docs/algorithms.md §3. Spend = what you pay; consumed value = what the meals use.

import type { CostedLine, GroceryLineItem, ProductOption } from "../types.js";
import { cheapestForQuantity } from "../pricing/index.js";

/** Priced from neededQuantity: pack sizes already round the purchase (open-questions item 14). */
export function costLine(item: GroceryLineItem, candidates: ProductOption[]): CostedLine {
  const usable = candidates.filter((c) => c.ingredientId === item.ingredientId && c.packUnit === item.unit);
  if (usable.length === 0) {
    throw new Error(`costLine: no candidate products for ingredient "${item.ingredientId}" in unit "${item.unit}"`);
  }

  const priced = cheapestForQuantity(usable, item.neededQuantity)!;
  const unitPrice = priced.candidate.priceCents / priced.candidate.packSize;

  return {
    ingredientId: item.ingredientId,
    productId: priced.candidate.productId,
    packsNeeded: priced.packsNeeded,
    spendCents: priced.cents,
    consumedValueCents: Math.round(item.neededQuantity * unitPrice),
  };
}
