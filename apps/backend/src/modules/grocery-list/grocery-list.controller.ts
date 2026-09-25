import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { GroceryListService } from "./grocery-list.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

@Controller("api")
export class GroceryListController {
  constructor(private readonly groceryListService: GroceryListService) {}

  @Get("grocery-list")
  getForPlan(@CurrentHousehold() household: RequestHousehold, @Query("mealPlanId") mealPlanId: string) {
    return this.groceryListService.getForPlan(household, mealPlanId);
  }

  @Patch("grocery-list/items/:id")
  updateItem(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string, @Body() patch: unknown) {
    return this.groceryListService.updateItem(household, id, patch);
  }

  @Post("grocery/optimize")
  optimize(@CurrentHousehold() household: RequestHousehold, @Body() body: { groceryListId: string; strategy: string }) {
    return this.groceryListService.optimize(household, body.groceryListId, body.strategy);
  }

  @Get("stores")
  listStores() {
    return this.groceryListService.listStores();
  }

  @Get("deals")
  getDeals(@CurrentHousehold() household: RequestHousehold, @Query("mealPlanId") mealPlanId: string) {
    return this.groceryListService.getDeals(household, mealPlanId);
  }
}
