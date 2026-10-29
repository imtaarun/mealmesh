import { Injectable, NotFoundException } from "@nestjs/common";
import { Difficulty, MealSlot, type Prisma } from "@prisma/client";
import { cheapestUnitPriceCents, checkRecipeConflicts, costPerServingCents } from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { toPlannerRecipe } from "../../common/recipes.js";
import { GroceryPricing } from "../../providers/grocery/grocery-pricing.js";
import type { RequestHousehold } from "../../common/household-context.js";

export interface RecipeListFilters {
  query?: string | undefined;
  cuisine?: string | undefined;
  dietTags?: string[] | undefined;
  mealSlot?: string | undefined;
  difficulty?: string | undefined;
  maxMinutes?: number | undefined;
  fitsHousehold?: boolean | undefined;
  sort?: "title" | "quickest" | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// What a recipe card needs; instructions stay out of the list.
const CARD = {
  id: true,
  title: true,
  imageUrl: true,
  servings: true,
  prepMinutes: true,
  cookMinutes: true,
  difficulty: true,
  cuisines: true,
  dietTags: true,
  mealSlots: true,
  source: true,
} as const;

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: GroceryPricing,
  ) {}

  /** The cuisines and diets the library actually has, with how many dishes each, so no filter leads nowhere. */
  async filterOptions() {
    const countBy = (column: "cuisines" | "dietTags") =>
      this.prisma.$queryRawUnsafe<Array<{ value: string; count: number }>>(
        `SELECT v AS value, COUNT(*)::int AS count FROM "Recipe", unnest("${column}") AS v WHERE source = 'seed' GROUP BY v ORDER BY v`,
      );
    const [cuisines, dietTags] = await Promise.all([countBy("cuisines"), countBy("dietTags")]);
    return { cuisines, dietTags, mealSlots: Object.values(MealSlot), difficulties: Object.values(Difficulty) };
  }

  /** One page of the local library (AI recipes never appear here) and how many match in all. */
  async list(household: RequestHousehold, filters: RecipeListFilters) {
    const where: Prisma.RecipeWhereInput = {
      source: "seed",
      ...(filters.query ? { title: { contains: filters.query, mode: "insensitive" } } : {}),
      ...(filters.cuisine ? { cuisines: { has: filters.cuisine } } : {}),
      ...(filters.dietTags?.length ? { dietTags: { hasEvery: filters.dietTags } } : {}),
      ...(filters.mealSlot ? { mealSlots: { has: filters.mealSlot as MealSlot } } : {}),
      ...(filters.difficulty ? { difficulty: filters.difficulty as Difficulty } : {}),
      ...(filters.maxMinutes !== undefined ? { totalMinutes: { lte: filters.maxMinutes } } : {}),
      ...(filters.fitsHousehold ? { ingredients: { none: { ingredientId: { in: await this.flaggedIngredientIds(household.householdId) } } } } : {}),
    };
    const orderBy: Prisma.RecipeOrderByWithRelationInput[] =
      filters.sort === "quickest" ? [{ totalMinutes: "asc" }, { title: "asc" }, { id: "asc" }] : [{ title: "asc" }, { id: "asc" }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({ where, orderBy, select: CARD, take: filters.limit ?? 20, skip: filters.offset ?? 0 }),
      this.prisma.recipe.count({ where }),
    ]);
    return { items, total };
  }

  /** Ingredients that match an allergy or dislike of the household or any housemate. */
  private async flaggedIngredientIds(householdId: string) {
    const [preferences, ingredients] = await Promise.all([
      this.prisma.preference.findMany({ where: { OR: [{ householdId }, { member: { householdId } }] } }),
      this.prisma.ingredient.findMany({ select: { id: true, name: true, aliases: true } }),
    ]);
    const values = (type: string) => preferences.filter((p) => p.type === type).map((p) => p.value);
    const { blockedMatches, warnings } = checkRecipeConflicts({
      ingredients: ingredients.map((i) => ({ ingredientId: i.id, name: i.name, aliases: i.aliases })),
      allergyValues: values("allergy"),
      dislikeValues: values("dislike"),
    });
    return [...blockedMatches, ...warnings].map((m) => m.ingredientId);
  }

  /** costPerServingCents is null if any ingredient has no price, rather than a partial total. */
  async getById(household: RequestHousehold, id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe) throw new NotFoundException(`Recipe "${id}" not found`);

    const ingredientIds = recipe.ingredients.map((line) => line.ingredientId);
    const [{ productOptions, isDemo }, pantry] = await Promise.all([
      this.pricing.load(ingredientIds),
      this.prisma.pantryItem.findMany({ where: { householdId: household.householdId, ingredientId: { in: ingredientIds }, quantity: { gt: 0 } } }),
    ]);
    const unitPrices = cheapestUnitPriceCents(productOptions);
    const planned = toPlannerRecipe(recipe);
    const priced = planned.ingredients.every((i) => i.quantity === 0 || unitPrices[i.ingredientId] !== undefined);

    return {
      ...recipe,
      costPerServingCents: priced ? Math.round(costPerServingCents(planned, unitPrices)) : null,
      estimatedPricing: isDemo,
      pantryIngredientIds: [...new Set(pantry.map((p) => p.ingredientId))],
    };
  }

  async generate(_input: unknown): Promise<never> {
    throw new Error("RecipesService.generate: not yet implemented — Pro only");
  }
}
