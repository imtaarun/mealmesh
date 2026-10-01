import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

const ACTIONS = ["replace", "skip", "leftover"] as const;

export class UpdateMealDto {
  @IsIn(ACTIONS)
  action!: (typeof ACTIONS)[number];

  @IsOptional()
  @IsString()
  recipeId?: string;

  @IsOptional()
  @IsString()
  leftoverOfMealId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  servings?: number;

  /** Confirms a dislike warning the client has shown. */
  @IsOptional()
  @IsBoolean()
  acknowledgeWarnings?: boolean;
}
