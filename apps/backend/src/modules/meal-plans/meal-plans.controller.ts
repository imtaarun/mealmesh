import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { HEAVY_LIMIT } from "../../common/rate-limits.js";
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
  getCurrent(@CurrentHousehold() household: RequestHousehold, @Query("date") date?: string) {
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException("date must be YYYY-MM-DD");
    return this.mealPlansService.getCurrent(household, date);
  }

  @Post()
  createEmptyWeek(@CurrentHousehold() household: RequestHousehold, @Body() dto: CreateMealPlanDto) {
    return this.mealPlansService.createEmptyWeek(household, dto);
  }

  @Throttle(HEAVY_LIMIT)
  @Post("generate")
  generate(@CurrentHousehold() household: RequestHousehold, @Body() dto: CreateMealPlanDto) {
    return this.planMyWeekService.generate(household, dto.weekStartDate);
  }

  @Throttle(HEAVY_LIMIT)
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
