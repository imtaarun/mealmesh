import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MealSlot, MealType, type Prisma } from "@prisma/client";
import {
  aggregateDemand,
  cheapestUnitPriceCents,
  applyPantryAndRound,
  computeMealPlanScore,
  costLine,
  mainProtein,
  pickDinner,
  planWeek,
  type IngredientConversion,
  type PlannerDay,
  type PlannerRecipe,
  type PlanWeekInput,
  type ProductOption,
  type RecipeIngredientDemand,
} from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { AI_PROVIDER, type AIProvider } from "../../providers/ai/ai-provider.interface.js";
import { GroceryPricing } from "../../providers/grocery/grocery-pricing.js";
import { recipeConflicts, toConversion, toPlannerRecipe } from "../../common/recipes.js";
import type { RequestHousehold } from "../../common/household-context.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SLOTS: MealSlot[] = [MealSlot.breakfast, MealSlot.lunch, MealSlot.dinner, MealSlot.snack];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const EXPIRING_WITHIN_DAYS = 5;
/** Goals, not restrictions: a planning bonus, never a filter. */
const GOAL_DIETS = ["healthy", "high_protein"];

const PLAN_INCLUDE = {
  meals: { orderBy: [{ date: "asc" }, { slot: "asc" }], include: { recipe: true } },
  score: true,
} satisfies Prisma.MealPlanInclude;

interface PlannerContext {
  input: PlanWeekInput;
  recipesById: Map<string, PlannerRecipe>;
  conversions: Record<string, IngredientConversion>;
  ingredientNames: Record<string, string>;
  productOptions: ProductOption[];
  budgetCents: number;
}

/** Pro only, enforced here. Selection and scoring are deterministic; the AI only phrases the numbers. */
@Injectable()
export class PlanMyWeekService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly pricing: GroceryPricing,
  ) {}

  async generate(household: RequestHousehold, weekStartDate: string) {
    await this.requirePro(household.householdId);
    const weekStart = new Date(weekStartDate);
    const context = await this.loadContext(household.householdId, weekStart);
    const planned = planWeek(context.input);

    const plan = await this.prisma.$transaction(async (tx) => {
      const plan =
        (await tx.mealPlan.findFirst({ where: { householdId: household.householdId, weekStartDate: weekStart } })) ??
        (await tx.mealPlan.create({ data: { householdId: household.householdId, weekStartDate: weekStart, status: "active" } }));

      // Lunches and dinners are rewritten; picked breakfasts and snacks are kept.
      for (const day of context.input.days) {
        for (const slot of SLOTS) {
          const where = { mealPlanId_date_slot: { mealPlanId: plan.id, date: new Date(day.date), slot } };
          const reset = { type: MealType.skip, recipeId: null, leftoverOfMealId: null, servings: context.input.servings };
          const isPlanned = slot === MealSlot.lunch || slot === MealSlot.dinner;
          await tx.meal.upsert({ where, create: { mealPlanId: plan.id, date: new Date(day.date), slot, ...reset }, update: isPlanned ? reset : {} });
        }
      }

      const dinnerIdByDate = new Map<string, string>();
      for (const meal of planned.filter((m) => m.slot === "dinner")) {
        const row = await tx.meal.update({
          where: { mealPlanId_date_slot: { mealPlanId: plan.id, date: new Date(meal.date), slot: MealSlot.dinner } },
          data: { type: meal.type, recipeId: meal.recipeId, servings: meal.servings },
        });
        dinnerIdByDate.set(meal.date, row.id);
      }
      for (const meal of planned.filter((m) => m.slot === "lunch")) {
        const yesterday = new Date(new Date(meal.date).getTime() - DAY_MS).toISOString().slice(0, 10);
        await tx.meal.update({
          where: { mealPlanId_date_slot: { mealPlanId: plan.id, date: new Date(meal.date), slot: MealSlot.lunch } },
          data: { type: MealType.leftover, recipeId: meal.recipeId, servings: meal.servings, leftoverOfMealId: dinnerIdByDate.get(yesterday)! },
        });
      }
      return plan;
    });

    await this.scorePlan(plan.id, context);
    return this.prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id }, include: PLAN_INCLUDE });
  }

  /** Re-picks one dinner against the rest of the week. */
  async regenerateDinner(household: RequestHousehold, mealPlanId: string, mealId: string) {
    await this.requirePro(household.householdId);
    const plan = await this.prisma.mealPlan.findUnique({ where: { id: mealPlanId }, include: { meals: true } });
    if (!plan || plan.householdId !== household.householdId) throw new NotFoundException(`Meal plan "${mealPlanId}" not found`);
    const meal = plan.meals.find((m) => m.id === mealId);
    if (!meal) throw new NotFoundException(`Meal "${mealId}" not found`);
    if (meal.slot !== MealSlot.dinner || meal.type !== MealType.cook) {
      throw new BadRequestException("Only a cooked dinner can be regenerated; use replace for other slots");
    }

    const context = await this.loadContext(household.householdId, plan.weekStartDate);
    const date = meal.date.toISOString().slice(0, 10);
    const day = context.input.days.find((d) => d.date === date)!;
    const otherDinners = plan.meals
      .filter((m) => m.slot === MealSlot.dinner && m.type === MealType.cook && m.id !== meal.id && m.recipeId)
      .map((m) => context.recipesById.get(m.recipeId!))
      .filter((r): r is PlannerRecipe => r !== undefined);
    const yesterday = plan.meals.find(
      (m) => m.slot === MealSlot.dinner && m.date.getTime() === meal.date.getTime() - DAY_MS && m.recipeId,
    );
    const previous = yesterday ? (context.recipesById.get(yesterday.recipeId!) ?? null) : null;

    const recipe = pickDinner(context.input, day, otherDinners, previous, meal.recipeId ? [meal.recipeId] : []);
    if (!recipe) throw new BadRequestException("No other recipe fits this household's constraints");

    await this.prisma.$transaction([
      this.prisma.meal.update({ where: { id: meal.id }, data: { recipeId: recipe.id } }),
      this.prisma.meal.updateMany({ where: { leftoverOfMealId: meal.id }, data: { recipeId: recipe.id } }),
    ]);
    await this.scorePlan(plan.id, context);
    return this.prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id }, include: PLAN_INCLUDE });
  }

  private async requirePro(householdId: string) {
    const household = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });
    if (household.subscriptionTier !== "pro") {
      throw new ForbiddenException("Plan My Week is a Pro feature — use Build My Week to plan by hand");
    }
  }

  private async loadContext(householdId: string, weekStart: Date): Promise<PlannerContext> {
    const now = new Date();
    const [household, preferences, pantryItems, recipes, lastWeek] = await Promise.all([
      this.prisma.household.findUniqueOrThrow({ where: { id: householdId } }),
      this.prisma.preference.findMany({ where: { OR: [{ householdId }, { member: { householdId } }] } }),
      this.prisma.pantryItem.findMany({ where: { householdId } }),
      this.prisma.recipe.findMany({ where: { source: "seed" }, include: { ingredients: { include: { ingredient: true } } } }),
      this.prisma.mealPlan.findFirst({
        where: { householdId, weekStartDate: new Date(weekStart.getTime() - 7 * DAY_MS) },
        include: { meals: { where: { type: MealType.cook } } },
      }),
    ]);

    const values = (type: string) => preferences.filter((p) => p.type === type).map((p) => p.value);
    const maxCook = values("max_cook_minutes")[0];
    const diets = values("diet");

    const conversions: Record<string, IngredientConversion> = {};
    const ingredientNames: Record<string, string> = {};
    for (const recipe of recipes) {
      for (const line of recipe.ingredients) {
        conversions[line.ingredientId] = toConversion(line.ingredient);
        ingredientNames[line.ingredientId] = line.ingredient.name.toLowerCase();
      }
    }

    const plannerRecipes = recipes
      .map((recipe) => ({ recipe, conflicts: recipeConflicts(recipe, preferences) }))
      .filter(({ conflicts }) => !conflicts.blocked)
      .map(({ recipe, conflicts }) => toPlannerRecipe(recipe, conflicts.warnings.length));

    const pantry: Record<string, number> = {};
    for (const item of pantryItems) pantry[item.ingredientId] = (pantry[item.ingredientId] ?? 0) + item.quantity;
    const expiringBy = new Date(now.getTime() + EXPIRING_WITHIN_DAYS * DAY_MS);

    const { productOptions, dealIngredientIds } = await this.pricing.load();
    const unitPriceCents = cheapestUnitPriceCents(productOptions);

    const days: PlannerDay[] = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart.getTime() + i * DAY_MS);
      const weekday = WEEKDAYS[date.getUTCDay()]!;
      return { date: date.toISOString().slice(0, 10), busy: values("busy_day").includes(weekday), eatOut: values("eat_out_day").includes(weekday) };
    });

    const input: PlanWeekInput = {
      recipes: plannerRecipes,
      days,
      servings: household.defaultServings,
      maxCookMinutes: maxCook ? Number(maxCook) : null,
      requiredDietTags: diets.filter((d) => !GOAL_DIETS.includes(d)),
      goalDietTags: diets.filter((d) => GOAL_DIETS.includes(d)),
      likedCuisines: values("cuisine_like"),
      leftovers: values("leftover_tolerance")[0] === "true",
      pantry,
      expiringIngredientIds: pantryItems.filter((p) => p.expiresAt && p.expiresAt <= expiringBy).map((p) => p.ingredientId),
      dealIngredientIds,
      unitPriceCents,
      avoidRecipeIds: (lastWeek?.meals ?? []).flatMap((m) => (m.recipeId ? [m.recipeId] : [])),
    };

    return {
      input,
      recipesById: new Map(plannerRecipes.map((r) => [r.id, r])),
      conversions,
      ingredientNames,
      productOptions,
      budgetCents: household.weeklyBudgetCents,
    };
  }

  /** Spend = cheapest product anywhere per line, after pantry subtraction. */
  private async scorePlan(mealPlanId: string, context: PlannerContext) {
    const meals = await this.prisma.meal.findMany({ where: { mealPlanId, type: MealType.cook, recipeId: { not: null } } });
    const cooked = meals.map((m) => ({ meal: m, recipe: context.recipesById.get(m.recipeId!) })).filter((c) => c.recipe);

    const demands: RecipeIngredientDemand[] = [];
    const usage: Record<string, number> = {};
    for (const { meal, recipe } of cooked) {
      for (const line of recipe!.ingredients) {
        demands.push({ recipeId: recipe!.id, ingredientId: line.ingredientId, quantity: line.quantity, unit: context.conversions[line.ingredientId]!.baseUnit, recipeServings: recipe!.servings, mealServings: meal.servings });
        usage[line.ingredientId] = (usage[line.ingredientId] ?? 0) + 1;
      }
    }

    let spendCents = 0;
    let consumedValueCents = 0;
    const ingredientCostCents: Record<string, number> = {};
    for (const demand of aggregateDemand(demands, context.conversions)) {
      const line = applyPantryAndRound(demand, context.input.pantry[demand.ingredientId] ?? 0);
      if (line.neededQuantity <= 0 || line.isNominal || line.needsReview) continue;
      const options = context.productOptions.filter((o) => o.ingredientId === line.ingredientId);
      if (options.length === 0) continue;
      const costed = costLine(line, options);
      spendCents += costed.spendCents;
      consumedValueCents += costed.consumedValueCents;
      ingredientCostCents[line.ingredientId] = costed.spendCents;
    }

    const usedIngredientIds = new Set(cooked.flatMap(({ recipe }) => recipe!.ingredients.map((i) => i.ingredientId)));
    const expiring = [...new Set(context.input.expiringIngredientIds)];
    const recipes = cooked.map(({ recipe }) => recipe!);
    const score = computeMealPlanScore({
      budgetCents: context.budgetCents,
      spendCents,
      consumedValueCents,
      ingredientUsageCounts: usage,
      ingredientCostCents,
      expiringItemsUsed: expiring.filter((id) => usedIngredientIds.has(id)).length,
      expiringItemsTotal: expiring.length,
      totalActiveCookMinutes: recipes.reduce((sum, r) => sum + r.totalMinutes, 0),
      mealCount: recipes.length,
      preferredMaxCookMinutes: context.input.maxCookMinutes ?? 0,
      busyDayCount: context.input.days.filter((d) => d.busy).length,
      distinctProteins: new Set(recipes.map(mainProtein)).size,
      distinctCuisines: new Set(recipes.map((r) => r.cuisines[0])).size,
    });

    const explanation = await this.aiProvider.explainPlan({
      computedScore: { ...score, spendCents, budgetCents: context.budgetCents },
      planSummary: {
        mealsCooked: recipes.length,
        sharedIngredients: Object.values(usage).filter((n) => n >= 2).length,
        expiringItemsUsed: expiring.filter((id) => usedIngredientIds.has(id)).map((id) => context.ingredientNames[id] ?? id),
      },
    });

    const data = { ...score, explanation };
    await this.prisma.$transaction([
      this.prisma.mealPlanScore.upsert({ where: { mealPlanId }, create: { mealPlanId, ...data }, update: data }),
      this.prisma.mealPlan.update({ where: { id: mealPlanId }, data: { estimatedCostCents: spendCents } }),
    ]);
  }
}
