import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MealType, type BaseUnit, type GroceryListItem, type Ingredient } from "@prisma/client";
import {
  buildGroceryList,
  cheapestForQuantity,
  convertToBaseUnit,
  DEFAULT_TRIP_COST_CENTS,
  optimizeBasket,
  roundUpToPurchaseIncrement,
  type BasketItem,
  type IngredientConversion,
  type OptimizationResult,
  type OptimizationStrategy,
  type ProductOption,
  type RecipeIngredientDemand,
  type Unit,
} from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { toConversion } from "../../common/recipes.js";
import { GROCERY_PROVIDER, type GroceryProvider } from "../../providers/grocery/grocery-provider.interface.js";
import { GroceryPricing } from "../../providers/grocery/grocery-pricing.js";
import { PlanMyWeekService } from "../meal-plans/plan-my-week.service.js";
import type { RequestHousehold } from "../../common/household-context.js";

type ItemPatch = { checked?: boolean; alreadyHave?: boolean; userOverrideQuantity?: number | null; buyAnyway?: boolean };

const STRATEGIES: OptimizationStrategy[] = ["min_cost", "min_stores", "best_overall"];

@Injectable()
export class GroceryListService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GROCERY_PROVIDER) private readonly groceryProvider: GroceryProvider,
    private readonly pricing: GroceryPricing,
    private readonly planMyWeek: PlanMyWeekService,
  ) {}

  /** Rebuilt from the plan and pantry on every read, so it never goes stale; checks and overrides carry over. */
  async getForPlan(household: RequestHousehold, mealPlanId: string) {
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: mealPlanId, householdId: household.householdId },
      include: {
        meals: { where: { type: MealType.cook, recipeId: { not: null } }, include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } } },
        groceryList: { include: { items: true } },
      },
    });
    if (!plan) throw new NotFoundException("That week isn't in your household");

    const pantryItems = await this.prisma.pantryItem.findMany({
      where: { householdId: household.householdId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const pantry: Record<string, number> = {};
    for (const item of pantryItems) pantry[item.ingredientId] = (pantry[item.ingredientId] ?? 0) + item.quantity;

    const ingredients: Record<string, IngredientConversion & { category: string }> = {};
    const demands: RecipeIngredientDemand[] = [];
    for (const meal of plan.meals) {
      for (const line of meal.recipe!.ingredients.filter((l) => !l.optional)) {
        ingredients[line.ingredientId] = { ...toConversion(line.ingredient), category: line.ingredient.category };
        demands.push({ recipeId: meal.recipe!.id, ingredientId: line.ingredientId, quantity: line.quantity, unit: line.unit as Unit, recipeServings: meal.recipe!.servings, mealServings: meal.servings });
      }
    }

    const list = plan.groceryList ?? (await this.prisma.groceryList.create({ data: { mealPlanId }, include: { items: true } }));
    const key = (ingredientId: string | null, unit: string) => `${ingredientId}|${unit}`;
    const existing = new Map(list.items.filter((i) => !i.isCustom).map((i) => [key(i.ingredientId, i.unit), i]));

    await this.prisma.$transaction(async (tx) => {
      for (const line of buildGroceryList(demands, ingredients, pantry)) {
        const values = { neededQuantity: line.neededQuantity, pantryCovered: line.pantryCovered, finalQuantity: line.finalQuantity, isNominal: line.isNominal };
        const item = existing.get(key(line.ingredientId, line.unit));
        existing.delete(key(line.ingredientId, line.unit));
        if (!item) {
          await tx.groceryListItem.create({
            data: { ...values, unit: line.unit as BaseUnit, category: ingredients[line.ingredientId]!.category, groceryListId: list.id, ingredientId: line.ingredientId },
          });
        } else if (item.neededQuantity !== values.neededQuantity || item.pantryCovered !== values.pantryCovered || item.isNominal !== values.isNominal) {
          // The plan or pantry changed, so an old quantity override no longer means anything.
          await tx.groceryListItem.update({ where: { id: item.id }, data: { ...values, userOverrideQuantity: null } });
        }
      }
      await tx.groceryListItem.deleteMany({ where: { id: { in: [...existing.values()].map((i) => i.id) } } });
    });

    const items = await this.prisma.groceryListItem.findMany({ where: { groceryListId: list.id }, include: { ingredient: true } });
    return { id: list.id, mealPlanId, items: items.map(toView) };
  }

  async updateItem(household: RequestHousehold, id: string, patch: ItemPatch) {
    const item = await this.findItem(household, id);
    const { buyAnyway, ...data } = patch;
    const override = buyAnyway ? { userOverrideQuantity: roundUpToPurchaseIncrement(item.neededQuantity + item.pantryCovered, item.unit), alreadyHave: false } : {};
    return toView(await this.prisma.groceryListItem.update({ where: { id }, data: { ...data, ...override }, include: { ingredient: true } }));
  }

  async addItem(household: RequestHousehold, groceryListId: string, name: string) {
    const list = await this.prisma.groceryList.findFirst({ where: { id: groceryListId, mealPlan: { householdId: household.householdId } } });
    if (!list) throw new NotFoundException("That list isn't in your household");
    const item = await this.prisma.groceryListItem.create({
      data: { groceryListId, customName: name.trim(), isCustom: true, category: "Other", unit: "piece", neededQuantity: 1, pantryCovered: 0, finalQuantity: 1 },
      include: { ingredient: true },
    });
    return toView(item);
  }

  /** Only your own additions; recipe items come from the plan, so "Already have" hides those. */
  async removeItem(household: RequestHousehold, id: string) {
    const item = await this.findItem(household, id);
    if (!item.isCustom) throw new BadRequestException("This comes from your meals — mark it Already have instead");
    await this.prisma.groceryListItem.delete({ where: { id } });
    return { deleted: true };
  }

  private async findItem(household: RequestHousehold, id: string) {
    const item = await this.prisma.groceryListItem.findFirst({ where: { id, groceryList: { mealPlan: { householdId: household.householdId } } } });
    if (!item) throw new NotFoundException("That item isn't on your list");
    return item;
  }

  /** All three strategies for what's left to buy, plus the week against the budget. */
  async optimize(household: RequestHousehold, groceryListId: string) {
    const { list, items, names } = await this.basket(household, groceryListId);
    const [{ products, productOptions, isDemo }, stores] = await Promise.all([
      this.pricing.load(items.map((i) => i.ingredientId)),
      this.groceryProvider.listStores(),
    ]);
    const candidatesByIngredient: Record<string, ProductOption[]> = {};
    for (const option of productOptions) (candidatesByIngredient[option.ingredientId] ??= []).push(option);
    // Households have no location yet, so every demo store counts as nearby (open-questions item 10).
    const storeDistances = stores.map((s) => ({ storeId: s.id, distanceKm: 0 }));
    const storeNames = new Map(stores.map((s) => [s.id, s.name]));
    const productNames = new Map(products.map((p) => [p.id, p.name]));

    const view = (result: OptimizationResult) => ({
      strategy: result.strategy,
      totalCents: result.totalCents,
      savingsCents: result.savingsCents,
      stores: result.storeBreakdown.map((b) => ({
        storeId: b.storeId,
        name: storeNames.get(b.storeId)!,
        subtotalCents: b.subtotalCents,
        items: b.items.map((p) => ({ ingredientId: p.ingredientId, name: names.get(p.ingredientId)!, product: productNames.get(p.productId)!, packs: p.packs, cents: p.cents })),
      })),
      unavailable: result.unavailableItemIds.map((id) => names.get(id)!),
      topSavingsDrivers: result.topSavingsDrivers.map((id) => names.get(id)!),
    });
    const [minCost, minStores, bestOverall] = STRATEGIES.map((strategy) => view(optimizeBasket({ strategy, items, candidatesByIngredient, storeDistances })));

    const budgetCents = list.mealPlan.household.weeklyBudgetCents;
    const plannedCents = bestOverall!.totalCents;
    const swaps = plannedCents > budgetCents ? await this.planMyWeek.suggestSwaps(household.householdId, list.mealPlanId) : [];
    return {
      isDemo,
      tripCostCents: DEFAULT_TRIP_COST_CENTS,
      minCost: minCost!,
      minStores: minStores!,
      bestOverall: bestOverall!,
      budget: { budgetCents, plannedCents, remainingCents: budgetCents - plannedCents, swaps },
    };
  }

  /** Deal Radar: only sales on things this week's list still needs. */
  async deals(household: RequestHousehold, groceryListId: string) {
    const { list, items, names } = await this.basket(household, groceryListId);
    const need = new Map(items.map((i) => [i.ingredientId, i.neededQuantity]));
    const [{ products, productOptions, isDemo }, stores, meals] = await Promise.all([
      this.pricing.load([...need.keys()]),
      this.groceryProvider.listStores(),
      this.prisma.meal.findMany({ where: { mealPlanId: list.mealPlanId, type: MealType.cook, recipeId: { not: null } }, include: { recipe: { include: { ingredients: true } } } }),
    ]);
    const deals = (await Promise.all(stores.map((s) => this.groceryProvider.getDeals(s.id)))).flat();
    const storeNames = new Map(stores.map((s) => [s.id, s.name]));

    const radar = await Promise.all(
      deals.map(async (deal) => {
        const product = products.find((p) => p.id === deal.productId);
        const price = product && (await this.groceryProvider.getPrice(product.id));
        if (!product || !price?.isSale || price.regularPriceCents === null) return [];
        const sale = cheapestForQuantity(productOptions.filter((o) => o.productId === product.id), need.get(product.ingredientId)!)!;
        const regularCents = sale.packsNeeded * price.regularPriceCents;
        return [{
          id: deal.id,
          item: names.get(product.ingredientId)!,
          product: product.name,
          store: storeNames.get(deal.storeId)!,
          discountPercent: deal.discountPercent,
          packs: sale.packsNeeded,
          regularCents,
          saleCents: sale.cents,
          savingsCents: regularCents - sale.cents,
          mealsUsing: meals.filter((m) => m.recipe!.ingredients.some((l) => l.ingredientId === product.ingredientId && !l.optional)).length,
        }];
      }),
    );
    return { isDemo, deals: radar.flat().sort((a, b) => b.savingsCents - a.savingsCents) };
  }

  /** What's still to buy, in base units. Uses the exact need, since packs do the rounding (open-questions item 14). */
  private async basket(household: RequestHousehold, groceryListId: string) {
    const owned = await this.prisma.groceryList.findFirst({ where: { id: groceryListId, mealPlan: { householdId: household.householdId } } });
    if (!owned) throw new NotFoundException("That list isn't in your household");
    await this.getForPlan(household, owned.mealPlanId); // catch up with plan and pantry changes first
    const list = await this.prisma.groceryList.findUniqueOrThrow({
      where: { id: groceryListId },
      include: { items: { include: { ingredient: true } }, mealPlan: { include: { household: true } } },
    });

    const toBuy = list.items.filter((i) => i.ingredient && !i.isNominal && !i.alreadyHave && (i.userOverrideQuantity ?? i.finalQuantity) > 0);
    const items: BasketItem[] = toBuy.map((i) => {
      const quantity = i.userOverrideQuantity ?? i.neededQuantity;
      const inBaseUnit = i.unit === i.ingredient!.baseUnit ? quantity : convertToBaseUnit({ value: quantity, unit: i.unit }, toConversion(i.ingredient!)).value;
      return { ingredientId: i.ingredientId!, neededQuantity: inBaseUnit };
    });
    return { list, items, names: new Map(toBuy.map((i) => [i.ingredientId!, i.ingredient!.name])) };
  }
}

function toView(item: GroceryListItem & { ingredient: Ingredient | null }) {
  return {
    id: item.id,
    name: item.customName ?? item.ingredient!.name,
    category: item.category,
    unit: item.unit,
    neededQuantity: item.neededQuantity,
    pantryCovered: item.pantryCovered,
    quantity: item.userOverrideQuantity ?? item.finalQuantity,
    isOverridden: item.userOverrideQuantity !== null,
    isNominal: item.isNominal,
    isCustom: item.isCustom,
    checked: item.checked,
    alreadyHave: item.alreadyHave,
  };
}
