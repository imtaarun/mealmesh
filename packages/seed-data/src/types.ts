// Shapes for the raw JSON files in this package. Deliberately independent of the
// Prisma-generated types in apps/backend — this package has no dependency on Prisma,
// so it stays usable from anywhere (seed script, tests, mobile fixtures, tooling).

import type { BaseUnit, Unit } from "@mealmesh/domain";

export interface Taxonomies {
  cuisines: string[];
  dietTags: string[];
  allergens: string[];
  skillLevels: string[];
  mealSlots: string[];
  difficulty: string[];
  shoppingCategories: string[];
  pantryLocations: string[];
  units: {
    mass: string[];
    volume: string[];
    count: string[];
    nominal: string[];
  };
}

export interface SeedIngredient {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  baseUnit: BaseUnit;
  gramsPerPiece?: number;
  gramsPerCup?: number;
  density?: number;
  shelfLifeDays?: number;
  isStaple: boolean;
}

export interface SeedRecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  note?: string;
  optional?: boolean;
}

export interface SeedRecipeInstruction {
  step: number;
  text: string;
  timerSeconds?: number;
}

export interface SeedRecipe {
  id: string;
  title: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  cuisines: string[];
  dietTags: string[];
  ingredients: SeedRecipeIngredient[];
  instructions: SeedRecipeInstruction[];
}
