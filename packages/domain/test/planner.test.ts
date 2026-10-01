import { describe, expect, it } from "vitest";
import { pickDinner, planWeek, type PlannerDay, type PlannerRecipe, type PlanWeekInput } from "../src/planner/index.js";

function recipe(id: string, overrides: Partial<PlannerRecipe> & { uses?: string[] } = {}): PlannerRecipe {
  const { uses = ["onion", "tomato", "garlic"], ...rest } = overrides;
  return {
    id,
    servings: 4,
    totalMinutes: 30,
    cuisines: ["indian"],
    dietTags: [],
    mealSlots: ["lunch", "dinner"],
    ingredients: uses.map((ingredientId) => ({
      ingredientId,
      quantity: 100,
      proteinGroup: ingredientId.startsWith("meat:") ? ingredientId.slice("meat:".length) : null,
      isStaple: false,
    })),
    dislikeMatches: 0,
    ...rest,
  };
}

const WEEK: PlannerDay[] = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"].map(
  (date) => ({ date, busy: false, eatOut: false }),
);
const MONDAY = WEEK[0]!;

function input(recipes: PlannerRecipe[], overrides: Partial<PlanWeekInput> = {}): PlanWeekInput {
  return {
    recipes,
    days: WEEK,
    servings: 2,
    maxCookMinutes: null,
    requiredDietTags: [],
    goalDietTags: [],
    likedCuisines: [],
    leftovers: false,
    pantry: {},
    expiringIngredientIds: [],
    dealIngredientIds: [],
    unitPriceCents: {},
    avoidRecipeIds: [],
    ...overrides,
  };
}

const dinners = (meals: ReturnType<typeof planWeek>) => meals.filter((m) => m.slot === "dinner").map((m) => m.recipeId);

describe("planWeek — hard constraints", () => {
  it("never puts a breakfast-only dish, a non-matching diet, a too-slow dish, or a recent meal on the week", () => {
    const allowed = Array.from({ length: 7 }, (_, i) => recipe(`ok-${i}`, { dietTags: ["vegetarian"], uses: ["x"] }));
    const banned = [
      recipe("pancakes", { mealSlots: ["breakfast"], dietTags: ["vegetarian"] }),
      recipe("chicken", { dietTags: [] }),
      recipe("slow", { dietTags: ["vegetarian"], totalMinutes: 90 }),
      recipe("recent", { dietTags: ["vegetarian"] }),
    ];
    const meals = planWeek(input([...banned, ...allowed], { requiredDietTags: ["vegetarian"], maxCookMinutes: 35, avoidRecipeIds: ["recent"] }));
    expect(dinners(meals).sort()).toEqual(allowed.map((r) => r.id).sort());
  });

  it("doesn't repeat a dish while unused ones remain, and repeats only when the pool runs out", () => {
    const three = [recipe("a"), recipe("b"), recipe("c")];
    const ids = dinners(planWeek(input(three)));
    expect(new Set(ids.slice(0, 3)).size).toBe(3);
    expect(ids).toHaveLength(7);
    expect(ids.every((id) => id !== null)).toBe(true);
  });

  it("is deterministic", () => {
    const pool = Array.from({ length: 10 }, (_, i) => recipe(`r${i}`, { uses: [`i${i % 3}`] }));
    expect(planWeek(input(pool))).toEqual(planWeek(input(pool)));
  });
});

describe("pickDinner — what it prefers", () => {
  it("reuses ingredients already bought for the week", () => {
    const chosen = [recipe("chana", { uses: ["spinach", "cilantro", "tomato"] })];
    const shares = recipe("saag", { uses: ["spinach", "cilantro", "paneer"] });
    const sharesNothing = recipe("tacos", { uses: ["beef", "tortilla", "lime"] });
    expect(pickDinner(input([sharesNothing, shares]), MONDAY, chosen, null)?.id).toBe("saag");
  });

  it("uses up what's about to expire", () => {
    const usesSpinach = recipe("b-spinach", { uses: ["spinach", "onion"] });
    const other = recipe("a-other", { uses: ["carrot", "onion"] });
    const result = pickDinner(input([other, usesSpinach], { pantry: { spinach: 200 }, expiringIngredientIds: ["spinach"] }), MONDAY, [], null);
    expect(result?.id).toBe("b-spinach");
  });

  it("picks a quick dish on a busy day", () => {
    const slow = recipe("a-slow", { totalMinutes: 35 });
    const quick = recipe("b-quick", { totalMinutes: 15 });
    expect(pickDinner(input([slow, quick]), { ...MONDAY, busy: true }, [], null)?.id).toBe("b-quick");
    expect(pickDinner(input([slow, quick]), MONDAY, [], null)?.id).toBe("a-slow"); // tie → id order
  });

  it("varies the protein, counting different cuts of the same animal as one", () => {
    const veg = ["onion", "tomato", "garlic", "ginger", "cilantro"];
    const chosen = [recipe("butter-chicken", { uses: ["meat:chicken", ...veg] })];
    // Thighs vs. breast are different ingredients but the same protein group.
    const chickenAgain = recipe("a-chicken-tikka", { uses: ["meat:chicken", ...veg] });
    const beef = recipe("b-keema", { uses: ["meat:beef", ...veg] });
    expect(pickDinner(input([chickenAgain, beef]), MONDAY, chosen, null)?.id).toBe("b-keema");
  });

  it("steers clear of dislikes when there's an alternative", () => {
    const disliked = recipe("a-mushroom-risotto", { dislikeMatches: 1, cuisines: ["italian"] });
    const fine = recipe("b-dal");
    expect(pickDinner(input([disliked, fine], { likedCuisines: ["italian"] }), MONDAY, [], null)?.id).toBe("b-dal");
  });

  it("puts the household's diet goals ahead of this week's deals", () => {
    const onSale = recipe("a-burgers", { uses: ["beef", "cheddar", "tomato"] });
    const healthy = recipe("b-bean-tacos", { uses: ["beans", "avocado", "lime"], dietTags: ["healthy"] });
    const result = pickDinner(input([onSale, healthy], { goalDietTags: ["healthy"], dealIngredientIds: ["beef", "cheddar", "tomato"] }), MONDAY, [], null);
    expect(result?.id).toBe("b-bean-tacos");
  });

  it("prefers cheaper dishes, all else equal", () => {
    const pricey = recipe("a-salmon", { uses: ["salmon"] });
    const cheap = recipe("b-lentils", { uses: ["lentils"] });
    const result = pickDinner(input([pricey, cheap], { unitPriceCents: { salmon: 3, lentils: 0.5 } }), MONDAY, [], null);
    expect(result?.id).toBe("b-lentils");
  });
});

describe("planWeek — leftovers and eat-out days", () => {
  const pool = Array.from({ length: 7 }, (_, i) => recipe(`r${i}`));

  it("cooks double and turns tomorrow's lunch into leftovers", () => {
    const meals = planWeek(input(pool, { leftovers: true }));
    const monDinner = meals.find((m) => m.date === "2026-10-05" && m.slot === "dinner")!;
    const tueLunch = meals.find((m) => m.date === "2026-10-06" && m.slot === "lunch")!;
    expect(monDinner.servings).toBe(4);
    expect(tueLunch).toMatchObject({ type: "leftover", recipeId: monDinner.recipeId, servings: 2 });
    // No leftover lunch on day one, and the last dinner has nobody to feed tomorrow.
    expect(meals.some((m) => m.date === "2026-10-05" && m.slot === "lunch")).toBe(false);
    expect(meals.find((m) => m.date === "2026-10-11" && m.slot === "dinner")!.servings).toBe(2);
  });

  it("marks eat-out days and leaves the next lunch free", () => {
    const days = WEEK.map((d, i) => (i === 2 ? { ...d, eatOut: true } : d));
    const meals = planWeek(input(pool, { days, leftovers: true }));
    expect(meals.find((m) => m.date === "2026-10-07" && m.slot === "dinner")).toMatchObject({ type: "eat_out", recipeId: null });
    expect(meals.some((m) => m.date === "2026-10-08" && m.slot === "lunch")).toBe(false);
  });

  it("without leftover tolerance, plans dinners only, sized for the household", () => {
    const meals = planWeek(input(pool));
    expect(meals.every((m) => m.slot === "dinner" && m.servings === 2)).toBe(true);
  });
});
