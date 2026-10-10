import { IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class SignupDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @MinLength(8)
  @MaxLength(200)
  password!: string;

  /** YYYY-MM-DD. Checked against the minimum age; only the year is kept. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateOfBirth must be YYYY-MM-DD" })
  dateOfBirth!: string;

  /** Joins the inviting household instead of creating a new one. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  inviteCode?: string;

  // Older clients name the household at sign-up; the app now does it in profile setup.
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
}
