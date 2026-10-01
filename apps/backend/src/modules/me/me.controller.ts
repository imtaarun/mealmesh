import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common";
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { MeService } from "./me.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

class ProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dislikes?: string[];
}

class JoinDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsBoolean()
  replaceMyHousehold!: boolean;
}

@Controller("api/me")
export class MeController {
  constructor(private readonly meService: MeService) {}

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

  @Get("data")
  exportData(@CurrentHousehold() household: RequestHousehold) {
    return this.meService.exportData(household);
  }

  @Delete()
  deleteAccount(@CurrentHousehold() household: RequestHousehold) {
    return this.meService.deleteAccount(household);
  }

  @Post("join")
  join(@CurrentHousehold() household: RequestHousehold, @Body() dto: JoinDto) {
    return this.meService.join(household, dto.code, dto.replaceMyHousehold);
  }
}
