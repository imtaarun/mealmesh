# Implementation plan

Phase 0 deliverable per `docs/roadmap.md`. Reconciled with `CLAUDE.md` (updated to
match) and `docs/open-questions.md` (stack decision recorded as item 5, resolved).

## What changed from the original spec

The original `CLAUDE.md` assumed a Next.js mobile-first web app. The actual target is
native iOS + Android. That changes the shape of the repo (two apps instead of one,
plus a shared package) but not the product rules — deterministic core, AI at the
edges, mock-only pricing with a visible badge, no retailer hard-coding, vertical
slices, simple code. Those are unchanged and still govern every phase below.

Stack: React Native + TypeScript (Expo) for mobile, NestJS + TypeScript + Prisma +
PostgreSQL for the backend, a shared `packages/domain` for the pure logic, pnpm +
Turborepo for the monorepo. Full rationale in `docs/open-questions.md` item 5.

## What exists now (this session)

- Monorepo scaffold: pnpm workspaces, Turborepo, shared `tsconfig.base.json`, shared
  eslint base in `packages/config`.
- `packages/domain`: types for the whole deterministic core (units, aggregation,
  costing, optimizer, score) and function signatures per `docs/algorithms.md`, each
  throwing `not yet implemented` with a doc pointer. Vitest wired up; the test cases
  listed in `docs/algorithms.md` / `docs/data-model.md` are staged as `it.todo(...)` in
  `packages/domain/test/units.test.ts` so the suite is green and the acceptance
  criteria are visible.
- `apps/backend`: NestJS skeleton — one module per bounded context (auth, households,
  meal-plans, recipes, pantry, grocery-list), each with a controller wired to the API
  surface in `docs/architecture.md` and a service stub. `AIProvider` and
  `GroceryProvider` interfaces plus `FixtureAiProvider`/`ClaudeAiProvider` and
  `MockGroceryProvider`, selected via env, matching the provider-registry rule.
  `prisma/schema.prisma` fully transcribed from `docs/data-model.md`. Household-scoping
  decorator stubbed (`CurrentHousehold`) pending real auth.
- `apps/mobile`: Expo + Expo Router app. Tab navigation for Home / Week / Shop /
  Pantry / Discover / Profile per `docs/ux.md`. A small theme system (warm/premium
  palette, spacing, typography) and three primitives (`Screen`, `Card`, `EmptyState`,
  `EstimatedPricingBadge`). Every screen currently renders the exact empty-state copy from
  `docs/ux.md` — no fabricated data anywhere.
- Docs moved from repo root into `docs/`, matching what `CLAUDE.md` already expected.
  `docs/architecture.md` and `docs/ux.md` updated in a few places to reflect native
  mobile instead of a web app.

None of this is a working feature yet — it's the skeleton the roadmap phases build
into. `pnpm install`, `prisma migrate dev` (against a real local Postgres), typecheck,
build, and test have all been run and verified passing across every package — see
`README.md` "Current state" for the full list and for three real bugs (NestJS DI
globals, missing `class-validator`, NativeWind/pnpm/Metro wiring) that were caught and
fixed in the process. `packages/seed-data` also now exists (101 ingredients, 15 of the
30 target recipes) — not originally in this plan, added afterward per
`docs/product-spec.md` "Seed data requirements".

## Next: docs/roadmap.md, adjusted for the new repo shape

- **Phase 1 — Foundation + data model.** `pnpm install`, `prisma migrate dev` against a
  real Postgres instance, implement session auth + household scoping for real (replace
  the `CurrentHousehold` stub), confirm the mobile app can hit `/api/onboarding` and
  land on the empty Home screen that already exists.
- **Phase 2 — Deterministic core.** Implement every function in `packages/domain`
  against `docs/algorithms.md`; un-skip the `it.todo` cases in
  `packages/domain/test/units.test.ts` as each is done. This is the phase that makes
  the product real — don't rush it, per `docs/roadmap.md`.
- **Phase 3 — Seed data.** Fill `apps/backend/prisma/seed.ts` (currently a stub) with
  30 recipes / 100 ingredients / 5 stores / 150 products per
  `docs/product-spec.md` "Seed data requirements".
- **Phase 4 onward** — unchanged in substance from `docs/roadmap.md`; each phase's UI
  work lands in `apps/mobile`, service/orchestration work in `apps/backend/src/modules`,
  and math in `packages/domain`.

## Product decisions resolved (this session, after the build)

Four more items in `docs/open-questions.md` went from open to resolved, propagated
into `docs/product-spec.md`, `docs/architecture.md`, `docs/ux.md`,
`docs/algorithms.md`, `CLAUDE.md`, and the Prisma schema (`Household.subscriptionTier`,
migrated):

- **Item 1 (pricing)**: approximate pricing, not live data. Checked whether a
  licensed flyer API (Flipp) was reachable — it exists but requires a business
  partner application, not self-serve access, so it's out of scope for now. Badge
  renamed "Demo pricing" → "Estimated pricing" everywhere (`EstimatedPricingBadge`).
- **Item 2 (recipe imagery)**: local-library recipes get a designed per-cuisine
  placeholder; AI-generated (Pro) recipes get no image at all and a distinct
  image-less card layout — the absence is deliberate, not a bug.
- **Item 9 (household conflicts)**: for the new manual flow (below), conflicts
  surface to the human at the moment of picking instead of being auto-resolved; the
  original automatic fairness-counter rule now applies specifically to the Pro
  auto-generate path.
- **Item 11 (new — subscription tiers)**: Free = local library only, manual "Build My
  Week" selection, full deterministic pipeline (grocery list, pantry, optimization,
  score — none of that is paywalled). Pro = adds `AIProvider` access ("Plan My Week"
  auto-generate, AI recipes, substitutions). Gating is a service-layer check on
  `Household.subscriptionTier`, not a UI-only restriction.

At the time this was written, none of it was implemented as working UI/service logic —
just captured in the docs and schema. That changed in the next session (below).

## Phases 1, 2, and 4 (Build My Week) — implemented and verified

Everything in this section was built, typechecked, tested, and exercised end-to-end
over real HTTP against a real local Postgres — not just scaffolded. See
`docs/roadmap.md` for the phase-by-phase status this rolled up into.

- **`packages/domain` (Phase 2)**: all five modules implemented for real — unit
  conversion, aggregation (with the needsReview/isNominal handling
  `docs/algorithms.md` requires), costing, the basket optimizer (all three
  strategies), and the MealMesh Score (exact formulas now in `docs/algorithms.md`
  §6, since the original weights table named the basis but not the formula). Plus a
  new `conflicts` module (allergy hard-block, dislike soft-warning — substring
  matching against ingredient name/aliases; documented limitation: no allergen-category
  understanding, e.g. "tree_nut" won't match "Almonds"). 34 tests across 6 files, all
  passing, each traceable to a test case in `docs/algorithms.md`.
- **Auth (Phase 1)**: session-based (`Session` model, SHA-256 token hash, bcrypt
  passwords, 30-day expiry), a global `AuthGuard` populating `CurrentHousehold` for
  every route except `@Public()` ones (signup, login). Onboarding is idempotent —
  resubmitting replaces the household's preference set rather than duplicating rows.
- **Seed data wired into the DB**: `prisma/seed.ts` now actually writes
  `packages/seed-data`'s 101 ingredients and 15 recipes (upsert by slug id, so
  re-running is safe). Verified: counts stay stable across repeat runs.
- **Build My Week (Phase 4, Free + Pro path)**: `POST /api/meal-plans` pre-creates all
  28 slots (7 days × 4) for a week; `GET /api/recipes` browses the library; `PATCH
  .../meals/:mealId` does replace/skip/leftover, running the conflict checker before
  every replace — blocked on allergy match, returns a warning needing
  `acknowledgeWarnings: true` on dislike match, writes clean otherwise. Mobile:
  one-screen onboarding form, a real Week grid (not a mock), a recipe picker modal, a
  `MealCard` with the per-cuisine gradient placeholder from `docs/ux.md`, and a
  session-token auth flow (`expo-secure-store`) gating navigation between onboarding
  and the tab shell.

**Three more real bugs**, caught by actually building and booting rather than trusting
typecheck:
- `packages/domain`'s `package.json` pointed `main` at TypeScript source
  (`./src/index.ts`) — fine for vitest/Metro/`nest start` dev mode, but the compiled
  backend's plain `node dist/main.js` couldn't `require()` a `.ts` file. Fixed by
  giving it a real `tsc` build step and pointing `main`/`types` at `dist/`.
  `packages/seed-data` has the same shape but isn't hit yet (only consumed via `tsx`
  today) — same fix needed if that changes.
  - Two more instances of the pnpm-strict-hoisting bug already seen with
  `react-native-css-interop`: `@react-navigation/native` (used for `useFocusEffect`
  on the Week screen) and `@babel/runtime` (async/await transform helpers) both had to
  become **direct** `apps/mobile` dependencies — Metro can't resolve a dependency of a
  dependency under pnpm's strict `node_modules` layout.

**Not done** (at the end of that session): Plan My Week (Pro/AI path), score display
in the UI, the remaining 15 recipes, all store/product/price/deal seed data, and the
`pnpm lint` gap (still no `eslint.config.js` anywhere, flagged in an earlier
session, not yet fixed).

## Phase 3 (seed data) — completed

- **Recipes 16–30** in `packages/seed-data/src/recipes.json`, written from scratch
  (item 3), picked for ingredient reuse with the existing 15 — they add breakfasts
  (egg bhurji, omelette, pancakes), lunches (hummus wraps, peanut noodles), and a few
  stir-fries so the previously unused Asian pantry items get used.
- **Conversion gaps fixed**: three existing lines (butter, tomato paste, flour in tbsp)
  silently came out `needsReview` because those ingredients had no `density`. Added
  densities, and `validateSeedData` now fails on any recipe line that can't convert —
  which immediately caught two of the new recipes measuring spinach in cups.
- **Pricing catalog**: `reference-prices.json` (one pack + regular price per
  ingredient), `stores.json` (5 fictional stores: price factor, variance, what they
  stock, this week's deals), and `catalog.ts`, which generates products, price
  timelines, and deals from them. Deterministic — a hash of the product id, not
  `Math.random` — so every seed produces the same prices and tests can rely on them.
- **Demo household** (`demo-household.json`): the product-spec demo scenario, Pro tier
  (the scenario uses Plan My Week), 28 pantry items including spinach expiring in 2
  days for Use It First. `PriceHistory` isn't seeded — see open-questions item 15.
- **`MockGroceryProvider`** implemented and exercised against the seeded database.
- **Tests**: `packages/seed-data` now has vitest (10 tests), including a full demo
  week through the domain pipeline so a bad data change that makes the optimizer
  "look broken" (product-spec's warning) fails CI instead of a demo.

## Open items carried forward

Everything else in `docs/open-questions.md` still applies (recipe content licensing,
name/trademark, AI cost/latency budget, offline behaviour in-store, nutrition data,
store distance/trip cost) except items 1, 2, 5, 9, and 11, which are now resolved. Items 12–15 were added
during Phase 3.
