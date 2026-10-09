import { Module } from "@nestjs/common";
import { GroceryListController } from "./grocery-list.controller.js";
import { GroceryListService } from "./grocery-list.service.js";
import { MealPlansModule } from "../meal-plans/meal-plans.module.js";

@Module({
  imports: [MealPlansModule],
  controllers: [GroceryListController],
  providers: [GroceryListService],
})
export class GroceryListModule {}
