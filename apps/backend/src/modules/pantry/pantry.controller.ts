import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { PantryLocation } from "@prisma/client";
import { IsEnum, IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PantryService } from "./pantry.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

class UpdatePantryItemDto {
  /** In the ingredient's base unit. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsEnum(PantryLocation)
  location?: PantryLocation;

  /** null clears it. */
  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}

class AddPantryItemDto extends UpdatePantryItemDto {
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsNumber()
  @Min(0)
  declare quantity: number;

  @IsEnum(PantryLocation)
  declare location: PantryLocation;
}

@Controller("api/pantry")
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Get()
  list(@CurrentHousehold() household: RequestHousehold) {
    return this.pantryService.list(household);
  }

  /** What can go in the pantry: every ingredient, for the add screen's search. */
  @Get("ingredients")
  listIngredients() {
    return this.pantryService.listIngredients();
  }

  @Post("items")
  addItem(@CurrentHousehold() household: RequestHousehold, @Body() dto: AddPantryItemDto) {
    return this.pantryService.addItem(household, dto);
  }

  @Patch("items/:id")
  updateItem(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string, @Body() dto: UpdatePantryItemDto) {
    return this.pantryService.updateItem(household, id, dto);
  }

  @Delete("items/:id")
  removeItem(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string) {
    return this.pantryService.removeItem(household, id);
  }
}
