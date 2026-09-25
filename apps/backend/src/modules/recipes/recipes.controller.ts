import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RecipesService } from "./recipes.service.js";

@Controller("api/recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  list(
    @Query("cuisine") cuisine?: string,
    @Query("dietTag") dietTag?: string,
    @Query("maxPrepMinutes") maxPrepMinutes?: string,
    @Query("query") query?: string,
  ) {
    return this.recipesService.list({
      cuisine,
      dietTag,
      maxPrepMinutes: maxPrepMinutes ? Number(maxPrepMinutes) : undefined,
      query,
    });
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.recipesService.getById(id);
  }

  @Post("generate")
  generate(@Body() body: unknown) {
    return this.recipesService.generate(body);
  }
}
