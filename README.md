# MealMesh

Plan → Cook → Shop → Save. Pick the week's dinners (or let MealMesh plan them), get one
shopping list with your pantry already taken off, see the cheapest way to buy it store
by store, then cook step by step.

A native iOS + Android app (React Native, Expo SDK 57) backed by a NestJS API and
Postgres. Everything involving money, quantities or units lives in a pure TypeScript
package with unit tests (`packages/domain`). `CLAUDE.md` has the rules; `docs/` has the
spec.

## Run it from a clean clone

You need **Node 20+**, **pnpm 9** (`corepack enable` picks up the pinned version) and
**PostgreSQL 14+** running locally.

```bash
git clone https://github.com/imtaarun/mealmesh.git && cd mealmesh
pnpm install

# 1. Database and API
createdb mealmesh                                  # or point DATABASE_URL at any Postgres
cp apps/backend/.env.example apps/backend/.env     # check DATABASE_URL matches your database
pnpm --filter @mealmesh/domain build               # the API uses the compiled domain package
pnpm db:migrate
pnpm db:seed                                       # recipes, stores, prices, deals, demo account
pnpm dev:backend                                   # http://localhost:3000

# 2. The app (second terminal)
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile                                    # i = iOS simulator, a = Android, or scan the QR code
```

On a real phone, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your computer's LAN
address (e.g. `http://192.168.1.20:3000`), since `localhost` on the phone is the phone.

**Try the demo:** log in as `demo@mealmesh.app` / `mealmesh-demo` (local only). It's a
Pro household with a stocked pantry. Week → **Plan My Week** → Shop → **Optimize my cart**
→ Home → **Start cooking**.

Google and Apple sign-in need keys only the app's owner can create: `docs/oauth-setup.md`.
Email sign-in works without them.

## Commands

```bash
pnpm test         # unit tests: domain, seed data, backend
pnpm test:demo    # the demo scenario end to end against a real API + seeded database
pnpm typecheck    # every package
pnpm build        # every package (turbo builds the domain package first)
```

`pnpm lint` isn't set up yet: the packages have lint scripts but there's no ESLint config.

## What's where

```
apps/
  mobile/        Expo app — app/ is the screens (Expo Router), src/ the components, theme, api client
  backend/       NestJS API — src/modules per feature, src/providers for grocery prices and AI, prisma/
packages/
  domain/        units, aggregation, costing, basket optimizer, score, planner — no I/O
  seed-data/     the local recipe library, stores and reference prices
docs/            product-spec, architecture, data-model, algorithms, ux, roadmap, open-questions
design-system.md tokens, palettes, motion and accessibility rules
```

## Things to know

- **Prices are estimates.** They're approximate Canadian shelf prices from a mock
  grocery provider, never live retailer data, and every price in the app carries an
  "Estimated pricing" badge (`docs/open-questions.md` items 1 and 12).
- **Free vs Pro.** Free households plan by hand from the recipe library; Pro adds
  Plan My Week. Lists, pantry, optimization and deals are free for everyone.
- **Status.** All eight roadmap phases are done (`docs/roadmap.md`). Known gaps and
  decisions taken along the way are in `docs/open-questions.md`.
