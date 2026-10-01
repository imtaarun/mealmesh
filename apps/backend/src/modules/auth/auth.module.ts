import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { OnboardingController } from "./onboarding.controller.js";
import { AuthService } from "./auth.service.js";
import { OAuthVerifier } from "./oauth-verifier.js";

@Module({
  controllers: [AuthController, OnboardingController],
  providers: [AuthService, OAuthVerifier],
})
export class AuthModule {}
