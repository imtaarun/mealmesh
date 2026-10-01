import { Injectable, NotFoundException } from "@nestjs/common";
import { cheapestUnitPriceCents, costPerServingCents } from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { toPlannerRecipe } from "../../common/recipes.js";
import { GroceryPricing } from "../../providers/grocery/grocery-pricing.js";
import type { RequestHousehold } from "../../common/household-context.js";

export interface RecipeListFilters {
  cuisine?: string | undefined;
  dietTag?: string | undefined;
  maxPrepMinutes?: number | undefined;
  query?: string | undefined;
}

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: GroceryPricing,
  ) {}

  /** Local library only; AI recipes never appear here. */
  async list(filters: RecipeListFilters) {
    return this.prisma.recipe.findMany({
      where: {
        source: "seed",
        ...(filters.cuisine ? { cuisines: { has: filters.cuisine } } : {}),
        ...(filters.dietTag ? { dietTags: { has: filters.dietTag } } : {}),
        ...(filters.maxPrepMinutes !== undefined ? { prepMinutes: { lte: filters.maxPrepMinutes } } : {}),
        ...(filters.query ? { title: { contains: filters.query, mode: "insensitive" } } : {}),
      },
      orderBy: { title: "asc" },
    });
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
