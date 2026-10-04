import { Injectable, NotFoundException } from "@nestjs/common";
import type { PantryLocation, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service.js";
import { recipeConflicts } from "../../common/recipes.js";
import type { RequestHousehold } from "../../common/household-context.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const USE_SOON_DAYS = 3;

type ItemInput = { quantity?: number; location?: PantryLocation; expiresAt?: string | null };

@Injectable()
export class PantryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything on hand, plus Use It First: what expires soon and the recipes that use it. */
  async list(household: RequestHousehold) {
    const items = await this.prisma.pantryItem.findMany({
      where: { householdId: household.householdId },
      include: { ingredient: true },
      orderBy: { ingredient: { name: "asc" } },
    });

    const now = new Date();
    const soon = new Date(now.getTime() + USE_SOON_DAYS * DAY_MS);
    const expiring = items
      .filter((i) => i.expiresAt && i.expiresAt > now && i.expiresAt <= soon)
      .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());

    if (expiring.length === 0) return { items: items.map(toView), useItFirst: [] };

    const [recipes, preferences] = await Promise.all([
      this.prisma.recipe.findMany({
        where: { source: "seed", ingredients: { some: { ingredientId: { in: expiring.map((i) => i.ingredientId) }, optional: false } } },
        include: { ingredients: { include: { ingredient: true } } },
        orderBy: { title: "asc" },
      }),
      this.prisma.preference.findMany({ where: { OR: [{ householdId: household.householdId }, { member: { householdId: household.householdId } }] } }),
    ]);
    const safe = recipes.filter((r) => !recipeConflicts(r, preferences).blocked);
    const firstExpiring = expiring.filter((item, i) => expiring.findIndex((e) => e.ingredientId === item.ingredientId) === i);
    const useItFirst = firstExpiring.flatMap((item) => {
      const uses = safe.filter((r) => r.ingredients.some((l) => l.ingredientId === item.ingredientId && !l.optional));
      return uses.length === 0
        ? []
        : [{ ingredientId: item.ingredientId, name: item.ingredient.name, expiresAt: item.expiresAt, recipeCount: uses.length, recipes: uses.slice(0, 3).map((r) => ({ id: r.id, title: r.title })) }];
    });

    return { items: items.map(toView), useItFirst };
  }

  listIngredients() {
    return this.prisma.ingredient.findMany({
      select: { id: true, name: true, category: true, baseUnit: true, gramsPerPiece: true },
      orderBy: { name: "asc" },
    });
  }

  async addItem(household: RequestHousehold, input: ItemInput & { ingredientId: string; quantity: number; location: PantryLocation }) {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
    if (!ingredient) throw new NotFoundException("We don't know that ingredient");
    const item = await this.prisma.pantryItem.create({
      data: {
        householdId: household.householdId,
        ingredientId: ingredient.id,
        unit: ingredient.baseUnit,
        quantity: input.quantity,
        location: input.location,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      include: { ingredient: true },
    });
    return toView(item);
  }

  async updateItem(household: RequestHousehold, id: string, input: ItemInput) {
    await this.findItem(household, id);
    const { expiresAt, ...rest } = input;
    const item = await this.prisma.pantryItem.update({
      where: { id },
      data: { ...rest, ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}) },
      include: { ingredient: true },
    });
    return toView(item);
  }

  async removeItem(household: RequestHousehold, id: string) {
    await this.findItem(household, id);
    await this.prisma.pantryItem.delete({ where: { id } });
    return { deleted: true };
  }

  private async findItem(household: RequestHousehold, id: string) {
    const item = await this.prisma.pantryItem.findFirst({ where: { id, householdId: household.householdId } });
    if (!item) throw new NotFoundException("That item isn't in your pantry");
    return item;
  }
}

function toView(item: Prisma.PantryItemGetPayload<{ include: { ingredient: true } }>) {
  return {
    id: item.id,
    ingredientId: item.ingredientId,
    name: item.ingredient.name,
    category: item.ingredient.category,
    gramsPerPiece: item.ingredient.gramsPerPiece,
    quantity: item.quantity,
    unit: item.unit,
    location: item.location,
    expiresAt: item.expiresAt,
  };
}
