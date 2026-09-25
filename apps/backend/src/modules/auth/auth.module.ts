import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { OnboardingController } from "./onboarding.controller.js";
import { AuthService } from "./auth.service.js";

@Module({
  controllers: [AuthController, OnboardingController],
  providers: [AuthService],
})
export class AuthModule {}
