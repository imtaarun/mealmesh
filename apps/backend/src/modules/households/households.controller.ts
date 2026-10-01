import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { IsInt, Max, Min } from "class-validator";
import { HouseholdsService } from "./households.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

class CostShareDto {
  @IsInt()
  @Min(0)
  @Max(10)
  costShare!: number;
}

@Controller("api/households")
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get("current")
  getCurrent(@CurrentHousehold() household: RequestHousehold) {
    return this.householdsService.getCurrent(household);
  }

  @Get("current/members")
  listMembers(@CurrentHousehold() household: RequestHousehold) {
    return this.householdsService.listMembers(household);
  }

  @Post("current/invites")
  createInvite(@CurrentHousehold() household: RequestHousehold) {
    return this.householdsService.createInvite(household);
  }

  @Patch("current/members/:memberId")
  setCostShare(@CurrentHousehold() household: RequestHousehold, @Param("memberId") memberId: string, @Body() dto: CostShareDto) {
    return this.householdsService.setCostShare(household, memberId, dto.costShare);
  }

  @Delete("current/members/:memberId")
  removeMember(@CurrentHousehold() household: RequestHousehold, @Param("memberId") memberId: string) {
    return this.householdsService.removeMember(household, memberId);
  }

  @Post("current/leave")
  leave(@CurrentHousehold() household: RequestHousehold) {
    return this.householdsService.leave(household);
  }
}
