// Only provider implementations name a retailer.

export interface ProductQuery {
  ingredientId?: string;
  storeId?: string;
  text?: string;
}

export interface Product {
  id: string;
  storeId: string;
  ingredientId: string;
  name: string;
  brand: string | null;
  packSize: number;
  packUnit: "g" | "ml" | "piece";
}

export interface ProductPrice {
  productId: string;
  priceCents: number;
  isSale: boolean;
  regularPriceCents: number | null;
  source: "mock" | "receipt" | "provider";
}

export interface Deal {
  id: string;
  storeId: string;
  productId: string;
  discountPercent: number;
  description: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Store {
  id: string;
  name: string;
  chain: string;
  lat: number;
  lng: number;
  isDemo: boolean;
}

export const GROCERY_PROVIDER = Symbol("GROCERY_PROVIDER");

export interface GroceryProvider {
  readonly id: string;
  readonly isDemo: boolean;
  searchProducts(query: ProductQuery): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  getPrice(productId: string): Promise<ProductPrice | null>;
  getDeals(storeId: string): Promise<Deal[]>;
  getStoreLocations(near: LatLng, radiusKm: number): Promise<Store[]>;
  listStores(): Promise<Store[]>;
}
