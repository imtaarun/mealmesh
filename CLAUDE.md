# MealMesh — Claude Code project context

MealMesh turns "what are we eating this week?" into a finished plan, a consolidated
grocery list, and an optimized shopping trip. The differentiator is **the intelligence
layer between deciding what to eat and getting dinner on the table** — not another
recipe catalog.

Plan → Cook → Shop → Save.

## Non-negotiable rules

1. **Deterministic core, AI at the edges.** Anything involving money, quantities, or
   units is plain code with unit tests. See `docs/algorithms.md`.
   - Deterministic: unit conversion, ingredient aggregation, cost math, basket
     optimization, score computation, pantry subtraction.
   - AI: meal ideation, recipe text, substitution suggestions, natural-language
     explanations, receipt OCR interpretation, preference learning.
   - Never ask a model to add numbers. Never let a model invent a price.
2. **Never fabricate prices.** All pricing in the MVP comes from `MockGroceryProvider`
   — approximate pricing grounded in published average grocery costs, not live
   retailer data (`docs/open-questions.md` item 1) — and must render with a visible
   `Estimated pricing` badge (`EstimatedPricingBadge` in the mobile app). If a real
   provider ever fails, fall back to saved/last-known prices and say so.
3. **No retailer hard-coding.** Everything goes through the `GroceryProvider`
   interface. Same for models: everything goes through `AIProvider`.
   - `AIProvider` is Pro-only (`docs/open-questions.md` item 11). Every call site
     must check `household.subscriptionTier === 'pro'` before reaching the provider —
     in the service layer, not just the UI. Free households run on
     `packages/seed-data` alone.
4. **Finish vertical slices.** Do not scaffold 20 features. One feature working
   end-to-end (mobile UI → API → service → domain → DB → tests) beats ten stubs.
   Working software at the end of every phase in `docs/roadmap.md`.
5. **Keep code simple and readable.** Minimal straightforward implementation over
   defensive "complete" versions. No speculative abstraction, no helper layers with
   one caller, no edge-case guards for cases that can't happen yet. If a function
   needs a comment to explain its cleverness, rewrite it plainly.

## Stack

Native iOS + Android, not a web app. Locked defaults — decision and rationale in
`docs/open-questions.md` item 5; change only with a note there:

- **Mobile**: React Native + TypeScript, via Expo (Expo Router for navigation,
  NativeWind/Tailwind for styling). One codebase, both platforms.
- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL (SQLite acceptable for local
  dev). API-only — the mobile app is the only client.
- **Shared domain logic**: `packages/domain`, pure TypeScript, imported by the
  backend. This is where `docs/algorithms.md` gets implemented.
- **Monorepo**: pnpm workspaces + Turborepo.
- **Tests**: Vitest for domain/backend unit tests; a mobile e2e framework is a later
  decision, not needed before Phase 4.

If the repo already has a stack, **follow the repo**, not this file. Inspect first.

## Layout

```
apps/
  mobile/             Expo (React Native + TypeScript) — iOS + Android UI
    app/              Expo Router routes (Home, Week, Shop, Pantry, Discover, Profile)
    src/              components, theme, api client
  backend/            NestJS API
    src/
      modules/        one module per bounded context (meal-plans, pantry, ...)
      providers/
        ai/           AIProvider interface + implementations
        grocery/      GroceryProvider interface + MockGroceryProvider
      common/         Prisma service, household-scoping helpers
    prisma/           schema + migrations + seed
packages/
  domain/             pure logic: units, aggregation, optimizer, scoring — zero I/O
  config/             shared eslint/tsconfig
docs/                 this context library
```

`packages/domain` must have **zero** imports from Prisma, NestJS, React Native, or any
provider. Pure functions in, pure values out — and importable from both `apps/backend`
and `apps/mobile` unchanged. That's what makes it testable and shareable.

## Commands

```
pnpm dev:mobile      # run the Expo app (then press i / a, or scan the QR code)
pnpm dev:backend     # run the NestJS API
pnpm test            # unit tests, all packages
pnpm db:migrate      # prisma migrate dev
pnpm db:seed         # load demo recipes, stores, products, prices
```

## Doc map — read the one you need, not all of them

| File | Read when |
|---|---|
| `docs/product-spec.md` | deciding what a feature should do, and its priority |
| `docs/data-model.md` | touching the schema or entity relationships |
| `docs/architecture.md` | adding a service, API route, or provider |
| `docs/algorithms.md` | anything with units, money, or scoring — **read this first** |
| `docs/ux.md` | building screens, copy, empty/loading states |
| `docs/roadmap.md` | starting a session; tells you what to build now |
| `docs/open-questions.md` | you hit an unresolved decision — add to it, don't guess silently |

## Definition of done (whole product)

A new user can: set preferences → Plan My Week → get a coherent 7-day plan → open any
recipe → get one consolidated grocery list → see what they already own → optimize the
remaining basket → see estimated savings → start cooking. No manual copying between
screens.
