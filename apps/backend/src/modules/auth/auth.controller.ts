import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { SignupDto } from "./dto/signup.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { OAuthDto } from "./dto/oauth.dto.js";
import { Public } from "../../common/public.decorator.js";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("signup")
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Google or Apple: the app sends the ID token from the provider's sign-in sheet. */
  @Public()
  @Post("oauth")
  oauth(@Body() dto: OAuthDto) {
    return this.authService.oauth(dto);
  }
}
