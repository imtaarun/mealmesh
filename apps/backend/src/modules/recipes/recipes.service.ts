import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { cheapestUnitPriceCents, convertToBaseUnit, type Unit } from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { toConversion } from "../../common/ingredient-conversion.js";
import { AI_PROVIDER, type AIProvider } from "../../providers/ai/ai-provider.interface.js";
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
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly pricing: GroceryPricing,
  ) {}

  /** Build My Week's browse view — the local library only (docs/product-spec.md
   * "Build My Week"). AI-generated recipes never appear here regardless of tier. */
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

  /**
   * The recipe page: the recipe, what one serving costs (docs/algorithms.md §3 consumed
   * value, at the cheapest current price for each ingredient), and which ingredients
   * this household already has. costPerServingCents is null when an ingredient has no
   * price anywhere, rather than a total that quietly leaves it out.
   */
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

    let totalCents = 0;
    let priced = true;
    for (const line of recipe.ingredients.filter((l) => !l.optional)) {
      const quantity = convertToBaseUnit({ value: line.quantity, unit: line.unit as Unit }, toConversion(line.ingredient));
      if (quantity.isNominal) continue; // "a pinch of salt" never affects cost (docs/algorithms.md §1)
      const unitPrice = unitPrices[line.ingredientId];
      if (unitPrice === undefined) priced = false;
      else totalCents += quantity.value * unitPrice;
    }

    return {
      ...recipe,
      costPerServingCents: priced ? Math.round(totalCents / recipe.servings) : null,
      estimatedPricing: isDemo,
      pantryIngredientIds: [...new Set(pantry.map((p) => p.ingredientId))],
    };
  }

  async generate(_input: unknown): Promise<never> {
    throw new Error("RecipesService.generate: not yet implemented — Phase 5, Pro only");
  }
}
