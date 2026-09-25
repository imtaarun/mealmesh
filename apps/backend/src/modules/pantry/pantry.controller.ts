import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PantryService } from "./pantry.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

@Controller("api/pantry")
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Get()
  list(@CurrentHousehold() household: RequestHousehold) {
    return this.pantryService.list(household);
  }

  @Post("items")
  addItem(@CurrentHousehold() household: RequestHousehold, @Body() body: unknown) {
    return this.pantryService.addItem(household, body);
  }

  @Patch("items/:id")
  updateItem(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string, @Body() patch: unknown) {
    return this.pantryService.updateItem(household, id, patch);
  }
}
