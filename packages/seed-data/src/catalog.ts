// Store catalog — products, price timelines, and deals, generated from
// reference-prices.json and stores.json. Approximate pricing, not live retailer data
// (docs/open-questions.md item 1): each store's price for an ingredient is the
// reference price times the store's priceFactor, nudged by a per-product deviation
// that is derived from a hash of the ids, so re-seeding always produces the same
// numbers. Nothing here is random and nothing here calls a model.

import type { SeedReferencePrice, SeedStore } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CatalogProduct {
  id: string;
  storeId: string;
  ingredientId: string;
  name: string;
  brand: string | null;
  packSize: number;
}

export interface CatalogPrice {
  productId: string;
  priceCents: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isSale: boolean;
  regularPriceCents: number | null;
}

export interface CatalogDeal {
  storeId: string;
  productId: string;
  discountPercent: number;
  startsAt: Date;
  endsAt: Date;
  description: string;
}

export interface Catalog {
  products: CatalogProduct[];
  prices: CatalogPrice[];
  deals: CatalogDeal[];
}

/** FNV-1a hash of `key`, mapped to [-1, 1). */
function deviation(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) / 0x100000000) * 2 - 1;
}

/** Shelf-style price: nearest 10 cents, minus one ($3.49, $12.99). Never below $0.49. */
function shelfPrice(cents: number): number {
  return Math.max(49, Math.round(cents / 10) * 10 - 1);
}

function productId(storeId: string, ingredientId: string): string {
  return `${storeId}--${ingredientId}`;
}

function storeCarries(store: SeedStore, ingredientId: string): boolean {
  if (store.onlyIngredientIds) return store.onlyIngredientIds.includes(ingredientId);
  return !(store.excludedIngredientIds ?? []).includes(ingredientId);
}

/**
 * Every product gets two regular-price rows: the price from 8 to 4 weeks ago (within
 * ±5% of today's) and the current one, so there's real price history to show. Each
 * store deal adds a sale row and a Deal running from 2 days before `now` to 5 days
 * after — re-run the seed to roll deals forward.
 */
export function buildCatalog(stores: SeedStore[], referencePrices: SeedReferencePrice[], now: Date): Catalog {
  const products: CatalogProduct[] = [];
  const prices: CatalogPrice[] = [];
  const deals: CatalogDeal[] = [];
  const at = (days: number) => new Date(now.getTime() + days * DAY_MS);

  for (const store of stores) {
    const regularByIngredient = new Map<string, number>();

    for (const ref of referencePrices) {
      if (!storeCarries(store, ref.ingredientId)) continue;

      const id = productId(store.id, ref.ingredientId);
      const factor = store.priceFactor * (1 + store.priceVariance * deviation(id));
      const regular = shelfPrice(ref.priceCents * factor);
      const previous = shelfPrice(regular * (1 + 0.05 * deviation(`${id}|previous`)));
      regularByIngredient.set(ref.ingredientId, regular);

      products.push({
        id,
        storeId: store.id,
        ingredientId: ref.ingredientId,
        name: ref.productName,
        brand: store.houseBrand,
        packSize: ref.packSize,
      });
      prices.push(
        { productId: id, priceCents: previous, effectiveFrom: at(-56), effectiveTo: at(-28), isSale: false, regularPriceCents: null },
        { productId: id, priceCents: regular, effectiveFrom: at(-28), effectiveTo: null, isSale: false, regularPriceCents: null },
      );
    }

    for (const deal of store.deals) {
      const regular = regularByIngredient.get(deal.ingredientId);
      if (regular === undefined) {
        throw new Error(`stores.json: ${store.id} has a deal on ${deal.ingredientId}, which it doesn't carry`);
      }
      const id = productId(store.id, deal.ingredientId);
      const name = referencePrices.find((r) => r.ingredientId === deal.ingredientId)!.productName;
      prices.push({
        productId: id,
        priceCents: shelfPrice(regular * (1 - deal.discountPercent / 100)),
        effectiveFrom: at(-2),
        effectiveTo: at(5),
        isSale: true,
        regularPriceCents: regular,
      });
      deals.push({
        storeId: store.id,
        productId: id,
        discountPercent: deal.discountPercent,
        startsAt: at(-2),
        endsAt: at(5),
        description: `${deal.discountPercent}% off ${name}`,
      });
    }
  }

  return { products, prices, deals };
}
