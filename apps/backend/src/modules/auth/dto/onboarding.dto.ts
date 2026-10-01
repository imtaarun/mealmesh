import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

const BUDGET_TIERS = ["budget", "balanced", "premium"] as const;

export class OnboardingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  householdName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultServings?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyBudgetCents?: number;

  @IsOptional()
  @IsIn(BUDGET_TIERS)
  budgetTier?: (typeof BUDGET_TIERS)[number];

  @IsArray()
  @IsString({ each: true })
  cuisineLikes: string[] = [];

  @IsArray()
  @IsString({ each: true })
  dislikes: string[] = [];

  @IsArray()
  @IsString({ each: true })
  allergies: string[] = [];

  @IsArray()
  @IsString({ each: true })
  diets: string[] = [];

  @IsOptional()
  @IsIn(["beginner", "intermediate", "advanced"])
  skill?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCookMinutes?: number;

  @IsOptional()
  @IsBoolean()
  leftoverTolerance?: boolean;

  @IsArray()
  @IsString({ each: true })
  busyDays: string[] = [];

  @IsArray()
  @IsString({ each: true })
  eatOutDays: string[] = [];
}
