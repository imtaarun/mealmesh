// Typed calls against apps/backend's API surface (docs/architecture.md). Response
// shapes are hand-mirrored from the Prisma models the backend returns — kept minimal
// (only the fields screens actually use), not a full duplicate of the schema.

import { apiClient } from "./api-client";

export interface AuthResult {
  token: string;
  userId: string;
  householdId: string;
}

export interface SignupInput {
  email: string;
  password: string;
  householdName: string;
  defaultServings?: number;
}

export interface OnboardingInput {
  weeklyBudgetCents?: number;
  budgetTier?: "budget" | "balanced" | "premium";
  cuisineLikes: string[];
  dislikes: string[];
  allergies: string[];
  diets: string[];
  skill?: string;
  maxCookMinutes?: number;
  leftoverTolerance?: boolean;
  busyDays: string[];
  eatOutDays: string[];
}

export interface RecipeInstruction {
  step: number;
  text: string;
  timerSeconds?: number;
}

export interface Recipe {
  id: string;
  title: string;
  imageUrl: string | null;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  cuisines: string[];
  dietTags: string[];
  instructions: RecipeInstruction[];
  source: "seed" | "ai" | "user";
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealType = "cook" | "leftover" | "eat_out" | "skip";

export interface Meal {
  id: string;
  date: string;
  slot: MealSlot;
  servings: number;
  type: MealType;
  recipeId: string | null;
  recipe?: Recipe | null;
}

export interface MealPlan {
  id: string;
  weekStartDate: string;
  status: string;
  meals: Meal[];
}

export interface ConflictMatch {
  ingredientId: string;
  preferenceValue: string;
}

export interface UpdateMealResult {
  conflict: { blocked: boolean; blockedMatches: ConflictMatch[]; warnings: ConflictMatch[] } | null;
  meal: Meal | null;
}

export const api = {
  signup: (input: SignupInput) => apiClient.post<AuthResult>("/api/auth/signup", input),
  login: (email: string, password: string) => apiClient.post<AuthResult>("/api/auth/login", { email, password }),
  onboard: (input: OnboardingInput) => apiClient.post("/api/onboarding", input),

  listRecipes: (filters: { cuisine?: string; dietTag?: string; query?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.cuisine) params.set("cuisine", filters.cuisine);
    if (filters.dietTag) params.set("dietTag", filters.dietTag);
    if (filters.query) params.set("query", filters.query);
    const qs = params.toString();
    return apiClient.get<Recipe[]>(`/api/recipes${qs ? `?${qs}` : ""}`);
  },

  getCurrentPlan: () => apiClient.get<MealPlan | null>("/api/meal-plans/current"),
  createEmptyWeek: (weekStartDate: string) => apiClient.post<MealPlan>("/api/meal-plans", { weekStartDate }),

  setMealSlot: (mealPlanId: string, mealId: string, recipeId: string, acknowledgeWarnings = false) =>
    apiClient.patch<UpdateMealResult>(`/api/meal-plans/${mealPlanId}/meals/${mealId}`, {
      action: "replace",
      recipeId,
      acknowledgeWarnings,
    }),

  skipMealSlot: (mealPlanId: string, mealId: string) =>
    apiClient.patch<Meal>(`/api/meal-plans/${mealPlanId}/meals/${mealId}`, { action: "skip" }),
};
