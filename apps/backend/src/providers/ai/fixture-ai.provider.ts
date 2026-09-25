import { Injectable } from "@nestjs/common";
import type {
  AIProvider,
  CandidateRequest,
  IngredientClassification,
  ParsedReceipt,
  PlanExplainRequest,
  Recipe,
  RecipeCandidate,
  RecipeRequest,
  ReceiptRequest,
  Substitution,
  SubstitutionRequest,
} from "./ai-provider.interface.js";

/**
 * Returns canned data so tests and offline dev never hit the network. See
 * docs/architecture.md "AIProvider". Used when AI_PROVIDER=fixture (the default
 * outside production).
 */
@Injectable()
export class FixtureAiProvider implements AIProvider {
  async proposeMealCandidates(_input: CandidateRequest): Promise<RecipeCandidate[]> {
    return [];
  }

  async generateRecipe(input: RecipeRequest): Promise<Recipe> {
    return { title: input.title, servings: input.servings, instructions: [], ingredients: [] };
  }

  async suggestSubstitutions(_input: SubstitutionRequest): Promise<Substitution[]> {
    return [];
  }

  async explainPlan(_input: PlanExplainRequest): Promise<string> {
    return "This is a fixture explanation — replace with ClaudeAIProvider for real output.";
  }

  async parseReceipt(_input: ReceiptRequest): Promise<ParsedReceipt> {
    return { storeGuess: null, items: [] };
  }

  async classifyIngredient(_name: string): Promise<IngredientClassification> {
    return { category: "Other", baseUnit: "g" };
  }
}
