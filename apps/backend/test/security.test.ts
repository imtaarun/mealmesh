import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, startServer } from "./support/server.js";

// Regression tests for docs/security-audit.md and the 16+ age rule, against the built API
// and a migrated database. Run with `pnpm test:security`.
const run = !!process.env.SECURITY_TESTS;
const adult = "1990-05-01";
const fifteen = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 15);
  return d.toISOString().slice(0, 10);
};
const unique = () => `sec${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;

describe.skipIf(!run)("security", () => {
  const prisma = new PrismaClient();
  let call: ReturnType<typeof client>;
  let stop = () => {};

  beforeAll(async () => {
    // Generous auth limits here; the throttling test below starts its own server with the defaults.
    const server = await startServer(3998, { AUTH_RATE_LIMIT_PER_MINUTE: "1000", RATE_LIMIT_PER_MINUTE: "10000", HEAVY_RATE_LIMIT_PER_MINUTE: "1000" });
    stop = server.stop;
    call = client(server.url);
  }, 20_000);

  afterAll(async () => {
    stop();
    await prisma.$disconnect();
  });

  const signup = async (dateOfBirth = adult, extra: object = {}) => {
    const email = unique();
    const res = await call("POST", "/api/auth/signup", undefined, { email, password: "password123", dateOfBirth, ...extra });
    return { email, ...res, token: res.body?.token as string };
  };

  describe("age 16+", () => {
    it("refuses an under-16 sign-up and stores nothing", async () => {
      const kid = await signup(fifteen());
      expect(kid.status).toBe(403);
      expect(kid.body.code).toBe("UNDER_AGE");
      expect(await prisma.user.count({ where: { email: kid.email } })).toBe(0);
    });

    it("needs a real date of birth", async () => {
      expect((await call("POST", "/api/auth/signup", undefined, { email: unique(), password: "password123" })).status).toBe(400);
      expect((await signup("2001-02-30")).status).toBe(400);
    });

    it("keeps only the birth year for an adult", async () => {
      const { email, status } = await signup();
      expect(status).toBe(201);
      const user = await prisma.user.findFirstOrThrow({ where: { email } });
      expect(user.birthYear).toBe(1990);
      expect(user.ageConfirmedAt).not.toBeNull();
    });

    it("holds an account from before the age check at the question, then lets it in", async () => {
      const { email, token } = await signup();
      await prisma.user.update({ where: { email }, data: { birthYear: null, ageConfirmedAt: null } });
      const blocked = await call("GET", "/api/pantry", token);
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe("AGE_REQUIRED");
      expect((await call("GET", "/api/me", token)).body.needsAgeConfirmation).toBe(true);
      expect((await call("POST", "/api/me/age", token, { dateOfBirth: adult })).status).toBe(201);
      expect((await call("GET", "/api/pantry", token)).status).toBe(200);
    });

    it("deletes an older account that turns out to be under 16", async () => {
      const { email, token } = await signup();
      await prisma.user.update({ where: { email }, data: { birthYear: null, ageConfirmedAt: null } });
      expect((await call("POST", "/api/me/age", token, { dateOfBirth: fifteen() })).status).toBe(403);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
      expect((await call("GET", "/api/me", token)).status).toBe(401);
    });
  });

  describe("sessions", () => {
    it("logout ends the session on the server (SEC-02)", async () => {
      const { token } = await signup();
      expect((await call("POST", "/api/auth/logout", token)).status).toBe(201);
      expect((await call("GET", "/api/me", token)).status).toBe(401);
    });

    it("logout-all ends every session", async () => {
      const { email, token } = await signup();
      const second = (await call("POST", "/api/auth/login", undefined, { email, password: "password123" })).body.token;
      expect((await call("POST", "/api/auth/logout-all", token)).status).toBe(201);
      expect((await call("GET", "/api/me", second)).status).toBe(401);
    });
  });

  describe("login (SEC-01, SEC-05)", () => {
    it("answers the same for an unknown email and a wrong password, in similar time", async () => {
      const { email } = await signup();
      const time = async (body: object) => {
        const started = Date.now();
        const res = await call("POST", "/api/auth/login", undefined, body);
        return { res, ms: Date.now() - started };
      };
      const unknown = await time({ email: unique(), password: "wrongpass1" });
      const wrong = await time({ email, password: "wrongpass1" });
      expect(unknown.res.status).toBe(401);
      expect(unknown.res.body).toEqual(wrong.res.body);
      expect(unknown.ms).toBeGreaterThan(wrong.ms / 3); // both pay for a bcrypt comparison
    });

    it("locks an email after 10 wrong passwords, even for the right one", async () => {
      const { email } = await signup();
      for (let i = 0; i < 10; i++) await call("POST", "/api/auth/login", undefined, { email, password: `guess${i}xxx` });
      expect((await call("POST", "/api/auth/login", undefined, { email, password: "password123" })).status).toBe(429);
    });
  });

  describe("input limits (SEC-06)", () => {
    it("rejects out-of-range values with 400, never 500", async () => {
      const { token } = await signup();
      const plan = (await call("POST", "/api/meal-plans", token, { weekStartDate: "2026-10-05" })).body;
      const dinner = plan.meals.find((m: { slot: string }) => m.slot === "dinner");
      const recipe = (await call("GET", "/api/recipes", token)).body[0];
      const list = (await call("GET", `/api/grocery-list?mealPlanId=${plan.id}`, token)).body;
      const cases: Array<[string, string, object | undefined]> = [
        ["PATCH", `/api/meal-plans/${plan.id}/meals/${dinner.id}`, { action: "replace", recipeId: recipe.id, servings: 2_000_000_000 }],
        ["POST", "/api/pantry/items", { ingredientId: "onion", quantity: 1e308, location: "fridge" }],
        ["POST", "/api/onboarding", { weeklyBudgetCents: 99_999_999_999 }],
        ["GET", "/api/recipes?maxPrepMinutes=abc", undefined],
        ["POST", `/api/grocery-list/${list.id}/items`, { name: "A".repeat(200) }],
        ["PUT", "/api/me/profile", { name: "Sam", allergies: Array(31).fill("x") }],
      ];
      for (const [method, path, body] of cases) expect([method, path, (await call(method, path, token, body)).status]).toEqual([method, path, 400]);
    });

    it("returns the existing plan when a week is created twice", async () => {
      const { token } = await signup();
      const first = (await call("POST", "/api/meal-plans", token, { weekStartDate: "2026-10-05" })).body;
      const again = (await call("POST", "/api/meal-plans", token, { weekStartDate: "2026-10-05" })).body;
      expect(again.id).toBe(first.id);
    });
  });

  describe("headers (SEC-07)", () => {
    it("gives other websites no CORS access and sends security headers", async () => {
      const res = await call("GET", "/api/recipes", undefined, undefined, { Origin: "https://evil.example" });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("x-powered-by")).toBeNull();
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    });
  });

  describe("households", () => {
    it("shows housemates' emails only to the owner (SEC-08)", async () => {
      const owner = await signup();
      const { code } = (await call("POST", "/api/households/current/invites", owner.token)).body;
      const member = await signup(adult, { inviteCode: code });
      const seenByMember = (await call("GET", "/api/households/current/members", member.token)).body.members;
      expect(seenByMember.find((m: { isYou: boolean }) => !m.isYou).email).toBeNull();
      expect(seenByMember.find((m: { isYou: boolean }) => m.isYou).email).toBe(member.email);
      const seenByOwner = (await call("GET", "/api/households/current/members", owner.token)).body.members;
      expect(seenByOwner.every((m: { email: string | null }) => m.email !== null)).toBe(true);
    });

    it("lets only one of two simultaneous sign-ups use an invite code (SEC-09)", async () => {
      const owner = await signup();
      const { code } = (await call("POST", "/api/households/current/invites", owner.token)).body;
      const results = await Promise.all([signup(adult, { inviteCode: code }), signup(adult, { inviteCode: code })]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    });
  });

  describe("rate limits with default settings (SEC-01)", () => {
    it("turns away a burst of sign-in attempts from one address", async () => {
      const server = await startServer(3997);
      try {
        const burst = client(server.url);
        const statuses = [];
        for (let i = 0; i < 15; i++) statuses.push((await burst("POST", "/api/auth/login", undefined, { email: unique(), password: "wrongpass1" })).status);
        expect(statuses).toContain(429);
      } finally {
        server.stop();
      }
    }, 30_000);
  });
});
