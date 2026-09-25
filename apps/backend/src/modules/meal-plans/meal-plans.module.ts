import { Module } from "@nestjs/common";
import { MealPlansController } from "./meal-plans.controller.js";
import { MealPlansService } from "./meal-plans.service.js";

@Module({
  controllers: [MealPlansController],
  providers: [MealPlansService],
})
export class MealPlansModule {}
