# Build roadmap

One phase ≈ one Claude Code session. **Each phase ends with the app running and its
own tests passing.** Do not start a phase before the previous one's DoD is met. Update
the status line below as you go.

**Current phase: 6** (Phases 0-5 done. See `IMPLEMENTATION_PLAN.md`.)

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
onboarding → landing works end-to-end over real HTTP.

## Phase 2 — The deterministic core — DONE

`packages/domain`: unit conversion, aggregation, costing, basket optimizer, score, plus
a conflict-checker (allergy/dislike matching) added for Phase 4's Build My Week.
Written against `docs/algorithms.md`; exact score formulas now documented there too.

**DoD met:** 34 tests across 6 files pass (`pnpm --filter @mealmesh/domain test`),
covering every documented test case in `docs/algorithms.md`.

## Phase 3 — Seed data — DONE

All in `packages/seed-data`, written to Postgres by `apps/backend/prisma/seed.ts`
(idempotent — verified by running it twice and comparing row counts):

- 30 recipes (Indian, Mediterranean, North American, plus a few Chinese/Mexican
  weeknight dishes and three breakfasts), chosen for ingredient reuse. 101 ingredients,
  every recipe line converting cleanly to its base unit (now enforced by
  `validateSeedData`).
- 5 fictional Toronto stores (mainstream, discount, premium, South Asian specialty,
  neighbourhood), 432 products, 879 price rows (a previous and a current regular
  price per product, plus sale rows), 15 active deals. Approximate pricing: one
  reference pack + price per ingredient (`reference-prices.json`), times a per-store
  factor with a deterministic per-product deviation (`catalog.ts`). See
  `docs/open-questions.md` items 1 and 12.
- One demo account (`demo@mealmesh.app` / `mealmesh-demo`, local dev only) set up as
  the `docs/product-spec.md` demo scenario, with a 28-item sample pantry including
  items about to expire.
- `MockGroceryProvider` implemented against those tables.

**DoD met:** 10 seed-data tests pass, including a realistic demo week run through the
real aggregation → pantry → optimizer pipeline: one store $150.90 → best two stores
$126.90, top savings from chicken thighs, yogurt, and red lentils. (The Phase 3 notes
first quoted $166.87 → $143.27, which came from an exploratory week with an extra
breakfast, not the week the test runs, and from the optimizer before items 13 and 14
in `docs/open-questions.md` were resolved.)

## Phase 4 — Planner UI + Plan My Week — DONE

Per `docs/open-questions.md` item 11, this phase forked into two paths:

- **Build My Week (Free + Pro) — DONE.** Onboarding (one-screen form: account,
  household, every preference), manual weekly grid, recipe library browser
  (`GET /api/recipes`, filterable), pick/replace/skip/leftover actions, allergy hard
  block + dislike soft warning with confirm-to-override — all built and verified
  end-to-end against a real backend and real seeded recipes (signup → onboard → browse
  → pick → conflict-blocked → conflict-confirmed → leftover, all over real HTTP).
  Recipe imagery: per-cuisine gradient placeholder, per `docs/ux.md`.
- **Plan My Week (Pro) — DONE.** `POST /api/meal-plans/generate` and
  `.../meals/:mealId/regenerate`, Pro-gated in the service (403 for Free). Greedy
  selection in `packages/domain/src/planner` (weights in `docs/algorithms.md` §6b),
  leftovers, eat-out days, and a stored MealMesh Score with an AI-phrased explanation.
  Fills dinners and leftover lunches (`docs/open-questions.md` items 16–19). Week
  screen: Plan My Week / Build it myself, "Balancing your week…", the retry error, a
  summary card (`N meals planned · $X estimated · score/100` + Estimated pricing
  badge), leftover and eat-out cards, New pick on each dinner.

**DoD met:** for the demo household, seven different dinners within 35 minutes, no
mushrooms, at least 5 healthy, 4+ protein groups, spinach and yogurt used before they
expire, six leftover lunches; over HTTP it came to $91.91 estimated against the $120 budget,
scoring 76/100 — enforced by
tests in `packages/seed-data`, and run end-to-end over HTTP and in the app.

## Phase 4b — Accounts and housemates — DONE

Added before Phase 5 at the product owner's request: sign in with Google and Apple
(code done; keys pending, `docs/oauth-setup.md`), a welcome screen with email log-in
(there was none — signing out was a dead end), profile setup, housemates with their
own logins and invite codes, the week's estimated cost split by share, History, Your
data (download + delete account). `docs/open-questions.md` items 20–23.

**DoD met:** 37-step HTTP run (sign-in, linking, invites, permissions, planning around
a housemate's allergy, split, history, export, join, leave, delete) and a two-person
run in the app; 9 token-check tests, 5 split tests.

## Phase 5 — Recipes + cooking mode — DONE

Recipe detail page, cooking mode with steps and timers.

- **Recipe page**: cuisine image, total/prep/cook time, difficulty, diet tags; a
  servings stepper that scales every quantity (`formatQuantity` in
  `packages/domain/src/display`: "1½ cups", "285 g", "a pinch") and the cost; cost per
  serving and in total, with the Estimated pricing badge; "✓ In your pantry" on what
  the household has; steps with their timers.
- **Cooking mode**: full screen, `STEP 3 OF 7`, large type, Back/Next at the bottom,
  a countdown on timed steps that keeps running between steps (shown as a chip) and
  vibrates at zero, screen kept awake, ✕ back to where you came from.
- **Ways in**: every planned meal on Week ("View recipe ›"; leftovers say "just
  reheat"), and a **Tonight** card on Home with Start cooking.
- Ingredient substitutions stay with the P1 list (product-spec "After MVP"; they need
  the AI).

**DoD met:** in a phone-sized browser: plan the week → Home shows tonight's dinner →
recipe → 4 → 6 servings (300 g → 450 g lentils, $2.52 → $3.78) → cooking mode →
timer counts down and keeps running on the next step → ✕ back. Not yet on a real
phone (vibration and keep-awake only work there).

## Phase 6 — Grocery list + pantry — DONE

- **Shop**: one list built from the week (`buildGroceryList`): summed across recipes,
  pantry subtracted, rounded to what you can buy. Produce comes in whole pieces
  ("Yellow Onion — 4"). Grouped Produce → Meat & Seafood → Dairy → Pantry → Frozen →
  Other. Tick items off; tap one for −/+ (in purchase steps), "Already have", or
  "Reset". Add your own items ("Paper towels"). An **Already have** section shows what
  the pantry covers, with "Buy anyway". The list follows the plan: change a dinner and
  it updates, keeping your ticks (open-questions item 25).
- **Pantry**: Fridge / Freezer / Pantry, add by searching ingredients, amounts in
  pieces for produce, optional use-by (3 days to 1 month), edit and remove. Expired
  items don't count against the list.
- **Use It First**: anything expiring within 3 days, with the recipes that use it
  (never ones that break an allergy), linking to the recipe page.

**DoD met:** in a phone-sized browser: three dinners planned → Shop shows one list
with one onion line → tick garlic, + an onion, add paper towels → Pantry: add 2 kg
lentils and 2 onions expiring in 3 days → Use It First card appears → back on Shop,
lentils and onions sit under Already have → "Buy anyway" puts lentils back. Plus 33
HTTP checks, including that another household can't see or change any of it.

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
