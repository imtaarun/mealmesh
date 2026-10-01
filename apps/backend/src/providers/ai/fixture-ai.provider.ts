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

  /** Deterministic stand-in for the AI's phrasing — restates the computed numbers it
   * was given, never adds any. */
  async explainPlan(input: PlanExplainRequest): Promise<string> {
    const { mealsCooked, sharedIngredients, expiringItemsUsed } = input.planSummary as {
      mealsCooked: number;
      sharedIngredients: number;
      expiringItemsUsed: string[];
    };
    const items = expiringItemsUsed.length > 1
      ? `${expiringItemsUsed.slice(0, -1).join(", ")} and ${expiringItemsUsed[expiringItemsUsed.length - 1]}`
      : expiringItemsUsed[0];
    const expiring = items ? `, and they use up the ${items} before ${expiringItemsUsed.length > 1 ? "they expire" : "it expires"}` : "";
    return `${mealsCooked} meals share ${sharedIngredients} ingredients${expiring}.`;
  }

  async parseReceipt(_input: ReceiptRequest): Promise<ParsedReceipt> {
    return { storeGuess: null, items: [] };
  }

  async classifyIngredient(_name: string): Promise<IngredientClassification> {
    return { category: "Other", baseUnit: "g" };
  }
}
