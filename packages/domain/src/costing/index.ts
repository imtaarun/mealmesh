// Costing — docs/algorithms.md section 3.
// spend (what you pay) and consumed value (what the meals actually use) are distinct.
// Cost per serving uses consumed value; basket totals use spend. Integer cents
// throughout; round only at render.

import type { CostedLine, GroceryLineItem, ProductOption } from "../types.js";
import { cheapestForQuantity } from "../pricing/index.js";

/**
 * Cost of a grocery line = the cheapest available product (same ingredient, same pack
 * unit) that covers what the meals need. Priced from neededQuantity, not the rounded
 * finalQuantity: pack sizes already round a real purchase, and rounding twice
 * over-buys anything sold in packs smaller than the increment (docs/open-questions.md
 * item 14 — 3 g of oregano is one 25 g jar, not two).
 */
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
