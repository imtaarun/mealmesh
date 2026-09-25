import { Controller, Get } from "@nestjs/common";
import { HouseholdsService } from "./households.service.js";
import { CurrentHousehold, type RequestHousehold } from "../../common/household-context.js";

@Controller("api/households")
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get("current")
  getCurrent(@CurrentHousehold() household: RequestHousehold) {
    return this.householdsService.getCurrent(household);
  }
}
