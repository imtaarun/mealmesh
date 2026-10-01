import { Global, Module } from "@nestjs/common";
import { GROCERY_PROVIDER } from "./grocery-provider.interface.js";
import { MockGroceryProvider } from "./mock-grocery.provider.js";
import { GroceryPricing } from "./grocery-pricing.js";

@Global()
@Module({
  providers: [{ provide: GROCERY_PROVIDER, useClass: MockGroceryProvider }, GroceryPricing],
  exports: [GROCERY_PROVIDER, GroceryPricing],
})
export class GroceryProviderModule {}
