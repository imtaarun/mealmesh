import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { HEAVY_LIMIT } from "../../common/rate-limits.js";
import { GroceryListService } from "./grocery-list.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

class UpdateItemDto {
  @IsOptional()
  @IsBoolean()
  checked?: boolean;

  @IsOptional()
  @IsBoolean()
  alreadyHave?: boolean;

  /** null goes back to the computed quantity. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  userOverrideQuantity?: number | null;

  /** For a line the pantry covers: put it back on the list anyway. */
  @IsOptional()
  @IsBoolean()
  buyAnyway?: boolean;
}

class AddItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

@Controller("api")
export class GroceryListController {
  constructor(private readonly groceryListService: GroceryListService) {}

  @Get("grocery-list")
  getForPlan(@CurrentHousehold() household: RequestHousehold, @Query("mealPlanId") mealPlanId: string) {
    return this.groceryListService.getForPlan(household, mealPlanId);
  }

  @Patch("grocery-list/items/:id")
  updateItem(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string, @Body() dto: UpdateItemDto) {
    return this.groceryListService.updateItem(household, id, dto);
  }

  @Post("grocery-list/:id/items")
  addItem(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string, @Body() dto: AddItemDto) {
    return this.groceryListService.addItem(household, id, dto.name);
  }

  @Delete("grocery-list/items/:id")
  removeItem(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string) {
    return this.groceryListService.removeItem(household, id);
  }

  @Throttle(HEAVY_LIMIT)
  @Get("grocery-list/:id/optimize")
  optimize(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string) {
    return this.groceryListService.optimize(household, id);
  }

  @Throttle(HEAVY_LIMIT)
  @Get("grocery-list/:id/deals")
  deals(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string) {
    return this.groceryListService.deals(household, id);
  }
}
