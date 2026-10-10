import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { RecipesService } from "./recipes.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

class ListRecipesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cuisine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  dietTag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  maxPrepMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}

@Controller("api/recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  list(@Query() filters: ListRecipesQuery) {
    return this.recipesService.list(filters);
  }

  @Get(":id")
  getById(@CurrentHousehold() household: RequestHousehold, @Param("id") id: string) {
    return this.recipesService.getById(household, id);
  }

  @Post("generate")
  generate(@Body() body: unknown) {
    return this.recipesService.generate(body);
  }
}
