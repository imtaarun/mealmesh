import { IsISO8601 } from "class-validator";

export class CreateMealPlanDto {
  @IsISO8601()
  weekStartDate!: string;
}
