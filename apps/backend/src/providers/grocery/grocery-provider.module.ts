import { Global, Module } from "@nestjs/common";
import { GROCERY_PROVIDER } from "./grocery-provider.interface.js";
import { MockGroceryProvider } from "./mock-grocery.provider.js";
import { GroceryPricing } from "./grocery-pricing.js";

// A registry resolves by id (docs/architecture.md); nothing else in the codebase
// should name a retailer. MockGroceryProvider is the only implementation until a real
// provider is chosen — see docs/open-questions.md item 1. Global for the same reason
// as AiProviderModule: every feature module needs GROCERY_PROVIDER without a manual
// import each time.
@Global()
@Module({
  providers: [{ provide: GROCERY_PROVIDER, useClass: MockGroceryProvider }, GroceryPricing],
  exports: [GROCERY_PROVIDER, GroceryPricing],
})
export class GroceryProviderModule {}
