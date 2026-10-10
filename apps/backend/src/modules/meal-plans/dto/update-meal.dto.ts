import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const ACTIONS = ["replace", "skip", "leftover"] as const;

export class UpdateMealDto {
  @IsIn(ACTIONS)
  action!: (typeof ACTIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  recipeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  leftoverOfMealId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  servings?: number;

  /** Confirms a dislike warning the client has shown. */
  @IsOptional()
  @IsBoolean()
  acknowledgeWarnings?: boolean;
}
