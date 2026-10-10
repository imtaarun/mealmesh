import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

const BUDGET_TIERS = ["budget", "balanced", "premium"] as const;

export class OnboardingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  householdName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  defaultServings?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  weeklyBudgetCents?: number;

  @IsOptional()
  @IsIn(BUDGET_TIERS)
  budgetTier?: (typeof BUDGET_TIERS)[number];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  cuisineLikes: string[] = [];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  dislikes: string[] = [];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  allergies: string[] = [];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  diets: string[] = [];

  @IsOptional()
  @IsIn(["beginner", "intermediate", "advanced"])
  skill?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  maxCookMinutes?: number;

  @IsOptional()
  @IsBoolean()
  leftoverTolerance?: boolean;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  busyDays: string[] = [];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  eatOutDays: string[] = [];
}
