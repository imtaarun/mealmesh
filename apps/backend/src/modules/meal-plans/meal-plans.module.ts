import { Module } from "@nestjs/common";
import { MealPlansController } from "./meal-plans.controller.js";
import { MealPlansService } from "./meal-plans.service.js";
import { PlanMyWeekService } from "./plan-my-week.service.js";

@Module({
  controllers: [MealPlansController],
  providers: [MealPlansService, PlanMyWeekService],
})
export class MealPlansModule {}
