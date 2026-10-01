// AI never returns prices, costs, or totals.

export interface CandidateRequest {
  householdId: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  constraints: Record<string, unknown>;
}

export interface RecipeCandidate {
  title: string;
  cuisines: string[];
  dietTags: string[];
  prepMinutes: number;
  cookMinutes: number;
}

export interface RecipeRequest {
  title: string;
  servings: number;
  constraints: Record<string, unknown>;
}

export interface Recipe {
  title: string;
  servings: number;
  instructions: Array<{ step: number; text: string; timerSeconds?: number }>;
  ingredients: Array<{ ingredientName: string; quantity: number; unit: string; note?: string }>;
}

export interface SubstitutionRequest {
  ingredientName: string;
  recipeContext: string;
}

export interface Substitution {
  ingredientName: string;
  tradeoff: string;
}

export interface PlanExplainRequest {
  computedScore: Record<string, number>;
  planSummary: Record<string, unknown>;
}

export interface ReceiptRequest {
  imageUrl: string;
}

export interface ParsedReceipt {
  storeGuess: string | null;
  items: Array<{ rawText: string; quantity?: number; priceCents?: number }>;
}

export interface IngredientClassification {
  category: string;
  baseUnit: "g" | "ml" | "piece";
}

export const AI_PROVIDER = Symbol("AI_PROVIDER");

export interface AIProvider {
  proposeMealCandidates(input: CandidateRequest): Promise<RecipeCandidate[]>;
  generateRecipe(input: RecipeRequest): Promise<Recipe>;
  suggestSubstitutions(input: SubstitutionRequest): Promise<Substitution[]>;
  explainPlan(input: PlanExplainRequest): Promise<string>;
  parseReceipt(input: ReceiptRequest): Promise<ParsedReceipt>;
  classifyIngredient(name: string): Promise<IngredientClassification>;
}
