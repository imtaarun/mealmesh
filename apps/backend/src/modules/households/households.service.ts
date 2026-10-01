import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MemberRole, type Prisma } from "@prisma/client";
import { splitCents } from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { generateInviteCode, hashInviteCode, INVITE_TTL_MS } from "../../common/invite-code.js";
import type { RequestHousehold } from "../../common/household-context.js";

/**
 * The household and the people in it. Housemates have their own logins and join with
 * an invite code (docs/open-questions.md item 20). The owner invites and removes
 * people and sets cost shares; a removed or departing member keeps their account and
 * gets an empty household of their own — nobody's account is deleted by someone else.
 */
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

  /**
   * Everyone in the household, plus how the latest week's estimated grocery cost
   * splits between them (by costShare). The estimate is approximate pricing, so the
   * app shows the Estimated pricing badge next to it.
   */
  async listMembers(household: RequestHousehold) {
    const [members, latestPlan] = await Promise.all([
      this.prisma.householdMember.findMany({
        where: { householdId: household.householdId },
        include: { user: { select: { email: true } } },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      this.prisma.mealPlan.findFirst({ where: { householdId: household.householdId }, orderBy: { weekStartDate: "desc" } }),
    ]);

    const estimate = latestPlan?.estimatedCostCents ?? null;
    const shares =
      estimate !== null && members.some((m) => m.costShare > 0)
        ? splitCents(estimate, members.map((m) => ({ id: m.id, weight: m.costShare })))
        : null;

    return {
      weekStartDate: latestPlan?.weekStartDate ?? null,
      weekEstimateCents: estimate,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.user?.email ?? null,
        role: m.role,
        costShare: m.costShare,
        isYou: m.userId === household.userId,
        weekShareCents: shares ? shares[m.id]! : null,
      })),
    };
  }

  async createInvite(household: RequestHousehold) {
    await this.requireOwner(household);
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.prisma.householdInvite.create({
      data: { codeHash: hashInviteCode(code), expiresAt, householdId: household.householdId, createdByUserId: household.userId },
    });
    // The only time the plain code exists — the owner shares it, we keep the hash.
    return { code, expiresAt };
  }

  async setCostShare(household: RequestHousehold, memberId: string, costShare: number) {
    await this.requireOwner(household);
    const members = await this.prisma.householdMember.findMany({ where: { householdId: household.householdId } });
    if (!members.some((m) => m.id === memberId)) throw new NotFoundException("That person isn't in your household");
    if (!members.some((m) => (m.id === memberId ? costShare : m.costShare) > 0)) {
      throw new BadRequestException("At least one person needs to pay a share");
    }
    await this.prisma.householdMember.update({ where: { id: memberId }, data: { costShare } });
    return this.listMembers(household);
  }

  async removeMember(household: RequestHousehold, memberId: string) {
    const owner = await this.requireOwner(household);
    const member = await this.prisma.householdMember.findUnique({ where: { id: memberId } });
    if (!member || member.householdId !== household.householdId) throw new NotFoundException("That person isn't in your household");
    if (member.id === owner.id) throw new BadRequestException("You can't remove yourself — the owner stays with the household");
    await this.prisma.$transaction((tx) => this.moveToOwnHousehold(tx, member.id));
    return this.listMembers(household);
  }

  async leave(household: RequestHousehold) {
    const me = await this.prisma.householdMember.findUniqueOrThrow({ where: { userId: household.userId } });
    if (me.role === MemberRole.owner) {
      throw new BadRequestException("The owner can't leave — remove your housemates first, or delete your account");
    }
    await this.prisma.$transaction((tx) => this.moveToOwnHousehold(tx, me.id));
    return { left: true };
  }

  /** Gives a member a fresh household of their own (as its owner), keeping their account and personal preferences. */
  private async moveToOwnHousehold(tx: Prisma.TransactionClient, memberId: string) {
    const member = await tx.householdMember.findUniqueOrThrow({ where: { id: memberId } });
    const fresh = await tx.household.create({ data: { name: `${member.name}'s household`, weeklyBudgetCents: 0 } });
    await tx.householdMember.update({ where: { id: memberId }, data: { householdId: fresh.id, role: MemberRole.owner, costShare: 1 } });
    if (member.userId) await tx.user.update({ where: { id: member.userId }, data: { householdId: fresh.id } });
  }

  private async requireOwner(household: RequestHousehold) {
    const me = await this.prisma.householdMember.findUnique({ where: { userId: household.userId } });
    if (!me || me.householdId !== household.householdId || me.role !== MemberRole.owner) {
      throw new ForbiddenException("Only the household owner can do that");
    }
    return me;
  }
}
