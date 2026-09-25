import { Module } from "@nestjs/common";
import { GroceryListController } from "./grocery-list.controller.js";
import { GroceryListService } from "./grocery-list.service.js";

@Module({
  controllers: [GroceryListController],
  providers: [GroceryListService],
})
export class GroceryListModule {}
