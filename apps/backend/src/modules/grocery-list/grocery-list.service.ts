import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MealType, type BaseUnit, type GroceryListItem, type Ingredient } from "@prisma/client";
import { buildGroceryList, roundUpToPurchaseIncrement, type IngredientConversion, type RecipeIngredientDemand, type Unit } from "@mealmesh/domain";
import { PrismaService } from "../../common/prisma.service.js";
import { toConversion } from "../../common/recipes.js";
import { GROCERY_PROVIDER, type GroceryProvider } from "../../providers/grocery/grocery-provider.interface.js";
import type { RequestHousehold } from "../../common/household-context.js";

type ItemPatch = { checked?: boolean; alreadyHave?: boolean; userOverrideQuantity?: number | null; buyAnyway?: boolean };

/** Grocery list (Phase 6); basket optimization and deals (Phase 7). */
@Injectable()
export class GroceryListService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GROCERY_PROVIDER) private readonly groceryProvider: GroceryProvider,
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

  async optimize(_household: RequestHousehold, _groceryListId: string, _strategy: string): Promise<never> {
    throw new Error("GroceryListService.optimize: not yet implemented — Phase 7");
  }

  async listStores(): Promise<never> {
    throw new Error("GroceryListService.listStores: not yet implemented — Phase 7");
  }

  async getDeals(_household: RequestHousehold, _mealPlanId: string): Promise<never> {
    throw new Error("GroceryListService.getDeals: not yet implemented — Phase 7");
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
