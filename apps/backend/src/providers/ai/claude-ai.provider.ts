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
 * Real provider, backed by the Claude API. Every method must: call the model, validate
 * the response against a zod schema, retry once on validation failure, then fall back
 * to deterministic behaviour (never a guess) — see docs/architecture.md "AIProvider".
 * TODO(Phase 4+): implement per-method as each feature needs it; do not implement all
 * six up front against no real usage.
 */
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
