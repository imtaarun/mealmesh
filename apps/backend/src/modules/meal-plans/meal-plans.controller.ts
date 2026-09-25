import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { MealPlansService } from "./meal-plans.service.js";
import { CreateMealPlanDto } from "./dto/create-meal-plan.dto.js";
import { UpdateMealDto } from "./dto/update-meal.dto.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

@Controller("api/meal-plans")
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Get("current")
  getCurrent(@CurrentHousehold() household: RequestHousehold) {
    return this.mealPlansService.getCurrent(household);
  }

  @Post()
  createEmptyWeek(@CurrentHousehold() household: RequestHousehold, @Body() dto: CreateMealPlanDto) {
    return this.mealPlansService.createEmptyWeek(household, dto);
  }

  @Post("generate")
  generate(@CurrentHousehold() household: RequestHousehold) {
    return this.mealPlansService.generate(household);
  }

  @Post(":id/meals/:mealId/regenerate")
  regenerateMeal(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string, @Param("mealId") mealId: string) {
    return this.mealPlansService.regenerateMeal(household, id, mealId);
  }

  @Patch(":id/meals/:mealId")
  updateMeal(
    @CurrentHousehold() household: RequestHousehold,
    @Param("id") id: string,
    @Param("mealId") mealId: string,
    @Body() dto: UpdateMealDto,
  ) {
    return this.mealPlansService.updateMeal(household, id, mealId, dto);
  }
}
