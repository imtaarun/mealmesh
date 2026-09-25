import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { OnboardingDto } from "./dto/onboarding.dto.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

@Controller("api/onboarding")
export class OnboardingController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  onboard(@CurrentHousehold() household: RequestHousehold, @Body() dto: OnboardingDto) {
    return this.authService.onboard(household, dto);
  }
}
