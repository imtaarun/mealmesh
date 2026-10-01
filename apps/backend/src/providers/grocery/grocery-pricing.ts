import { Inject, Injectable } from "@nestjs/common";
import type { ProductOption } from "@mealmesh/domain";
import { GROCERY_PROVIDER, type GroceryProvider } from "./grocery-provider.interface.js";

/** Current prices and deals via the GroceryProvider; isDemo means show the Estimated pricing badge. */
@Injectable()
export class GroceryPricing {
  constructor(@Inject(GROCERY_PROVIDER) private readonly provider: GroceryProvider) {}

  async load(ingredientIds?: string[]) {
    const products = ingredientIds
      ? (await Promise.all(ingredientIds.map((ingredientId) => this.provider.searchProducts({ ingredientId })))).flat()
      : await this.provider.searchProducts({});
    const prices = await Promise.all(products.map((p) => this.provider.getPrice(p.id)));

    const productOptions: ProductOption[] = [];
    products.forEach((product, i) => {
      const price = prices[i];
      if (price) {
        productOptions.push({
          productId: product.id,
          storeId: product.storeId,
          ingredientId: product.ingredientId,
          priceCents: price.priceCents,
          packSize: product.packSize,
          packUnit: product.packUnit,
        });
      }
    });

    const storeIds = [...new Set(products.map((p) => p.storeId))];
    const deals = (await Promise.all(storeIds.map((id) => this.provider.getDeals(id)))).flat();
    const ingredientByProduct = new Map(products.map((p) => [p.id, p.ingredientId]));
    const dealIngredientIds = [...new Set(deals.flatMap((d) => ingredientByProduct.get(d.productId) ?? []))];

    return { productOptions, dealIngredientIds, isDemo: this.provider.isDemo };
  }
}
