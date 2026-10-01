import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class SignupDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  /** Joins the inviting household instead of creating a new one. */
  @IsOptional()
  @IsString()
  inviteCode?: string;

  // Older clients name the household at sign-up; the app now does it in profile setup.
  @IsOptional()
  @IsString()
  @MinLength(1)
  householdName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultServings?: number;
}
