// Independent of Prisma, so this package works anywhere.

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
  proteinGroup?: string; // e.g. "chicken" for every chicken cut — what Plan My Week varies
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
  mealSlots: Array<"breakfast" | "lunch" | "dinner" | "snack">;
  ingredients: SeedRecipeIngredient[];
  instructions: SeedRecipeInstruction[];
}

export interface SeedReferencePrice {
  ingredientId: string;
  productName: string;
  packSize: number; // in the ingredient's baseUnit
  priceCents: number; // regular shelf price at a mainstream supermarket
}

export interface SeedStore {
  id: string;
  name: string;
  chain: string;
  address: string;
  lat: number;
  lng: number;
  houseBrand: string | null;
  priceFactor: number; // multiplier on the reference price
  priceVariance: number; // max per-product deviation from priceFactor, e.g. 0.1 = ±10%
  onlyIngredientIds?: string[]; // specialty store: carries just these
  excludedIngredientIds?: string[]; // full-line store: carries everything except these
  deals: Array<{ ingredientId: string; discountPercent: number }>;
}

export interface SeedDemoHousehold {
  email: string;
  password: string;
  householdName: string;
  weeklyBudgetCents: number;
  budgetTier: "budget" | "balanced" | "premium";
  subscriptionTier: "free" | "pro";
  defaultServings: number;
  timezone: string;
  preferences: Array<{ type: string; value: string }>;
  pantry: Array<{ ingredientId: string; quantity: number; location: "pantry" | "fridge" | "freezer"; expiresInDays?: number }>;
}
