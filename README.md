# MealMesh

Plan → Cook → Shop → Save. See `CLAUDE.md` for the product summary and rules, and
`docs/` for the full spec (product, data model, architecture, algorithms, UX, roadmap,
open questions).

Native iOS + Android app (React Native/Expo) backed by a NestJS API, with a shared
pure-TypeScript domain package for the deterministic logic (unit conversion,
aggregation, costing, basket optimization, scoring). Why this stack: `docs/open-questions.md` item 5.

## Repo layout

```
apps/
  mobile/     Expo (React Native + TypeScript) — iOS + Android
  backend/    NestJS API + Prisma
packages/
  domain/     pure domain logic, shared, zero I/O
  seed-data/  local recipe/ingredient library (food content, not pricing)
  config/     shared eslint/tsconfig
docs/         product spec, architecture, data model, algorithms, ux, roadmap
```

## Prerequisites

- Node 20+
- pnpm 9+ (`corepack enable` will pick up the version pinned in `package.json`)
- PostgreSQL running locally (or a `DATABASE_URL` pointing at one) for the backend
- Expo Go app on a phone, or an iOS Simulator / Android Emulator, for the mobile app

## Getting started

```bash
pnpm install

# backend
cp apps/backend/.env.example apps/backend/.env   # fill in DATABASE_URL
pnpm db:migrate
pnpm db:seed           # writes packages/seed-data's ingredients + recipes; no pricing yet
pnpm dev:backend       # http://localhost:3000

# mobile (separate terminal)
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile        # press i for iOS simulator, a for Android, or scan the QR code
```

## Common commands

```bash
pnpm test         # unit tests across all packages (packages/domain today)
pnpm lint         # lint all packages
pnpm typecheck    # typecheck all packages
pnpm build        # build all packages (turbo)
```

`packages/domain` ships compiled (`main`/`types` point at `dist/`, gitignored) rather
than as raw TypeScript — the compiled backend's `node dist/main.js` can't `require()`
a `.ts` file the way `vitest`/Metro/`nest start` can. `pnpm build` at the root builds
it first automatically (Turborepo's dependency graph); if you ever build a single
package directly with `pnpm --filter <app> build`, build `@mealmesh/domain` first or
`apps/backend/dist` will reference a stale/missing `packages/domain/dist`.

## Current state

Phases 0-2 are done, Phase 3 is partial, and Phase 4 is split by subscription tier
(`docs/open-questions.md` item 11) — the Free/manual path (**Build My Week**) is done,
the Pro/AI path (**Plan My Week**) is not. Nothing described below is scaffolding —
every item was typechecked, built, and exercised end-to-end over real HTTP against a
real local Postgres database, not just trusted to compile. Full detail in
`IMPLEMENTATION_PLAN.md`; phase-by-phase status in `docs/roadmap.md`.

**Working right now:**
- **Auth**: signup, login, session tokens (bcrypt passwords, SHA-256 token hashing,
  30-day expiry), household-scoped `AuthGuard` on every route except signup/login.
- **Onboarding**: one screen, account + household + every preference, per
  `docs/product-spec.md` "one short flow."
- **`packages/domain`**: all five modules for real (unit conversion, aggregation,
  costing, the basket optimizer's three strategies, the MealMesh Score) plus a
  conflict-checker (allergy hard block, dislike soft warning). 34 tests, all passing,
  each traceable to a `docs/algorithms.md` test case.
- **Seed data**: 101 ingredients + 15 recipes (of the P0 target of 30) from
  `packages/seed-data`, seeded into Postgres and idempotent to re-run.
- **Build My Week**: browse the local recipe library, pick a dish per day/slot, get
  blocked on an allergy match, get warned (with a confirm-to-override) on a dislike
  match, mark a slot as leftover of an earlier meal — all working on both the API and
  in the mobile UI (onboarding → Week grid → recipe picker).

**Not built yet**: Plan My Week (Pro/AI auto-generate), score display in the UI (needs
Phase 3's pricing data first), the remaining 15 recipes, all store/product/price/deal
seed data, and `pnpm lint` (no `eslint.config.js` exists yet despite every package
having a `lint` script — a known gap, not yet fixed).

<details>
<summary>Real bugs caught by actually building and booting, not just typechecking</summary>

- `AiProviderModule` / `GroceryProviderModule` weren't `@Global()`, so NestJS couldn't
  resolve `AI_PROVIDER`/`GROCERY_PROVIDER` in modules that inject them — TypeScript
  can't catch DI wiring errors, only booting the app does.
- `ValidationPipe` needs `class-validator`/`class-transformer` as real dependencies,
  not just `@nestjs/common`.
- NativeWind on pnpm needs `metro.config.js` wrapped with `withNativeWind`, and
  `react-native-css-interop` must be a **direct** dependency of `apps/mobile` (pnpm's
  strict hoisting won't symlink it in otherwise) — `nativewind` is pinned to an exact
  `4.1.23` because `^4.1.23` resolved to `4.2.6`, which pulls a `react-native-css-interop`
  that hard-requires the still-unstable `react-native-worklets/plugin`.
- `packages/domain`'s `package.json` pointed `main` at TypeScript source, which works
  for vitest/Metro/`nest start` but not the compiled backend's plain `node dist/main.js`
  — fixed with a real `tsc` build step outputting to `dist/`.
- Two more pnpm-strict-hoisting cases, same shape as the NativeWind one:
  `@react-navigation/native` (for `useFocusEffect`) and `@babel/runtime` (async/await
  transform helpers) both had to become direct `apps/mobile` dependencies.

</details>
