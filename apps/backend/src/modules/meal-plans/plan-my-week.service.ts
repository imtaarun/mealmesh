import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MealSlot, MealType, type Prisma } from "@prisma/client";
import {
  aggregateDemand,
  applyPantryAndRound,
  checkRecipeConflicts,
  computeMealPlanScore,
  convertToBaseUnit,
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
  type Unit,
} from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { AI_PROVIDER, type AIProvider } from "../../providers/ai/ai-provider.interface.js";
import { GROCERY_PROVIDER, type GroceryProvider } from "../../providers/grocery/grocery-provider.interface.js";
import type { RequestHousehold } from "../../common/household-context.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SLOTS: MealSlot[] = [MealSlot.breakfast, MealSlot.lunch, MealSlot.dinner, MealSlot.snack];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** Pantry items expiring within this many days count as "use it first". */
const EXPIRING_WITHIN_DAYS = 5;
/** Diets that describe a goal, not a restriction — a bonus in planning, never a filter. */
const GOAL_DIETS = ["healthy", "high_protein"];

const PLAN_INCLUDE = {
  meals: { orderBy: [{ date: "asc" }, { slot: "asc" }], include: { recipe: true } },
  score: true,
} satisfies Prisma.MealPlanInclude;

type RecipeWithIngredients = Prisma.RecipeGetPayload<{ include: { ingredients: { include: { ingredient: true } } } }>;

interface PlannerContext {
  input: PlanWeekInput;
  recipesById: Map<string, PlannerRecipe>;
  conversions: Record<string, IngredientConversion>;
  ingredientNames: Record<string, string>;
  productOptions: ProductOption[];
  budgetCents: number;
}

/**
 * Plan My Week — Pro only (docs/open-questions.md item 11), checked here in the
 * service, not just in the app. Steps follow docs/architecture.md "Meal plan
 * generation": gather context → filter the library in code → select the week
 * deterministically (packages/domain planner) → leftovers → score in code, and only
 * then ask the AIProvider to phrase the already-computed numbers.
 */
@Injectable()
export class PlanMyWeekService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    @Inject(GROCERY_PROVIDER) private readonly groceryProvider: GroceryProvider,
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

      // Every slot exists (same grid as Build My Week). Lunches and dinners are
      // cleared and rewritten; breakfasts and snacks the user picked are kept.
      for (const day of context.input.days) {
        for (const slot of SLOTS) {
          const where = { mealPlanId_date_slot: { mealPlanId: plan.id, date: new Date(day.date), slot } };
          const reset = { type: MealType.skip, recipeId: null, leftoverOfMealId: null, servings: context.input.servings };
          const isPlanned = slot === MealSlot.lunch || slot === MealSlot.dinner;
          await tx.meal.upsert({ where, create: { mealPlanId: plan.id, date: new Date(day.date), slot, ...reset }, update: isPlanned ? reset : {} });
        }
      }

      // Dinners first, so leftover lunches can point at the dinner they come from.
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

  /** Re-runs selection for one dinner against the rest of the week (architecture step 3). */
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
      this.prisma.preference.findMany({ where: { householdId } }),
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
      .map((recipe) => ({ recipe, conflicts: this.conflicts(recipe, values("allergy"), values("dislike")) }))
      .filter(({ conflicts }) => !conflicts.blocked)
      .map(({ recipe, conflicts }) => toPlannerRecipe(recipe, conversions, conflicts.warnings.length));

    const pantry: Record<string, number> = {};
    for (const item of pantryItems) pantry[item.ingredientId] = (pantry[item.ingredientId] ?? 0) + item.quantity;
    const expiringBy = new Date(now.getTime() + EXPIRING_WITHIN_DAYS * DAY_MS);

    const { productOptions, dealIngredientIds } = await this.loadPricing();
    const unitPriceCents: Record<string, number> = {};
    for (const option of productOptions) {
      const unit = option.priceCents / option.packSize;
      unitPriceCents[option.ingredientId] = Math.min(unitPriceCents[option.ingredientId] ?? Infinity, unit);
    }

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

  private conflicts(recipe: RecipeWithIngredients, allergyValues: string[], dislikeValues: string[]) {
    return checkRecipeConflicts({
      ingredients: recipe.ingredients.map((ri) => ({ ingredientId: ri.ingredientId, name: ri.ingredient.name, aliases: ri.ingredient.aliases })),
      allergyValues,
      dislikeValues,
    });
  }

  /** Current price of every product, plus which ingredients are on a deal — via the GroceryProvider (CLAUDE.md rule 3). */
  private async loadPricing() {
    const products = await this.groceryProvider.searchProducts({});
    const prices = await Promise.all(products.map((p) => this.groceryProvider.getPrice(p.id)));
    const productOptions: ProductOption[] = [];
    products.forEach((product, i) => {
      const price = prices[i];
      if (price) {
        productOptions.push({
          productId: product.id,
          storeId: product.storeId,
          ingredientId: product.ingredientId,
          priceCents: price.priceCents,
          packSize: product.packSize,
          packUnit: product.packUnit,
        });
      }
    });

    const storeIds = [...new Set(products.map((p) => p.storeId))];
    const deals = (await Promise.all(storeIds.map((id) => this.groceryProvider.getDeals(id)))).flat();
    const ingredientByProduct = new Map(products.map((p) => [p.id, p.ingredientId]));
    const dealIngredientIds = [...new Set(deals.map((d) => ingredientByProduct.get(d.productId)!))];
    return { productOptions, dealIngredientIds };
  }

  /**
   * MealMesh Score (docs/algorithms.md §6) for the plan as it now stands. Spend is the
   * cheapest product anywhere for each line after pantry subtraction — the min-cost
   * estimate, before the shopper picks stores. The AI only phrases these numbers.
   */
  private async scorePlan(mealPlanId: string, context: PlannerContext) {
    const meals = await this.prisma.meal.findMany({ where: { mealPlanId, type: MealType.cook, recipeId: { not: null } } });
    const cooked = meals.map((m) => ({ meal: m, recipe: context.recipesById.get(m.recipeId!) })).filter((c) => c.recipe);

    const demands: RecipeIngredientDemand[] = [];
    const usage: Record<string, number> = {};
    for (const { meal, recipe } of cooked) {
      for (const line of recipe!.ingredients) {
        // PlannerRecipe quantities are already in base units for recipe.servings.
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

function toConversion(ingredient: RecipeWithIngredients["ingredients"][number]["ingredient"]): IngredientConversion {
  return {
    id: ingredient.id,
    baseUnit: ingredient.baseUnit,
    ...(ingredient.gramsPerPiece !== null ? { gramsPerPiece: ingredient.gramsPerPiece } : {}),
    ...(ingredient.gramsPerCup !== null ? { gramsPerCup: ingredient.gramsPerCup } : {}),
    ...(ingredient.density !== null ? { density: ingredient.density } : {}),
  };
}

/** Recipe → planner shape: optional lines dropped, quantities converted to base units. */
function toPlannerRecipe(recipe: RecipeWithIngredients, conversions: Record<string, IngredientConversion>, dislikeMatches: number): PlannerRecipe {
  return {
    id: recipe.id,
    servings: recipe.servings,
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
    cuisines: recipe.cuisines,
    dietTags: recipe.dietTags,
    mealSlots: recipe.mealSlots,
    ingredients: recipe.ingredients
      .filter((line) => !line.optional)
      .map((line) => ({
        ingredientId: line.ingredientId,
        quantity: convertToBaseUnit({ value: line.quantity, unit: line.unit as Unit }, conversions[line.ingredientId]!).value,
        proteinGroup: line.ingredient.proteinGroup,
        isStaple: line.ingredient.isStaple,
      })),
    dislikeMatches,
  };
}
