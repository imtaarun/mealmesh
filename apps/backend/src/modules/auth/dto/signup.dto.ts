import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class SignupDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  householdName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultServings?: number;
}
