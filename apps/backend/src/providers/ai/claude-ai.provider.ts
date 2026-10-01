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

/** TODO: per method, validate with zod, retry once, then fall back deterministically. */
@Injectable()
export class ClaudeAiProvider implements AIProvider {
  async proposeMealCandidates(_input: CandidateRequest): Promise<RecipeCandidate[]> {
    throw new Error("ClaudeAiProvider.proposeMealCandidates: not yet implemented");
  }

  async generateRecipe(_input: RecipeRequest): Promise<Recipe> {
    throw new Error("ClaudeAiProvider.generateRecipe: not yet implemented");
  }

  async suggestSubstitutions(_input: SubstitutionRequest): Promise<Substitution[]> {
    throw new Error("ClaudeAiProvider.suggestSubstitutions: not yet implemented");
  }

  async explainPlan(_input: PlanExplainRequest): Promise<string> {
    throw new Error("ClaudeAiProvider.explainPlan: not yet implemented");
  }

  async parseReceipt(_input: ReceiptRequest): Promise<ParsedReceipt> {
    throw new Error("ClaudeAiProvider.parseReceipt: not yet implemented");
  }

  async classifyIngredient(_name: string): Promise<IngredientClassification> {
    throw new Error("ClaudeAiProvider.classifyIngredient: not yet implemented");
  }
}
