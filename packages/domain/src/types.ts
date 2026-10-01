// Money is integer cents; quantities are in the ingredient's base unit.

export type MassUnit = "g" | "kg" | "oz" | "lb";
export type VolumeUnit = "ml" | "l" | "tsp" | "tbsp" | "cup";
export type CountUnit = "piece" | "clove" | "bunch" | "can";
export type NominalUnit = "pinch" | "to_taste" | "handful";

export type Unit = MassUnit | VolumeUnit | CountUnit | NominalUnit;
export type BaseUnit = "g" | "ml" | "piece";

export interface Quantity {
  value: number;
  unit: Unit;
}

export interface IngredientConversion {
  id: string;
  baseUnit: BaseUnit;
  gramsPerPiece?: number;
  gramsPerCup?: number;
  density?: number; // g/ml
  shelfLifeDays?: number;
}

export interface ConvertedQuantity {
  ingredientId: string;
  value: number;
  /** the ingredient's baseUnit on success; the original unit, unchanged, when needsReview */
  unit: Unit;
  /** true when conversion data was missing and the amount could not be normalized */
  needsReview: boolean;
  /** true for vague units (pinch, to taste, handful) that never affect cost/optimization */
  isNominal: boolean;
}

export interface RecipeIngredientDemand {
  recipeId: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  recipeServings: number;
  mealServings: number;
}

export interface AggregatedDemand {
  ingredientId: string;
  totalQuantity: number;
  /** the ingredient's baseUnit on success; an original unit, unchanged, when needsReview */
  unit: Unit;
  needsReview: boolean;
  isNominal: boolean;
}

export interface GroceryLineItem {
  ingredientId: string;
  neededQuantity: number;
  pantryCovered: number;
  finalQuantity: number;
  unit: Unit;
  needsReview: boolean;
  isNominal: boolean;
}

export interface ProductOption {
  productId: string;
  storeId: string;
  ingredientId: string;
  priceCents: number;
  packSize: number;
  packUnit: BaseUnit;
}

export interface CostedLine {
  ingredientId: string;
  productId: string;
  packsNeeded: number;
  spendCents: number;
  consumedValueCents: number;
}

export type OptimizationStrategy = "min_cost" | "min_stores" | "best_overall";

export interface StoreDistance {
  storeId: string;
  distanceKm: number;
}

export interface OptimizationResult {
  strategy: OptimizationStrategy;
  totalCents: number;
  storeBreakdown: Array<{ storeId: string; subtotalCents: number; itemIds: string[] }>;
  unavailableItemIds: string[];
  savingsCents: number;
  topSavingsDrivers: string[]; // ingredientIds, ranked
}

export interface MealPlanScoreInput {
  budgetCents: number;
  ingredientUsageCounts: Record<string, number>; // ingredientId -> meals using it
  ingredientCostCents: Record<string, number>;
  consumedValueCents: number;
  spendCents: number;
  expiringItemsUsed: number;
  expiringItemsTotal: number;
  totalActiveCookMinutes: number;
  mealCount: number;
  preferredMaxCookMinutes: number;
  busyDayCount: number;
  distinctProteins: number;
  distinctCuisines: number;
  distinctCookingMethods?: number; // omitted until recipes carry a cooking method
}

export interface MealPlanScore {
  total: number;
  budget: number;
  ingredientEfficiency: number;
  wasteReduction: number;
  convenience: number;
  variety: number;
}

export interface RecipeIngredientName {
  ingredientId: string;
  name: string;
  aliases: string[];
}

export interface ConflictCheckInput {
  ingredients: RecipeIngredientName[];
  allergyValues: string[]; // Preference.value where type = 'allergy'
  dislikeValues: string[]; // Preference.value where type = 'dislike'
}

export interface ConflictMatch {
  ingredientId: string;
  preferenceValue: string;
}

export interface ConflictCheckResult {
  /** true when an allergy matched — the recipe must not be addable to the plan */
  blocked: boolean;
  blockedMatches: ConflictMatch[];
  /** dislike matches — surfaced as a dismissible warning, never blocking */
  warnings: ConflictMatch[];
}
