import { describe, expect, it } from "vitest";
import { checkRecipeConflicts } from "../src/conflicts/index.js";
import type { RecipeIngredientName } from "../src/types.js";

const peanutButter: RecipeIngredientName = { ingredientId: "peanut-butter", name: "Peanut Butter", aliases: [] };
const mushroom: RecipeIngredientName = { ingredientId: "mushroom", name: "Cremini Mushroom", aliases: ["button mushroom"] };
const chickenBreast: RecipeIngredientName = { ingredientId: "chicken-breast", name: "Boneless Chicken Breast", aliases: ["chicken breast"] };

describe("checkRecipeConflicts", () => {
  it("blocks when an ingredient matches an allergy", () => {
    const result = checkRecipeConflicts({
      ingredients: [peanutButter, chickenBreast],
      allergyValues: ["peanut"],
      dislikeValues: [],
    });
    expect(result.blocked).toBe(true);
    expect(result.blockedMatches).toEqual([{ ingredientId: "peanut-butter", preferenceValue: "peanut" }]);
  });

  it("warns without blocking when an ingredient matches a dislike", () => {
    const result = checkRecipeConflicts({
      ingredients: [mushroom, chickenBreast],
      allergyValues: [],
      dislikeValues: ["mushroom"],
    });
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.ingredientId).toBe("mushroom");
  });

  it("matches against aliases, not just the canonical name", () => {
    const result = checkRecipeConflicts({
      ingredients: [mushroom],
      allergyValues: [],
      dislikeValues: ["button mushroom"],
    });
    expect(result.warnings).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    const result = checkRecipeConflicts({
      ingredients: [peanutButter],
      allergyValues: ["PEANUT"],
      dislikeValues: [],
    });
    expect(result.blocked).toBe(true);
  });

  it("finds nothing when there is no overlap", () => {
    const result = checkRecipeConflicts({
      ingredients: [chickenBreast],
      allergyValues: ["shellfish"],
      dislikeValues: ["cilantro"],
    });
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });
});
