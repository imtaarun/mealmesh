import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type {
  Deal,
  GroceryProvider,
  LatLng,
  Product,
  ProductPrice,
  ProductQuery,
  Store,
} from "./grocery-provider.interface.js";

/**
 * Reads the seeded tables (docs/data-model.md: Store, Product, ProductPrice, Deal),
 * populated with approximate pricing — per-ingredient reference unit prices grounded
 * in published Canadian average grocery costs, not live retailer data (see
 * docs/open-questions.md item 1). Every result renders with isDemo: true, and callers
 * must show the "Estimated pricing" badge — see CLAUDE.md rule 2 and
 * docs/product-spec.md. Prices must never be fabricated on the fly; they come from
 * the seed data only.
 * TODO(Phase 3): implement once the seed data includes stores/products/prices —
 * packages/seed-data currently only covers food content, not pricing.
 */
@Injectable()
export class MockGroceryProvider implements GroceryProvider {
  readonly id = "mock";
  readonly isDemo = true;

  constructor(private readonly prisma: PrismaService) {}

  async searchProducts(_query: ProductQuery): Promise<Product[]> {
    throw new Error("MockGroceryProvider.searchProducts: not yet implemented");
  }

  async getProduct(_id: string): Promise<Product | null> {
    throw new Error("MockGroceryProvider.getProduct: not yet implemented");
  }

  async getPrice(_productId: string): Promise<ProductPrice | null> {
    throw new Error("MockGroceryProvider.getPrice: not yet implemented");
  }

  async getDeals(_storeId: string): Promise<Deal[]> {
    throw new Error("MockGroceryProvider.getDeals: not yet implemented");
  }

  async getStoreLocations(_near: LatLng, _radiusKm: number): Promise<Store[]> {
    throw new Error("MockGroceryProvider.getStoreLocations: not yet implemented");
  }
}
