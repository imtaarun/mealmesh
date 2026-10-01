import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MealSlot, MealType } from "@prisma/client";
import { checkRecipeConflicts, type ConflictCheckResult } from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import type { RequestHousehold } from "../../common/household-context.js";
import type { CreateMealPlanDto } from "./dto/create-meal-plan.dto.js";
import type { UpdateMealDto } from "./dto/update-meal.dto.js";

const SLOTS: MealSlot[] = [MealSlot.breakfast, MealSlot.lunch, MealSlot.dinner, MealSlot.snack];
const DAYS_PER_WEEK = 7;

/**
 * Orchestrates meal plans. Two paths write to the same Meal rows (docs/architecture.md
 * "Meal plan generation"):
 * - Build My Week (Free + Pro): createEmptyWeek pre-creates one empty slot per
 *   day/slot, then updateMeal("replace", recipeId) fills each in by hand.
 * - Plan My Week (Pro only, auto-fill): PlanMyWeekService.
 */
@Injectable()
export class MealPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** The latest planned week — or, given a date (YYYY-MM-DD), the week that contains it. */
  async getCurrent(household: RequestHousehold, date?: string) {
    const day = date ? new Date(date) : null;
    return this.prisma.mealPlan.findFirst({
      where: {
        householdId: household.householdId,
        ...(day ? { weekStartDate: { lte: day, gt: new Date(day.getTime() - 7 * 24 * 60 * 60 * 1000) } } : {}),
      },
      orderBy: { weekStartDate: "desc" },
      include: {
        meals: {
          orderBy: [{ date: "asc" }, { slot: "asc" }],
          include: { recipe: true },
        },
        score: true,
      },
    });
  }

  /** Build My Week entry point — creates the week grid with every slot empty. */
  async createEmptyWeek(household: RequestHousehold, dto: CreateMealPlanDto) {
    const weekStartDate = new Date(dto.weekStartDate);
    const householdRow = await this.prisma.household.findUniqueOrThrow({ where: { id: household.householdId } });

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.mealPlan.create({
        data: { householdId: household.householdId, weekStartDate, status: "active" },
      });

      const meals = [];
      for (let dayOffset = 0; dayOffset < DAYS_PER_WEEK; dayOffset++) {
        const date = new Date(weekStartDate);
        date.setUTCDate(date.getUTCDate() + dayOffset);
        for (const slot of SLOTS) {
          meals.push({
            mealPlanId: plan.id,
            date,
            slot,
            servings: householdRow.defaultServings,
            type: MealType.skip,
          });
        }
      }
      await tx.meal.createMany({ data: meals });

      return tx.mealPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { meals: { orderBy: [{ date: "asc" }, { slot: "asc" }] } },
      });
    });
  }

  private async loadOwnedMeal(household: RequestHousehold, mealPlanId: string, mealId: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id: mealId }, include: { mealPlan: true } });
    if (!meal || meal.mealPlanId !== mealPlanId) throw new NotFoundException(`Meal "${mealId}" not found`);
    if (meal.mealPlan.householdId !== household.householdId) {
      throw new ForbiddenException("This meal does not belong to your household");
    }
    return meal;
  }

  private async checkConflicts(householdId: string, recipeId: string): Promise<ConflictCheckResult> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe) throw new NotFoundException(`Recipe "${recipeId}" not found`);

    // Household-wide preferences plus every housemate's own allergies and dislikes.
    const preferences = await this.prisma.preference.findMany({
      where: { OR: [{ householdId }, { member: { householdId } }], type: { in: ["allergy", "dislike"] } },
    });

    return checkRecipeConflicts({
      ingredients: recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        name: ri.ingredient.name,
        aliases: ri.ingredient.aliases,
      })),
      allergyValues: preferences.filter((p) => p.type === "allergy").map((p) => p.value),
      dislikeValues: preferences.filter((p) => p.type === "dislike").map((p) => p.value),
    });
  }

  async updateMeal(household: RequestHousehold, mealPlanId: string, mealId: string, dto: UpdateMealDto) {
    const meal = await this.loadOwnedMeal(household, mealPlanId, mealId);

    if (dto.action === "skip") {
      return this.prisma.meal.update({
        where: { id: mealId },
        data: { recipeId: null, type: MealType.skip, leftoverOfMealId: null },
      });
    }

    if (dto.action === "leftover") {
      if (!dto.leftoverOfMealId) throw new BadRequestException("leftoverOfMealId is required for the leftover action");
      const source = await this.loadOwnedMeal(household, mealPlanId, dto.leftoverOfMealId);
      if (source.type !== MealType.cook || !source.recipeId) {
        throw new BadRequestException("leftoverOfMealId must reference a cooked meal");
      }
      return this.prisma.meal.update({
        where: { id: mealId },
        data: { type: MealType.leftover, leftoverOfMealId: source.id, recipeId: source.recipeId },
      });
    }

    // action === "replace"
    if (!dto.recipeId) throw new BadRequestException("recipeId is required for the replace action");

    const conflicts = await this.checkConflicts(household.householdId, dto.recipeId);
    if (conflicts.blocked) {
      return { conflict: conflicts, meal: null };
    }
    if (conflicts.warnings.length > 0 && !dto.acknowledgeWarnings) {
      return { conflict: conflicts, meal: null };
    }

    const updated = await this.prisma.meal.update({
      where: { id: mealId },
      data: {
        recipeId: dto.recipeId,
        type: MealType.cook,
        leftoverOfMealId: null,
        servings: dto.servings ?? meal.servings,
      },
      include: { recipe: true },
    });
    return { conflict: null, meal: updated };
  }
}
