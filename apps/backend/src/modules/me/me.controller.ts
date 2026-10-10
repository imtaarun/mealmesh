import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { BeforeAgeCheck } from "../../common/public.decorator.js";
import { AUTH_LIMIT } from "../../common/rate-limits.js";
import { MeService } from "./me.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

class ProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  dislikes?: string[];
}

class AgeDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateOfBirth must be YYYY-MM-DD" })
  dateOfBirth!: string;
}

class JoinDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsBoolean()
  replaceMyHousehold!: boolean;
}

@Controller("api/me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @BeforeAgeCheck()
  @Get()
  get(@CurrentHousehold() household: RequestHousehold) {
    return this.meService.get(household);
  }

  @Put("profile")
  updateProfile(@CurrentHousehold() household: RequestHousehold, @Body() dto: ProfileDto) {
    return this.meService.updateProfile(household, dto);
  }

  @Get("history")
  history(@CurrentHousehold() household: RequestHousehold) {
    return this.meService.history(household);
  }

  @BeforeAgeCheck()
  @Get("data")
  exportData(@CurrentHousehold() household: RequestHousehold) {
    return this.meService.exportData(household);
  }

  @BeforeAgeCheck()
  @Delete()
  deleteAccount(@CurrentHousehold() household: RequestHousehold) {
    return this.meService.deleteAccount(household);
  }

  /** Accounts from before the age check confirm it here. */
  @BeforeAgeCheck()
  @Post("age")
  confirmAge(@CurrentHousehold() household: RequestHousehold, @Body() dto: AgeDto) {
    return this.meService.confirmAge(household, dto.dateOfBirth);
  }

  @Throttle(AUTH_LIMIT)
  @Post("join")
  join(@CurrentHousehold() household: RequestHousehold, @Body() dto: JoinDto) {
    return this.meService.join(household, dto.code, dto.replaceMyHousehold);
  }
}
