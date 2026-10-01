import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { MealPlansService } from "./meal-plans.service.js";
import { PlanMyWeekService } from "./plan-my-week.service.js";
import { CreateMealPlanDto } from "./dto/create-meal-plan.dto.js";
import { UpdateMealDto } from "./dto/update-meal.dto.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

@Controller("api/meal-plans")
export class MealPlansController {
  constructor(
    private readonly mealPlansService: MealPlansService,
    private readonly planMyWeekService: PlanMyWeekService,
  ) {}

  @Get("current")
  getCurrent(@CurrentHousehold() household: RequestHousehold) {
    return this.mealPlansService.getCurrent(household);
  }

  @Post()
  createEmptyWeek(@CurrentHousehold() household: RequestHousehold, @Body() dto: CreateMealPlanDto) {
    return this.mealPlansService.createEmptyWeek(household, dto);
  }

  @Post("generate")
  generate(@CurrentHousehold() household: RequestHousehold, @Body() dto: CreateMealPlanDto) {
    return this.planMyWeekService.generate(household, dto.weekStartDate);
  }

  @Post(":id/meals/:mealId/regenerate")
  regenerateMeal(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string, @Param("mealId") mealId: string) {
    return this.planMyWeekService.regenerateDinner(household, id, mealId);
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
