import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import { GROCERY_PROVIDER, type GroceryProvider } from "../../providers/grocery/grocery-provider.interface.js";
import type { RequestHousehold } from "../../common/household-context.js";

/**
 * Grocery list generation (aggregate + pantry subtract, via packages/domain), basket
 * optimization (three strategies, via packages/domain optimizer), stores, and deals
 * filtered to the current plan. See docs/algorithms.md §2-4 and docs/product-spec.md
 * "Grocery list" / "Basket optimization" / "Deal Radar".
 */
@Injectable()
export class GroceryListService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GROCERY_PROVIDER) private readonly groceryProvider: GroceryProvider,
  ) {}

  async getForPlan(_household: RequestHousehold, _mealPlanId: string): Promise<never> {
    throw new Error("GroceryListService.getForPlan: not yet implemented — Phase 6");
  }

  async updateItem(_household: RequestHousehold, _id: string, _patch: unknown): Promise<never> {
    throw new Error("GroceryListService.updateItem: not yet implemented — Phase 6");
  }

  async optimize(_household: RequestHousehold, _groceryListId: string, _strategy: string): Promise<never> {
    throw new Error("GroceryListService.optimize: not yet implemented — Phase 7");
  }

  async listStores(): Promise<never> {
    throw new Error("GroceryListService.listStores: not yet implemented — Phase 7");
  }

  async getDeals(_household: RequestHousehold, _mealPlanId: string): Promise<never> {
    throw new Error("GroceryListService.getDeals: not yet implemented — Phase 7");
  }
}
