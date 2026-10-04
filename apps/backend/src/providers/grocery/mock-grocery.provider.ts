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

/** Reads the seeded estimated prices; callers show the Estimated pricing badge. */
@Injectable()
export class MockGroceryProvider implements GroceryProvider {
  readonly id = "mock";
  readonly isDemo = true;

  constructor(private readonly prisma: PrismaService) {}

  async searchProducts(query: ProductQuery): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.text ? { name: { contains: query.text, mode: "insensitive" as const } } : {}),
      },
      select: PRODUCT_FIELDS,
      orderBy: { id: "asc" },
    });
  }

  async getProduct(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { id }, select: PRODUCT_FIELDS });
  }

  /** The price in effect now; when a sale overlaps the regular price, the sale wins. */
  async getPrice(productId: string): Promise<ProductPrice | null> {
    const now = new Date();
    return this.prisma.productPrice.findFirst({
      where: { productId, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
      orderBy: { priceCents: "asc" },
      select: { productId: true, priceCents: true, isSale: true, regularPriceCents: true, source: true },
    });
  }

  async getDeals(storeId: string): Promise<Deal[]> {
    const now = new Date();
    return this.prisma.deal.findMany({
      where: { storeId, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { id: true, storeId: true, productId: true, discountPercent: true, description: true },
      orderBy: { discountPercent: "desc" },
    });
  }

  async listStores(): Promise<Store[]> {
    return this.prisma.store.findMany({ select: { id: true, name: true, chain: true, lat: true, lng: true, isDemo: true }, orderBy: { name: "asc" } });
  }

  async getStoreLocations(near: LatLng, radiusKm: number): Promise<Store[]> {
    const stores = await this.prisma.store.findMany({
      select: { id: true, name: true, chain: true, lat: true, lng: true, isDemo: true },
    });
    return stores.filter((store) => distanceKm(near, store) <= radiusKm);
  }
}

const PRODUCT_FIELDS = {
  id: true,
  storeId: true,
  ingredientId: true,
  name: true,
  brand: true,
  packSize: true,
  packUnit: true,
} as const;

/** Great-circle (haversine) distance between two points, in km. */
function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
