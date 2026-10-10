import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer } from "./support/server.js";

// The demo scenario from docs/product-spec.md, end to end against the built API and the
// seeded database. Run with `pnpm test:demo` (needs `pnpm db:migrate && pnpm db:seed`).
let API = "";

async function call<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

describe.skipIf(!process.env.DEMO_FLOW)("demo flow", () => {
  let stop = () => {};

  beforeAll(async () => {
    ({ url: API, stop } = await startServer(3999));
  }, 20_000);

  afterAll(() => stop());

  it("plans a week, builds one list, finds savings, and opens tonight's recipe", async () => {
    const { token } = await call<{ token: string }>("POST", "/api/auth/login", undefined, { email: "demo@mealmesh.app", password: "mealmesh-demo" });

    const today = new Date();
    const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7)));
    const plan = await call<{ id: string; meals: Array<{ slot: string; type: string; recipeId: string | null }> }>(
      "POST", "/api/meal-plans/generate", token, { weekStartDate: monday.toISOString().slice(0, 10) },
    );
    const dinners = plan.meals.filter((m) => m.slot === "dinner" && m.type === "cook");
    expect(dinners.length).toBeGreaterThanOrEqual(4);

    const list = await call<{ id: string; items: Array<{ name: string; pantryCovered: number; quantity: number }> }>("GET", `/api/grocery-list?mealPlanId=${plan.id}`, token);
    const names = list.items.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length); // one line per ingredient
    expect(list.items.some((i) => i.pantryCovered > 0)).toBe(true); // demo pantry subtracted

    type Strategy = { totalCents: number; savingsCents: number; topSavingsDrivers: string[]; stores: unknown[] };
    const opt = await call<{ isDemo: boolean; minStores: Strategy; minCost: Strategy; bestOverall: Strategy }>("GET", `/api/grocery-list/${list.id}/optimize`, token);
    expect(opt.isDemo).toBe(true); // Estimated pricing badge
    expect(opt.minCost.totalCents).toBeLessThanOrEqual(opt.bestOverall.totalCents);
    expect(opt.bestOverall.totalCents).toBeLessThanOrEqual(opt.minStores.totalCents);
    expect(opt.bestOverall.stores.length).toBeLessThanOrEqual(2);
    expect(opt.bestOverall.savingsCents).toBe(opt.minStores.totalCents - opt.bestOverall.totalCents);
    if (opt.bestOverall.savingsCents > 0) expect(opt.bestOverall.topSavingsDrivers.length).toBeGreaterThan(0);

    const deals = await call<{ deals: Array<{ item: string; regularCents: number; saleCents: number; savingsCents: number }> }>("GET", `/api/grocery-list/${list.id}/deals`, token);
    for (const deal of deals.deals) expect(deal.regularCents - deal.saleCents).toBe(deal.savingsCents);

    const recipe = await call<{ instructions: unknown[]; costPerServingCents: number | null }>("GET", `/api/recipes/${dinners[0]!.recipeId}`, token);
    expect(recipe.instructions.length).toBeGreaterThan(0);
    expect(recipe.costPerServingCents).not.toBeNull();
  }, 30_000);
});
