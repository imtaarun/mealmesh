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

  /** Set true to write a "replace" through even though it matched a soft dislike —
   * the client shows the warning first and resubmits with this set. */
  @IsOptional()
  @IsBoolean()
  acknowledgeWarnings?: boolean;
}
