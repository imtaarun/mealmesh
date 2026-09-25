# Build roadmap

One phase ≈ one Claude Code session. **Each phase ends with the app running and its
own tests passing.** Do not start a phase before the previous one's DoD is met. Update
the status line below as you go.

**Current phase: 4, partially done** (Phases 0-2 done; Phase 3 partial — 15/30 recipes,
no stores/products/prices; Phase 4's Build My Week/Free path is done and verified
end-to-end, Plan My Week/Pro path is not built. See `IMPLEMENTATION_PLAN.md`.)

---

## Phase 0 — Survey and plan

Inspect the repo before writing anything: framework, language, package manager,
database, existing components and conventions, what already works. Then write a short
implementation plan to `IMPLEMENTATION_PLAN.md` and reconcile it with `CLAUDE.md`.
Do not replace an existing architecture without saying why.

**DoD:** plan exists; stack decision confirmed or amended in `docs/open-questions.md`.

## Phase 1 — Foundation + data model — DONE

Project skeleton, `apps/backend/src/{modules,providers}` layout, Prisma schema from
`docs/data-model.md`, migrations, session-based auth with household scoping
(`AuthGuard`, `Session` model, bcrypt), seed script structure.

**DoD:** `pnpm db:migrate` works (verified against a real local Postgres); signup →
onboarding → landing works end-to-end over real HTTP. `pnpm db:seed` writes food
content (ingredients + recipes) but not yet stores/products/prices — see Phase 3.

## Phase 2 — The deterministic core — DONE

`packages/domain`: unit conversion, aggregation, costing, basket optimizer, score, plus
a conflict-checker (allergy/dislike matching) added for Phase 4's Build My Week.
Written against `docs/algorithms.md`; exact score formulas now documented there too.

**DoD met:** 34 tests across 6 files pass (`pnpm --filter @mealmesh/domain test`),
covering every documented test case in `docs/algorithms.md`.

## Phase 3 — Seed data — PARTIAL

15 of 30 target recipes (5 each: Indian, Mediterranean, North American), 101
ingredients with full conversion data — in `packages/seed-data`, seeded into Postgres
via `apps/backend/prisma/seed.ts` (idempotent upsert by slug id, verified).

**Still missing:** 15 more recipes, and all store/product/price/deal data (approximate
pricing per `docs/open-questions.md` item 1 — not yet implemented as seed content).
Without prices, cost-per-serving and the MealMesh Score's budget/waste sub-scores
can't be wired into the UI yet.

## Phase 4 — Planner UI + Plan My Week — Build My Week DONE, Plan My Week NOT STARTED

Per `docs/open-questions.md` item 11, this phase forked into two paths:

- **Build My Week (Free + Pro) — DONE.** Onboarding (one-screen form: account,
  household, every preference), manual weekly grid, recipe library browser
  (`GET /api/recipes`, filterable), pick/replace/skip/leftover actions, allergy hard
  block + dislike soft warning with confirm-to-override — all built and verified
  end-to-end against a real backend and real seeded recipes (signup → onboard → browse
  → pick → conflict-blocked → conflict-confirmed → leftover, all over real HTTP).
  Recipe imagery: per-cuisine gradient placeholder, per `docs/ux.md`.
- **Plan My Week (Pro, AI-orchestrated auto-fill) — not started.** The
  candidate-and-select pipeline in `docs/architecture.md` "Meal plan generation" is
  still a stub (`MealPlansService.generate`/`regenerateMeal`). Needs
  `subscriptionTier === 'pro'` gating, `AIProvider` wiring, and the greedy-selection
  algorithm.
- **Score display** is not wired into the UI yet — blocked on Phase 3's pricing data
  (`computeMealPlanScore` needs spend/consumed-value figures that don't exist without
  seeded products/prices).

**DoD** ("demo preferences in → coherent 7-day plan out... respecting budget") is only
fully met for the manual Build My Week path, and only up to what Phase 3's current data
supports (no budget/cost figures yet).

## Phase 5 — Recipes + cooking mode

Recipe detail page, cooking mode with steps and timers.

**DoD:** open any planned meal and cook it end to end on a phone.

## Phase 6 — Grocery list + pantry

Pantry CRUD, list generation with pantry subtraction, categories, check off, overrides,
Use It First.

**DoD:** plan → one consolidated list, pantry-aware, with no manual copying.

## Phase 7 — Prices, optimization, Deal Radar, budget

MockGroceryProvider wired through, three optimization strategies, savings breakdown,
Deal Radar filtered to the plan, weekly budget panel.

**DoD:** the full demo scenario in `docs/product-spec.md` runs start to finish.

## Phase 8 — Polish

Empty states, loading copy, motion, error handling, responsive pass, accessibility,
README, integration test for the demo flow.

**DoD:** a stranger can run the app from a clean clone using the README alone.

---

## After MVP

P1 features in `docs/product-spec.md` (substitutions, what-can-I-make-now, cooking
load, Sunday prep, trip mode, should-I-buy-it, what-changed), then P2 (receipts, price
memory, meal graph, household mode, real providers).

## Session discipline

- Read `CLAUDE.md` + the one or two docs your phase needs. Not all of them.
- Implement, run, fix, verify. Never end a session at scaffolding.
- If you hit an unresolved decision, add it to `docs/open-questions.md` with the option
  you took — don't silently invent policy.
