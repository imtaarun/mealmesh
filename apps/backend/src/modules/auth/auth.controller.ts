import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import { SignupDto } from "./dto/signup.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { OAuthDto } from "./dto/oauth.dto.js";
import { BeforeAgeCheck, Public } from "../../common/public.decorator.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";
import { AUTH_LIMIT } from "../../common/rate-limits.js";

@Throttle(AUTH_LIMIT)
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

  /** Ends this session on the server, not just on the phone. */
  @BeforeAgeCheck()
  @Post("logout")
  logout(@CurrentHousehold() household: RequestHousehold) {
    return this.authService.logout(household);
  }

  @BeforeAgeCheck()
  @Post("logout-all")
  logoutEverywhere(@CurrentHousehold() household: RequestHousehold) {
    return this.authService.logoutEverywhere(household);
  }
}
