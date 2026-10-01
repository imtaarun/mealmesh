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

/** Canned responses for tests and offline dev. */
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

  /** Restates the numbers it's given; never adds any. */
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
