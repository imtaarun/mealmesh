import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class OAuthDto {
  @IsIn(["google", "apple"])
  provider!: "google" | "apple";

  /** The ID token from the provider's sign-in sheet (a signed JWT). */
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  idToken!: string;

  /** Apple only sends the user's name to the app, once, on first sign-in — not in the token. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  inviteCode?: string;

  /** Needed only when this sign-in creates a new account (YYYY-MM-DD). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateOfBirth must be YYYY-MM-DD" })
  dateOfBirth?: string;
}
