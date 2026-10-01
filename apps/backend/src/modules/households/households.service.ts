import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { RequestHousehold } from "../../common/household-context.js";

/** Household, members, and preferences — docs/data-model.md Household/HouseholdMember/Preference. */
@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in household with its preferences — the app reads subscriptionTier
   * from here to decide whether to offer Plan My Week. */
  async getCurrent(household: RequestHousehold) {
    return this.prisma.household.findUniqueOrThrow({
      where: { id: household.householdId },
      include: { preferences: true },
    });
  }
}
