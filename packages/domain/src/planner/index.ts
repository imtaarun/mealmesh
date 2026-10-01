// Plan My Week selection — docs/architecture.md "Meal plan generation", step 3 and 4.
// Greedy fill, one dinner per day in date order: every candidate is scored against the
// dinners already chosen, the best one wins (ties → higher pantry coverage, then id, so
// the same inputs always give the same week). Then leftovers: with leftover tolerance
// on, each dinner cooks double and the next day's lunch eats the rest.
// Hard constraints (slot, required diets, max cook time, recent meals) filter before
// scoring; allergies are filtered by the caller with checkRecipeConflicts.

export interface PlannerRecipe {
  id: string;
  servings: number;
  totalMinutes: number; // prep + cook
  cuisines: string[];
  dietTags: string[];
  mealSlots: string[];
  ingredients: Array<{ ingredientId: string; quantity: number; proteinGroup: string | null; isStaple: boolean }>; // quantity in base unit, for `servings`
  dislikeMatches: number; // soft conflicts from checkRecipeConflicts
}

export interface PlannerDay {
  date: string; // YYYY-MM-DD
  busy: boolean;
  eatOut: boolean;
}

export interface PlanWeekInput {
  recipes: PlannerRecipe[];
  days: PlannerDay[];
  servings: number;
  maxCookMinutes: number | null;
  requiredDietTags: string[]; // restrictions — every one must be on the recipe
  goalDietTags: string[]; // goals like "healthy" — a bonus, not a filter
  likedCuisines: string[];
  leftovers: boolean;
  pantry: Record<string, number>; // ingredientId → quantity on hand, base unit
  expiringIngredientIds: string[];
  dealIngredientIds: string[];
  unitPriceCents: Record<string, number>; // cheapest current price per base unit
  avoidRecipeIds: string[]; // eaten recently
}

export interface PlannedMeal {
  date: string;
  slot: "lunch" | "dinner";
  type: "cook" | "leftover" | "eat_out";
  recipeId: string | null;
  servings: number;
}

/** Busy days get dishes at or under this many minutes without a penalty. */
export const BUSY_DAY_MINUTES = 20;

/** The dish's main protein — the group of its first protein ingredient ("chicken" for
 * thighs and breast alike, "legumes" for chickpeas), or "none". */
export function mainProtein(recipe: PlannerRecipe): string {
  return recipe.ingredients.find((i) => i.proteinGroup !== null)?.proteinGroup ?? "none";
}

export function costPerServingCents(recipe: PlannerRecipe, unitPriceCents: Record<string, number>): number {
  const total = recipe.ingredients.reduce((sum, i) => sum + i.quantity * (unitPriceCents[i.ingredientId] ?? 0), 0);
  return total / recipe.servings;
}

/** Recipes allowed in this slot at all — before any scoring. */
export function eligibleRecipes(input: PlanWeekInput, slot: "lunch" | "dinner"): PlannerRecipe[] {
  return input.recipes.filter(
    (r) =>
      r.mealSlots.includes(slot) &&
      input.requiredDietTags.every((tag) => r.dietTags.includes(tag)) &&
      (input.maxCookMinutes === null || r.totalMinutes <= input.maxCookMinutes) &&
      !input.avoidRecipeIds.includes(r.id),
  );
}

interface Scored {
  recipe: PlannerRecipe;
  score: number;
  pantryCoverage: number;
}

function scoreCandidate(recipe: PlannerRecipe, chosen: PlannerRecipe[], day: PlannerDay, previous: PlannerRecipe | null, input: PlanWeekInput): Scored {
  const chosenIngredients = new Set(chosen.flatMap((r) => r.ingredients.filter((i) => !i.isStaple).map((i) => i.ingredientId)));
  const fresh = recipe.ingredients.filter((i) => !i.isStaple);
  const overlap = fresh.length === 0 ? 0 : fresh.filter((i) => chosenIngredients.has(i.ingredientId)).length / fresh.length;
  const pantryCoverage = recipe.ingredients.filter((i) => (input.pantry[i.ingredientId] ?? 0) > 0).length / recipe.ingredients.length;
  const expiringUsed = recipe.ingredients.filter(
    (i) => input.expiringIngredientIds.includes(i.ingredientId) && !chosenIngredients.has(i.ingredientId),
  ).length;
  const dealsUsed = Math.min(3, recipe.ingredients.filter((i) => input.dealIngredientIds.includes(i.ingredientId)).length);
  const protein = mainProtein(recipe);
  const proteinRepeats = chosen.filter((r) => mainProtein(r) === protein).length;
  const sameCuisineAsYesterday = previous !== null && previous.cuisines[0] === recipe.cuisines[0];
  const likedCuisine = recipe.cuisines.some((c) => input.likedCuisines.includes(c));
  const goalsMet = input.goalDietTags.filter((t) => recipe.dietTags.includes(t)).length;
  const busyOverrun = day.busy ? Math.max(0, recipe.totalMinutes - BUSY_DAY_MINUTES) : 0;
  const dollarsPerServing = costPerServingCents(recipe, input.unitPriceCents) / 100;

  const score =
    30 * overlap +
    15 * pantryCoverage +
    10 * expiringUsed +
    4 * dealsUsed +
    8 * (likedCuisine ? 1 : 0) +
    15 * goalsMet -
    12 * proteinRepeats -
    6 * (sameCuisineAsYesterday ? 1 : 0) -
    0.8 * busyOverrun -
    2 * dollarsPerServing -
    40 * recipe.dislikeMatches;

  return { recipe, score, pantryCoverage };
}

function best(scored: Scored[]): PlannerRecipe | null {
  const sorted = [...scored].sort(
    (a, b) => b.score - a.score || b.pantryCoverage - a.pantryCoverage || a.recipe.id.localeCompare(b.recipe.id),
  );
  return sorted[0]?.recipe ?? null;
}

/**
 * Best dinner for `day` given the dinners already chosen for the rest of the week.
 * Used for each day of planWeek and on its own to regenerate a single meal. Repeats a
 * dish only when every eligible recipe is already in the week.
 */
export function pickDinner(input: PlanWeekInput, day: PlannerDay, chosen: PlannerRecipe[], previous: PlannerRecipe | null, excludeRecipeIds: string[] = []): PlannerRecipe | null {
  const pool = eligibleRecipes(input, "dinner").filter((r) => !excludeRecipeIds.includes(r.id));
  const unused = pool.filter((r) => !chosen.some((c) => c.id === r.id));
  const candidates = unused.length > 0 ? unused : pool;
  return best(candidates.map((r) => scoreCandidate(r, chosen, day, previous, input)));
}

export function planWeek(input: PlanWeekInput): PlannedMeal[] {
  const dinners: Array<PlannerRecipe | null> = [];
  const chosen: PlannerRecipe[] = [];

  for (const day of input.days) {
    const recipe = day.eatOut ? null : pickDinner(input, day, chosen, chosen[chosen.length - 1] ?? null);
    dinners.push(recipe);
    if (recipe) chosen.push(recipe);
  }

  const meals: PlannedMeal[] = [];
  input.days.forEach((day, i) => {
    const yesterday = i > 0 ? dinners[i - 1] : null;
    if (input.leftovers && yesterday) {
      meals.push({ date: day.date, slot: "lunch", type: "leftover", recipeId: yesterday.id, servings: input.servings });
    }
    const recipe = dinners[i];
    const cooksForTomorrow = input.leftovers && i < input.days.length - 1;
    meals.push(
      recipe
        ? { date: day.date, slot: "dinner", type: "cook", recipeId: recipe.id, servings: input.servings * (cooksForTomorrow ? 2 : 1) }
        : { date: day.date, slot: "dinner", type: "eat_out", recipeId: null, servings: input.servings },
    );
  });
  return meals;
}
