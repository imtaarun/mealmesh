import { BadRequestException, Injectable } from "@nestjs/common";
import { MemberRole, PreferenceType, type Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service.js";
import { hashInviteCode } from "../../common/invite-code.js";
import type { RequestHousehold } from "../../common/household-context.js";

/**
 * The signed-in person's own view: their profile, their history with the app,
 * everything we store about them (as a download), and deleting their account
 * (docs/open-questions.md item 21).
 */
@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(household: RequestHousehold) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: household.userId },
      include: { oauthAccounts: true, members: { include: { preferences: true } }, household: { include: { preferences: true } } },
    });
    const member = user.members[0]!;
    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt, signInMethods: signInMethods(user) },
      member: {
        id: member.id,
        name: member.name,
        role: member.role,
        costShare: member.costShare,
        allergies: member.preferences.filter((p) => p.type === PreferenceType.allergy).map((p) => p.value),
        dislikes: member.preferences.filter((p) => p.type === PreferenceType.dislike).map((p) => p.value),
      },
      household: {
        id: user.household.id,
        name: user.household.name,
        subscriptionTier: user.household.subscriptionTier,
        weeklyBudgetCents: user.household.weeklyBudgetCents,
        budgetTier: user.household.budgetTier,
        defaultServings: user.household.defaultServings,
        preferences: user.household.preferences.map((p) => ({ type: p.type, value: p.value })),
      },
      needsProfile: member.profileCompletedAt === null,
    };
  }

  /** Profile setup and editing: your name and your own allergies and dislikes. */
  async updateProfile(household: RequestHousehold, input: { name: string; allergies?: string[] | undefined; dislikes?: string[] | undefined }) {
    const member = await this.prisma.householdMember.findUniqueOrThrow({ where: { userId: household.userId } });
    await this.prisma.$transaction(async (tx) => {
      await tx.householdMember.update({
        where: { id: member.id },
        data: { name: input.name.trim(), profileCompletedAt: member.profileCompletedAt ?? new Date() },
      });
      for (const [type, values] of [[PreferenceType.allergy, input.allergies], [PreferenceType.dislike, input.dislikes]] as const) {
        if (values === undefined) continue;
        await tx.preference.deleteMany({ where: { memberId: member.id, type } });
        if (values.length > 0) await tx.preference.createMany({ data: values.map((value) => ({ type, value, memberId: member.id })) });
      }
    });
    return this.get(household);
  }

  /** Every week the household has planned, newest first, with totals across them. */
  async history(household: RequestHousehold) {
    const plans = await this.prisma.mealPlan.findMany({
      where: { householdId: household.householdId },
      orderBy: { weekStartDate: "desc" },
      include: { score: true, meals: { include: { recipe: { select: { id: true, title: true } } } } },
    });

    const weeks = plans.map((plan) => {
      const cooked = plan.meals.filter((m) => m.type === "cook" && m.recipe);
      return {
        mealPlanId: plan.id,
        weekStartDate: plan.weekStartDate,
        mealsCooked: cooked.length,
        leftoverMeals: plan.meals.filter((m) => m.type === "leftover").length,
        estimatedCostCents: plan.estimatedCostCents,
        score: plan.score?.total ?? null,
        dishes: cooked.map((m) => m.recipe!.title),
      };
    });

    const timesCooked = new Map<string, number>();
    for (const week of weeks) for (const dish of week.dishes) timesCooked.set(dish, (timesCooked.get(dish) ?? 0) + 1);
    const scored = weeks.filter((w) => w.score !== null);

    return {
      totals: {
        weeksPlanned: weeks.length,
        mealsCooked: weeks.reduce((sum, w) => sum + w.mealsCooked, 0),
        estimatedSpendCents: weeks.reduce((sum, w) => sum + (w.estimatedCostCents ?? 0), 0),
        averageScore: scored.length > 0 ? Math.round(scored.reduce((sum, w) => sum + w.score!, 0) / scored.length) : null,
      },
      favourites: [...timesCooked.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([title, times]) => ({ title, times })),
      weeks,
    };
  }

  /**
   * Everything we store about this person and the household they're in, as plain
   * JSON. Secrets are left out (password hash, session and invite token hashes), and
   * so are housemates' emails — those are theirs, not yours.
   */
  async exportData(household: RequestHousehold) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: household.userId },
      include: {
        oauthAccounts: true,
        sessions: { orderBy: { createdAt: "desc" } },
        members: { include: { preferences: true, ratings: { include: { recipe: { select: { title: true } } } } } },
        household: {
          include: {
            preferences: true,
            members: true,
            pantryItems: { include: { ingredient: { select: { name: true } } } },
            mealPlans: {
              orderBy: { weekStartDate: "desc" },
              include: { score: true, meals: { orderBy: [{ date: "asc" }, { slot: "asc" }], include: { recipe: { select: { title: true } } } } },
            },
          },
        },
      },
    });
    const invites = await this.prisma.householdInvite.findMany({ where: { createdByUserId: user.id }, orderBy: { createdAt: "desc" } });
    const member = user.members[0]!;
    const h = user.household;

    return {
      exportedAt: new Date(),
      account: {
        email: user.email,
        createdAt: user.createdAt,
        signInMethods: signInMethods(user),
        linkedAccounts: user.oauthAccounts.map((a) => ({ provider: a.provider, email: a.email, linkedAt: a.createdAt })),
        sessions: user.sessions.map((s) => ({ signedInAt: s.createdAt, expiresAt: s.expiresAt })),
      },
      profile: {
        name: member.name,
        role: member.role,
        costShare: member.costShare,
        allergies: member.preferences.filter((p) => p.type === PreferenceType.allergy).map((p) => p.value),
        dislikes: member.preferences.filter((p) => p.type === PreferenceType.dislike).map((p) => p.value),
        ratings: member.ratings.map((r) => ({ recipe: r.recipe.title, rating: r.rating, at: r.createdAt })),
      },
      household: {
        name: h.name,
        subscriptionTier: h.subscriptionTier,
        weeklyBudgetCents: h.weeklyBudgetCents,
        budgetTier: h.budgetTier,
        defaultServings: h.defaultServings,
        timezone: h.timezone,
        preferences: h.preferences.map((p) => ({ type: p.type, value: p.value })),
        housemates: h.members.map((m) => ({ name: m.name, role: m.role, costShare: m.costShare })),
        invitesYouCreated: invites.map((i) => ({ createdAt: i.createdAt, expiresAt: i.expiresAt, accepted: i.acceptedAt !== null })),
      },
      pantry: h.pantryItems.map((p) => ({ item: p.ingredient.name, quantity: p.quantity, unit: p.unit, location: p.location, expiresAt: p.expiresAt, addedAt: p.addedAt })),
      mealPlans: h.mealPlans.map((plan) => ({
        weekStartDate: plan.weekStartDate,
        estimatedCostCents: plan.estimatedCostCents,
        score: plan.score ? { total: plan.score.total, explanation: plan.score.explanation } : null,
        meals: plan.meals.map((m) => ({ date: m.date, slot: m.slot, type: m.type, recipe: m.recipe?.title ?? null, servings: m.servings })),
      })),
    };
  }

  /**
   * Deletes the account. Alone in the household → the household and everything in it
   * go too. Owner with housemates → ownership passes to a housemate first, and the
   * shared household (plans, pantry) stays for them.
   */
  async deleteAccount(household: RequestHousehold) {
    await this.prisma.$transaction(async (tx) => {
      const members = await tx.householdMember.findMany({ where: { householdId: household.householdId }, orderBy: { name: "asc" } });
      const me = members.find((m) => m.userId === household.userId)!;
      const others = members.filter((m) => m.id !== me.id);

      if (others.length === 0) {
        await deleteUser(tx, household.userId, me.id);
        await deleteHousehold(tx, household.householdId);
        return;
      }
      if (me.role === MemberRole.owner) {
        await tx.householdMember.update({ where: { id: others[0]!.id }, data: { role: MemberRole.owner } });
      }
      await deleteUser(tx, household.userId, me.id);
    });
    return { deleted: true };
  }

  /**
   * Joins another household with an invite code, for someone who already has an
   * account. Only allowed when they're alone in their own household, which is then
   * deleted — so the app must ask first and send replaceMyHousehold: true.
   */
  async join(household: RequestHousehold, code: string, replaceMyHousehold: boolean) {
    if (!replaceMyHousehold) {
      throw new BadRequestException("Joining replaces your current household and its plans — confirm to continue");
    }
    await this.prisma.$transaction(async (tx) => {
      const members = await tx.householdMember.findMany({ where: { householdId: household.householdId } });
      if (members.length > 1) throw new BadRequestException("Leave your current household before joining another");

      const invite = await tx.householdInvite.findUnique({ where: { codeHash: hashInviteCode(code) } });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new BadRequestException("That invite code isn't valid any more — ask for a new one");
      }
      if (invite.householdId === household.householdId) throw new BadRequestException("You're already in that household");

      await tx.user.update({ where: { id: household.userId }, data: { householdId: invite.householdId } });
      await tx.householdMember.update({
        where: { id: members[0]!.id },
        data: { householdId: invite.householdId, role: MemberRole.member, costShare: 1 },
      });
      await tx.householdInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date(), acceptedByUserId: household.userId } });
      await deleteHousehold(tx, household.householdId);
    });
    return { joined: true };
  }
}

function signInMethods(user: { passwordHash: string | null; oauthAccounts: Array<{ provider: string }> }): string[] {
  return [...(user.passwordHash ? ["email"] : []), ...user.oauthAccounts.map((a) => a.provider)];
}

/** One person's own rows. Run before deleteHousehold when they were the last member. */
async function deleteUser(tx: Prisma.TransactionClient, userId: string, memberId: string) {
  await tx.mealRating.deleteMany({ where: { OR: [{ memberId }, { userId }] } });
  await tx.preference.deleteMany({ where: { memberId } });
  await tx.householdMember.delete({ where: { id: memberId } });
  await tx.householdInvite.deleteMany({ where: { createdByUserId: userId, acceptedAt: null } });
  await tx.session.deleteMany({ where: { userId } });
  await tx.oAuthAccount.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
}

/** A household nobody is in any more, and everything that hangs off it — children before parents. */
async function deleteHousehold(tx: Prisma.TransactionClient, householdId: string) {
  const planIds = (await tx.mealPlan.findMany({ where: { householdId }, select: { id: true } })).map((p) => p.id);
  const listIds = (await tx.groceryList.findMany({ where: { mealPlanId: { in: planIds } }, select: { id: true } })).map((l) => l.id);
  const receiptIds = (await tx.receipt.findMany({ where: { householdId }, select: { id: true } })).map((r) => r.id);

  await tx.shoppingOptimization.deleteMany({ where: { groceryListId: { in: listIds } } });
  await tx.groceryListItem.deleteMany({ where: { groceryListId: { in: listIds } } });
  await tx.groceryList.deleteMany({ where: { id: { in: listIds } } });
  await tx.deal.updateMany({ where: { mealPlanId: { in: planIds } }, data: { mealPlanId: null } });
  await tx.meal.updateMany({ where: { mealPlanId: { in: planIds } }, data: { leftoverOfMealId: null } });
  await tx.meal.deleteMany({ where: { mealPlanId: { in: planIds } } });
  await tx.mealPlanScore.deleteMany({ where: { mealPlanId: { in: planIds } } });
  await tx.mealPlan.deleteMany({ where: { id: { in: planIds } } });
  await tx.receiptItem.deleteMany({ where: { receiptId: { in: receiptIds } } });
  await tx.receipt.deleteMany({ where: { id: { in: receiptIds } } });
  await tx.pantryItem.deleteMany({ where: { householdId } });
  await tx.priceHistory.deleteMany({ where: { householdId } });
  await tx.preference.deleteMany({ where: { householdId } });
  await tx.householdInvite.deleteMany({ where: { householdId } });
  await tx.household.delete({ where: { id: householdId } });
}
