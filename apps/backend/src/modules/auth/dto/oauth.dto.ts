import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class OAuthDto {
  @IsIn(["google", "apple"])
  provider!: "google" | "apple";

  /** The ID token from the provider's sign-in sheet (a signed JWT). */
  @IsString()
  @MinLength(1)
  idToken!: string;

  /** Apple only sends the user's name to the app, once, on first sign-in — not in the token. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}
