# Architecture

## Repo shape

Native mobile client (iOS + Android from one codebase), a separate API backend, and a
shared pure-logic package. See `docs/open-questions.md` item 5 for why (React Native +
NestJS + a shared TypeScript domain package, in a pnpm/Turborepo monorepo).

```
apps/mobile/            React Native (Expo) — iOS + Android UI
apps/backend/            NestJS — API, orchestration, DB access
  src/modules/           one module per bounded context (meal-plans, recipes, pantry, ...)
  src/providers/         AI + grocery, behind interfaces
  prisma/                schema + migrations + seed
packages/domain/         pure functions, no I/O, fully unit tested
packages/config/         shared eslint/tsconfig
```

## Layers

```
Mobile UI (apps/mobile)
  → backend API (apps/backend/src/modules/**/*.controller.ts)
    → services (apps/backend/src/modules/**/*.service.ts)   orchestration, DB access, transactions
      → domain (packages/domain)                             pure functions, no I/O, fully unit tested
      → providers (apps/backend/src/providers)                AI + grocery, behind interfaces
```

Rules: mobile UI never calls providers directly — everything goes through the backend
API. Services never contain unit math; they call into `packages/domain`. Domain never
imports Prisma or anything backend-specific — it must be importable from the mobile app
too, with zero I/O. One direction only.

## AIProvider

```ts
interface AIProvider {
  proposeMealCandidates(input: CandidateRequest): Promise<RecipeCandidate[]>;
  generateRecipe(input: RecipeRequest): Promise<Recipe>;
  suggestSubstitutions(input: SubstitutionRequest): Promise<Substitution[]>;
  explainPlan(input: PlanExplainRequest): Promise<string>;
  parseReceipt(input: ReceiptRequest): Promise<ParsedReceipt>;
  classifyIngredient(name: string): Promise<IngredientClassification>;
}
```

Ship `ClaudeAIProvider` plus a `FixtureAIProvider` that returns canned data, so tests
and offline dev never hit the network. Provider choice comes from env.

Contract rules:
- Every AI call returns strict JSON validated with a schema (zod). Invalid → one
  retry → fall back to deterministic behaviour, never to a guess.
- AI never returns prices, costs, or totals. If a prompt would tempt it to, remove that
  field from the response shape.
- Cache generated recipes by content hash. Meal planning should not re-generate a
  recipe that already exists.
- **Tier-gated**: `AIProvider` is a Pro-only feature (`docs/open-questions.md` item
  11). Every service method that calls it must check
  `household.subscriptionTier === 'pro'` **before** the call and throw/return a
  clear "upgrade to Pro" result for Free households — never let a Free request reach
  the provider. This is a service-layer check, not a UI-only restriction, since a
  UI-only gate can be bypassed by calling the API directly.

## GroceryProvider

```ts
interface GroceryProvider {
  readonly id: string;
  readonly isDemo: boolean;
  searchProducts(query: ProductQuery): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  getPrice(productId: string): Promise<ProductPrice | null>;
  getDeals(storeId: string): Promise<Deal[]>;
  getStoreLocations(near: LatLng, radiusKm: number): Promise<Store[]>;
}
```

`MockGroceryProvider` reads the seeded tables (approximate pricing — see
`docs/open-questions.md` item 1) and sets `isDemo: true`. Anything derived from a
provider with `isDemo` must render the "Estimated pricing" badge (`EstimatedPricingBadge`
in the mobile app). A provider registry resolves by id; nothing else in the codebase
names a retailer.

## Meal plan generation — how it actually works

This section describes **Plan My Week**, the Pro-only automatic path
(`docs/product-spec.md`). The Free-tier path, **Build My Week**, skips all of this —
the user picks a recipe per slot from the local library directly, the service just
validates hard constraints (allergy veto) and writes the `Meal` row. No candidate
pool, no scoring, no AI. Both paths converge on the same `Meal`/`MealPlan` rows, so
everything downstream (grocery list, optimization, score) is identical either way.

Do **not** send one prompt saying "plan my week" and use whatever comes back. That
produces seven unrelated recipes and no ingredient reuse.

1. **Gather context** — preferences, household, pantry, expiring items, active deals,
   recent meals (avoid repeats), budget.
2. **Build a candidate pool** — pull matching seed recipes, and ask the AI for
   additional candidates only if the pool is thin. Filter hard constraints (allergies,
   diet, max cook time) in code.
3. **Select the week deterministically** — greedy fill by slot, scoring each candidate
   against the partial plan: ingredient overlap with already-selected meals, pantry
   coverage, expiring-item usage, deal coverage, cost, cuisine/protein variety, cook
   time vs. that day's busyness. Take the best; on ties prefer higher pantry coverage.
4. **Insert leftovers** — where a cook produces surplus servings and the next day's
   slot allows it and leftover tolerance is on.
5. **Score the plan** (deterministic) and **explain it** (AI, given the computed
   numbers — it only phrases them).

As built (`PlanMyWeekService`, `packages/domain/src/planner`): it fills **dinners plus
leftover lunches**; breakfasts and snacks stay with the user (item 16). Step 2's AI
top-up isn't built — the library is the whole pool (item 18). Spend for the score is
the cheapest product anywhere per line after pantry subtraction, read through the
`GroceryProvider`.

This keeps the plan reproducible, testable, cheap, and explainable. Regeneration of a
single meal re-runs step 3 for that slot only. Steps 2 and 5 are the only AI calls in
this whole pipeline — gate both on `subscriptionTier === 'pro'` per the AIProvider
contract rule above.

## API surface

```
POST /api/onboarding
GET  /api/meal-plans/current
POST /api/meal-plans                          creates an empty week (Build My Week entry point)
POST /api/meal-plans/generate                 Pro only — auto-fills a week; 402/403 for Free
POST /api/meal-plans/:id/meals/:mealId/regenerate   Pro only — AI re-pick; Free uses the PATCH below instead
PATCH/api/meal-plans/:id/meals/:mealId        replace, skip, leftover, servings — how Build My Week writes picks
GET  /api/recipes/:id
POST /api/recipes/generate
GET  /api/pantry
POST /api/pantry/items
PATCH/api/pantry/items/:id
GET  /api/grocery-list?mealPlanId=
PATCH/api/grocery-list/items/:id
POST /api/grocery/optimize                     { strategy }
GET  /api/stores
GET  /api/deals?mealPlanId=
POST /api/receipts/parse                       (P2)
```

Every mutating route validates input with zod and returns the updated resource plus any
recomputed derived values (list totals, score) so the client never has to guess.

## Cross-cutting

- **Auth**: session-based, household-scoped. Every query filters by householdId — a
  user must never read another household's pantry or prices.
- **Privacy**: grocery habits are personal data. Minimal collection, full delete of a
  household's data, no third-party sharing, no secrets in code.
- **Errors**: user-facing copy in `docs/ux.md`. Never silently show fabricated data;
  a stale price says it's stale.
- **Tests**: domain functions unit-tested (that's most of the value), services tested
  against a test DB for the plan → list → optimize path, one end-to-end demo-flow test.
