import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { RequestHousehold } from "../../common/household-context.js";

/** Household, members, and preferences — docs/data-model.md Household/HouseholdMember/Preference. */
@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(_household: RequestHousehold): Promise<never> {
    throw new Error("HouseholdsService.getCurrent: not yet implemented — Phase 1");
  }
}
