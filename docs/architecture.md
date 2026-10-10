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
  listStores(): Promise<Store[]>;
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
POST /api/auth/signup | /login | /oauth      email+password, or a Google/Apple ID token (+ date of birth for new accounts)
POST /api/auth/logout | /logout-all          end this session, or every session of yours
POST /api/onboarding                          owner only: household name, budget, shared preferences
GET  /api/me                                  you, your household, needsProfile, needsAgeConfirmation
POST /api/me/age                              older accounts confirm their date of birth (403 AGE_REQUIRED until they do)
PUT  /api/me/profile                          your name, allergies, dislikes
GET  /api/me/history                          weeks planned, meals cooked, spend, scores
GET  /api/me/data                             everything stored about you, as JSON
DELETE /api/me                                delete your account
POST /api/me/join                             join a household by code (replaces yours if you're alone)
GET  /api/households/current/members          housemates + this week's cost split
POST /api/households/current/invites          owner: new invite code
PATCH/api/households/current/members/:id      owner: cost share
DELETE /api/households/current/members/:id    owner: remove a housemate
POST /api/households/current/leave            member: leave
GET  /api/meal-plans/current?date=             latest week, or the week containing date (Home's Tonight)
POST /api/meal-plans                          creates an empty week (Build My Week entry point)
POST /api/meal-plans/generate                 Pro only — auto-fills a week; 402/403 for Free
POST /api/meal-plans/:id/meals/:mealId/regenerate   Pro only — AI re-pick; Free uses the PATCH below instead
PATCH/api/meal-plans/:id/meals/:mealId        replace, skip, leftover, servings — how Build My Week writes picks
GET  /api/recipes/:id                         recipe + cost per serving + what's in your pantry
POST /api/recipes/generate
GET  /api/pantry                              items + Use It First
GET  /api/pantry/ingredients
POST /api/pantry/items
PATCH/api/pantry/items/:id
DELETE /api/pantry/items/:id
GET  /api/grocery-list?mealPlanId=            rebuilt from plan + pantry on every read
PATCH/api/grocery-list/items/:id              checked, alreadyHave, userOverrideQuantity, buyAnyway
POST /api/grocery-list/:id/items              your own item
DELETE /api/grocery-list/items/:id            your own items only
GET  /api/grocery-list/:id/optimize           all three strategies + budget and swap ideas
GET  /api/grocery-list/:id/deals              Deal Radar
POST /api/receipts/parse                       (P2)
```

Every mutating route validates input with zod and returns the updated resource plus any
recomputed derived values (list totals, score) so the client never has to guess.

## Cross-cutting

- **Auth**: session-based, household-scoped. Every query filters by householdId — a
  user must never read another household's pantry or prices. Sign in with email and
  password, Google, or Apple (`docs/oauth-setup.md`). For Google and Apple the
  backend verifies the provider's ID token itself and never sees a password. A
  verified email that matches an existing account links to it; an unverified one
  never does.
- **Households**: the owner creates the household, invites housemates with one-time
  codes, removes people, and sets cost shares and the shared preferences. Members
  set their own name, allergies, and dislikes, and planning respects everyone's.
  Removing or leaving moves a person to a household of their own; nobody's account
  is deleted by someone else.
- **Privacy**: grocery habits are personal data. Minimal collection, no third-party
  sharing, no secrets in code. Everyone can download everything stored about them
  (`GET /api/me/data`, secrets and housemates' emails left out) and delete their
  account (`DELETE /api/me`). The last person out takes the whole household's data
  with them.
- **Abuse limits**: per-IP rate limits (stricter on sign-in and the heavy routes), a
  15-minute lock after 10 wrong passwords for one email, size limits on every input,
  helmet headers, and no CORS unless `CORS_ORIGINS` is set. Limits are kept in memory,
  so they count per API instance; use a shared store before running more than one.
- **Errors**: user-facing copy in `docs/ux.md`. Never silently show fabricated data;
  a stale price says it's stale.
- **Tests**: domain functions unit-tested (that's most of the value), services tested
  against a test DB for the plan → list → optimize path, one end-to-end demo-flow test.
