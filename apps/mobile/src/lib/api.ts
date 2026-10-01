// Response types list only the fields screens use.

import { apiClient } from "./api-client";

export interface AuthResult {
  token: string;
  userId: string;
  householdId: string;
  needsProfile: boolean;
}

export interface SignupInput {
  email: string;
  password: string;
  inviteCode?: string;
}

export interface OAuthInput {
  provider: "google" | "apple";
  idToken: string;
  name?: string;
  inviteCode?: string;
}

export interface Me {
  user: { id: string; email: string; createdAt: string; signInMethods: string[] };
  member: { id: string; name: string; role: "owner" | "member"; costShare: number; allergies: string[]; dislikes: string[] };
  household: {
    id: string;
    name: string;
    subscriptionTier: "free" | "pro";
    weeklyBudgetCents: number;
    budgetTier: "budget" | "balanced" | "premium";
    defaultServings: number;
    preferences: Array<{ type: string; value: string }>;
  };
  needsProfile: boolean;
}

export interface Housemate {
  id: string;
  name: string;
  email: string | null;
  role: "owner" | "member";
  costShare: number;
  isYou: boolean;
  weekShareCents: number | null;
}

export interface Members {
  weekStartDate: string | null;
  weekEstimateCents: number | null;
  members: Housemate[];
}

export interface History {
  totals: { weeksPlanned: number; mealsCooked: number; estimatedSpendCents: number; averageScore: number | null };
  favourites: Array<{ title: string; times: number }>;
  weeks: Array<{
    mealPlanId: string;
    weekStartDate: string;
    mealsCooked: number;
    leftoverMeals: number;
    estimatedCostCents: number | null;
    score: number | null;
    dishes: string[];
  }>;
}

export interface OnboardingInput {
  householdName?: string;
  defaultServings?: number;
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

export interface RecipeDetail extends Recipe {
  ingredients: Array<{
    id: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    note: string | null;
    optional: boolean;
    ingredient: { id: string; name: string };
  }>;
  /** Consumed value of one serving at the cheapest current prices; null if something has no price. */
  costPerServingCents: number | null;
  /** True when prices are estimates — show EstimatedPricingBadge (CLAUDE.md rule 2). */
  estimatedPricing: boolean;
  pantryIngredientIds: string[];
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

export interface MealPlanScore {
  total: number;
  explanation: string;
}

export interface MealPlan {
  id: string;
  weekStartDate: string;
  status: string;
  estimatedCostCents: number | null;
  meals: Meal[];
  score?: MealPlanScore | null;
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
  oauth: (input: OAuthInput) => apiClient.post<AuthResult>("/api/auth/oauth", input),
  onboard: (input: OnboardingInput) => apiClient.post("/api/onboarding", input),

  getMe: () => apiClient.get<Me>("/api/me"),
  saveProfile: (input: { name: string; allergies?: string[]; dislikes?: string[] }) => apiClient.put<Me>("/api/me/profile", input),
  getHistory: () => apiClient.get<History>("/api/me/history"),
  /** Everything stored about you, as JSON — the app hands it to the share sheet. */
  exportMyData: () => apiClient.get<unknown>("/api/me/data"),
  deleteAccount: () => apiClient.delete<{ deleted: true }>("/api/me"),
  joinHousehold: (code: string) => apiClient.post("/api/me/join", { code, replaceMyHousehold: true }),

  getMembers: () => apiClient.get<Members>("/api/households/current/members"),
  createInvite: () => apiClient.post<{ code: string; expiresAt: string }>("/api/households/current/invites"),
  setCostShare: (memberId: string, costShare: number) =>
    apiClient.patch<Members>(`/api/households/current/members/${memberId}`, { costShare }),
  removeHousemate: (memberId: string) => apiClient.delete<Members>(`/api/households/current/members/${memberId}`),
  leaveHousehold: () => apiClient.post("/api/households/current/leave"),

  listRecipes: (filters: { cuisine?: string; dietTag?: string; query?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.cuisine) params.set("cuisine", filters.cuisine);
    if (filters.dietTag) params.set("dietTag", filters.dietTag);
    if (filters.query) params.set("query", filters.query);
    const qs = params.toString();
    return apiClient.get<Recipe[]>(`/api/recipes${qs ? `?${qs}` : ""}`);
  },

  getRecipe: (id: string) => apiClient.get<RecipeDetail>(`/api/recipes/${id}`),

  /** The latest planned week, or with a date (YYYY-MM-DD) the week that contains it. */
  getCurrentPlan: (date?: string) => apiClient.get<MealPlan | null>(`/api/meal-plans/current${date ? `?date=${date}` : ""}`),
  createEmptyWeek: (weekStartDate: string) => apiClient.post<MealPlan>("/api/meal-plans", { weekStartDate }),
  /** Plan My Week — Pro only; the backend answers 403 for Free households. */
  planMyWeek: (weekStartDate: string) => apiClient.post<MealPlan>("/api/meal-plans/generate", { weekStartDate }),
  regenerateDinner: (mealPlanId: string, mealId: string) =>
    apiClient.post<MealPlan>(`/api/meal-plans/${mealPlanId}/meals/${mealId}/regenerate`),

  setMealSlot: (mealPlanId: string, mealId: string, recipeId: string, acknowledgeWarnings = false) =>
    apiClient.patch<UpdateMealResult>(`/api/meal-plans/${mealPlanId}/meals/${mealId}`, {
      action: "replace",
      recipeId,
      acknowledgeWarnings,
    }),

  skipMealSlot: (mealPlanId: string, mealId: string) =>
    apiClient.patch<Meal>(`/api/meal-plans/${mealPlanId}/meals/${mealId}`, { action: "skip" }),
};
