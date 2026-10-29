import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, startServer } from "./support/server.js";

// The recipe library's filters, sorting and paging, against the built API and a seeded
// database. Run with `pnpm test:recipes`.
const run = !!process.env.RECIPE_TESTS;

describe.skipIf(!run)("recipe library", () => {
  let call: ReturnType<typeof client>;
  let stop = () => {};
  let token: string;

  beforeAll(async () => {
    const server = await startServer(3997, { AUTH_RATE_LIMIT_PER_MINUTE: "1000", RATE_LIMIT_PER_MINUTE: "10000" });
    stop = server.stop;
    call = client(server.url);
    const email = `rec${Date.now()}@example.com`;
    token = (await call("POST", "/api/auth/signup", undefined, { email, password: "password123", dateOfBirth: "1990-05-01" })).body.token;
  }, 20_000);

  afterAll(() => stop());

  const list = async (query = "") => (await call("GET", `/api/recipes${query}`, token)).body as { items: Array<{ id: string; title: string; cuisines: string[]; dietTags: string[]; mealSlots: string[]; difficulty: string; prepMinutes: number; cookMinutes: number }>; total: number };

  it("pages through the library without repeats", async () => {
    const first = await list("?limit=5");
    const second = await list("?limit=5&offset=5");
    expect(first.items).toHaveLength(5);
    expect(first.total).toBeGreaterThan(10);
    expect(second.total).toBe(first.total);
    expect(first.items.filter((r) => second.items.some((s) => s.id === r.id))).toEqual([]);
  });

  it("leaves instructions out of the list", async () => {
    expect((await list("?limit=1")).items[0]).not.toHaveProperty("instructions");
  });

  it("combines filters", async () => {
    const res = await list("?cuisine=indian&dietTags=vegetarian,gluten_free&mealSlot=dinner&maxMinutes=45&limit=50");
    expect(res.total).toBeGreaterThan(0);
    for (const r of res.items) {
      expect(r.cuisines).toContain("indian");
      expect(r.dietTags).toEqual(expect.arrayContaining(["vegetarian", "gluten_free"]));
      expect(r.mealSlots).toContain("dinner");
      expect(r.prepMinutes + r.cookMinutes).toBeLessThanOrEqual(45);
    }
  });

  it("sorts quickest first", async () => {
    const minutes = (await list("?sort=quickest&limit=50")).items.map((r) => r.prepMinutes + r.cookMinutes);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
  });

  it("hides dishes the household is allergic to", async () => {
    await call("PUT", "/api/me/profile", token, { name: "Sam", allergies: ["chickpea"] });
    const all = await list("?limit=50");
    const safe = await list("?fitsHousehold=true&limit=50");
    expect(safe.total).toBeLessThan(all.total);
    expect(safe.items.map((r) => r.title).join(" ").toLowerCase()).not.toContain("chickpea");
  });

  it("rejects values it doesn't know", async () => {
    for (const q of ["?mealSlot=brunch", "?difficulty=insane", "?limit=500", "?offset=-1", "?sort=cheapest"]) {
      expect([q, (await call("GET", `/api/recipes${q}`, token)).status]).toEqual([q, 400]);
    }
  });

  it("lists what it can be filtered by", async () => {
    const options = (await call("GET", "/api/recipes/filters", token)).body;
    expect(options.cuisines).toContainEqual({ value: "thai", count: expect.any(Number) });
    expect(options.mealSlots).toContain("breakfast");
  });
});
