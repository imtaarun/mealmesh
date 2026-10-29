import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Difficulty, MealSlot } from "@prisma/client";
import { RecipesService } from "./recipes.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

const SORTS = ["title", "quickest"] as const;
const splitList = ({ value }: { value: unknown }) => (typeof value === "string" ? value.split(",").filter(Boolean) : value);
const toBool = ({ value }: { value: unknown }) => value === "true";

class ListRecipesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cuisine?: string;

  /** Comma-separated; a recipe must carry every tag. */
  @IsOptional()
  @Transform(splitList)
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  dietTags?: string[];

  @IsOptional()
  @IsEnum(MealSlot)
  mealSlot?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: string;

  /** Prep plus cook. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  maxMinutes?: number;

  /** Hide dishes with something this household is allergic to or dislikes. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  fitsHousehold?: boolean;

  @IsOptional()
  @IsIn(SORTS)
  sort?: (typeof SORTS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

@Controller("api/recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  list(@CurrentHousehold() household: RequestHousehold, @Query() filters: ListRecipesQuery) {
    return this.recipesService.list(household, filters);
  }

  /** What the library can be filtered by, so the app doesn't keep its own copy. */
  @Get("filters")
  filters() {
    return this.recipesService.filterOptions();
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
