# Open questions and risks

Add to this file whenever you hit a decision the docs don't answer. Record the option
you took and why. Never resolve one of these silently in code.

## Decisions still needed

1. **Real price data — RESOLVED 2026-09-10: approximate pricing.** Checked whether a
   licensed flyer feed is reachable now: Flipp (`useflipp.com`) has a real API
   (`get_weekly_ads`, `search_deals`, by postal code) but it sits behind a Developer &
   Tech Partner Program — a business application with revenue-sharing terms, not a
   self-serve API key. Third-party scrapers (Apify, Actowiz, etc.) exist but scrape
   Flipp's own data in violation of Flipp's terms of service, which fails CLAUDE.md
   rule 2 ("never fabricate prices") in spirit even though the numbers would be real —
   the provenance is illegitimate. Decision: `MockGroceryProvider` uses **approximate
   pricing** — per-ingredient reference unit prices grounded in published Canadian
   average grocery costs (e.g., Statistics Canada food price data), with a small
   deterministic per-store variance (±10–15%) so a basket optimizer has something real
   to optimize across stores. This is a step up from arbitrary placeholder numbers but
   is still not live pricing.
   - **UI**: the badge CLAUDE.md rule 2 requires is renamed from "Demo pricing" to
     "Estimated pricing" — more honest about what it is now that the numbers are
     grounded rather than arbitrary. `ProductPrice.source` stays `mock` in the schema;
     "estimated" is a labeling/methodology distinction, not a new source value.
   - **Revisit later**: Flipp's partner program is the identified real path if the
     business decides to pursue it post-MVP — flagged here, not pursued now.
2. **Recipe images — RESOLVED 2026-09-10.** Local-library (seed) recipes get a
   designed gradient/pattern placeholder per cuisine — zero licensing risk, zero cost,
   matches the "warm, premium, food-focused" direction in `docs/ux.md` without
   depending on licensed stock or a generation pipeline. AI-generated recipes (Pro
   tier, see item 11) get **no image at all** — not even a placeholder — and render in
   a visually distinct, image-less card layout instead (denser, text-forward, no hero
   slot). The absence of an image is a deliberate signal that the recipe wasn't drawn
   from the vetted local library; disguising it with the same placeholder art would be
   a soft form of the fabrication CLAUDE.md rule 2 warns against. See `docs/ux.md`
   "Recipe imagery" for the two card treatments.
3. **Recipe content source.** Recipes are copyrightable as written text. Seed recipes
   must be originally written or properly licensed — do not import scraped recipe text.
4. **Name.** "MealMesh" hasn't been checked for trademark or domain availability. Do
   that before any branding work.
5. **Stack — RESOLVED 2026-09-10.** Target platform is native iOS + Android (not a
   mobile-first web app), which supersedes the original Next.js-only assumption in
   `CLAUDE.md`. Decision:
   - **Mobile**: React Native + TypeScript, via Expo (Expo Router for navigation).
     A single codebase reaches both iOS and Android — a from-scratch Swift (iOS) +
     Kotlin (Android) pair means building and maintaining every feature twice, which
     directly conflicts with rule #4 in `CLAUDE.md` ("finish vertical slices, don't
     scaffold"). React Native is the standard industry choice for small teams shipping
     to both platforms from one MVP codebase (Shopify, Coinbase, Discord, Bluesky).
   - **Backend**: NestJS + TypeScript + Prisma + PostgreSQL. NestJS's module/
     controller/service/DI structure maps directly onto the layered architecture in
     `docs/architecture.md` (API → services → domain → providers) without hand-rolled
     wiring. Plain Next.js API routes were dropped because the primary client is now
     mobile, not a web app that also needed rendering.
   - **Shared domain package**: `packages/domain` — the pure, I/O-free logic from
     `docs/algorithms.md` (units, aggregation, costing, optimizer, score) lives once,
     in TypeScript, imported by the backend. Same language end-to-end (mobile,
     backend, domain) keeps the "deterministic core, AI at the edges" rule easy to
     enforce from a single source of truth instead of re-implementing it per platform.
   - **Monorepo**: pnpm workspaces + Turborepo. pnpm was already the locked package
     manager; Turborepo is the standard pairing for a TS monorepo with multiple apps.
   Pantry/grocery-list offline access in-store (see risk #7 below) was a secondary
   factor: React Native + a synced local store (e.g. WatermelonDB/SQLite) is a well-worn
   path; a pure web app would need a heavier PWA/service-worker setup to get the same
   offline guarantee.
6. **AI cost and latency budget.** What's the acceptable per-plan token spend and
   wall-clock time? Drives how many candidates are AI-generated vs. drawn from seed
   recipes, and how aggressively to cache.
7. **Offline behaviour in-store.** Grocery Trip Mode is used in buildings with bad
   signal. Local-first list with sync, or accept online-only for MVP?
8. **Nutrition data.** Any nutrition display needs a licensed database (or a clear
   "estimated" label). Out of scope until sourced.
9. **Household conflict resolution — REFINED 2026-09-10.** Now that Free-tier users
   build their week manually (item 11), most conflict handling moves to the human
   instead of an algorithm: allergies block the selection outright (hard veto, cannot
   be added to the week); hard dislikes and soft preference mismatches surface as a
   dismissible warning at the moment of picking a dish, and the user decides. The
   original proposed rule — allergies/hard dislikes as vetoes, soft preferences
   averaged with a fairness counter — still applies specifically to the Pro-tier
   automatic "Plan My Week" path, where there is no per-slot human in the loop.
10. **Store distance and detour cost.** Needs a location source and a default trip cost
    ($6 assumed in the optimizer). Confirm or make it a user setting.
11. **Subscription tiers — RESOLVED 2026-09-10.** MealMesh ships two tiers:
    - **Free (default)**: local recipe library only (`packages/seed-data`, `Recipe.source
      = 'seed'`). No `AIProvider` calls anywhere in the request path. The weekly plan
      is **built manually** — "Build My Week": the user browses the library and picks a
      dish per day/slot themselves (replaces the auto-generate step, not the rest of
      the pipeline). Grocery list generation, pantry subtraction, basket optimization,
      Deal Radar, and the MealMesh Score are all deterministic and are **not**
      paywalled — CLAUDE.md already names aggregation and optimization as "the
      product," and gating the actual differentiator behind a paywall would contradict
      that.
    - **Pro**: everything Free has, plus `AIProvider` access — the automatic "Plan My
      Week" pipeline (AI-augmented candidates + AI-written explanation, per
      `docs/architecture.md` "Meal plan generation"), AI-generated custom recipes,
      substitution suggestions, and (P2) receipt parsing. Pro users can still use
      Build My Week manually if they want; automatic generation is additive, not a
      replacement.
    - **Enforcement**: a new `Household.subscriptionTier` field (`free` | `pro`).
      Every service method that would call `AIProvider` must check it first and never
      reach the provider for a Free household — this is a service-layer guard, not a
      UI-only restriction, so it holds even if a client is compromised or replayed.
    - **Not decided yet**: pricing of the Pro tier, trial policy, and what happens to
      an existing plan when a household downgrades from Pro to Free (kept as-is but
      frozen? AI-authored meals hidden?). Add here when it comes up.

12. **Reference price provenance — OPEN.** Item 1 calls for prices grounded in
    published Canadian averages (Statistics Canada table 18-10-0245-01, "Monthly
    average retail prices for selected products"). The Phase 3 build environment
    couldn't reach statcan.gc.ca (egress blocked), so `reference-prices.json` holds
    hand-estimated typical 2025–26 Canadian shelf prices for mainstream pack sizes,
    not figures transcribed from that table. They're plausible, but no more checked
    than that. Before showing savings figures to anyone outside the team, reconcile
    the ~50 ingredients that table covers against it; the rest (spices, tahini,
    paneer…) stay estimates. Either way the UI badge says "Estimated pricing."
13. **Which single store is "best" — OPEN.** `docs/algorithms.md` §4 says min_stores
    picks "the cheapest complete-enough single store"; `pickAnchor` in
    `packages/domain/src/optimizer` reads that as *fewest missing items first, then
    cheapest*. With real data this means a store carrying all 28 items of the demo
    week ($166.87) beats one that has the other 27 for $142.68 but is missing a jar of olives.
    best_overall then anchors on the expensive store and moves 23 of 28 items to the
    cheaper one. Arguably the missing item should cost the trip (`TRIP_COST`, $6)
    rather than disqualify the store. Left unchanged — it's a product call — and the
    seed data wasn't tuned to hide it.
14. **Purchase increment vs. pack size — OPEN.** `applyPantryAndRound` rounds every
    g/ml line up to 50 before costing, and `costLine` buys packs for that rounded
    `finalQuantity`, as documented (`packsNeeded = ceil(buyQty / packSize)`). With real
    packs smaller than the increment this over-buys: ~3 g of oregano → 50 g → two 25 g
    jars ($6.78). Once products exist, pack sizes already round the purchase, so the
    likely fix is to cost `neededQuantity` and keep the increment for display on
    lists without a product. `optimizeBasket` already takes `neededQuantity`; the
    seed-data demo-week test passes the unrounded amount. `costLine` is unchanged
    pending a decision.
15. **`PriceHistory.unitPriceCents` is an Int per base unit — OPEN.** Most unit
    prices are fractions of a cent per gram or millilitre (chicken ≈ 1.7 ¢/g, spices
    ≈ 4 ¢/g, rice ≈ 0.3 ¢/g), so an integer column rounds them to 0–2 cents and loses
    the information. Not seeded in Phase 3: `PriceHistory` records what a household
    actually paid (receipts, P2), and the seeded price timeline lives on
    `ProductPrice.effectiveFrom/effectiveTo`. Fix the unit (e.g. cents per kg/L, or a
    Float) before building receipts.

## Known gaps in the original spec

- No unit-conversion strategy, which is the hardest part of aggregation
- No definition of the score formula, only its display
- No AI cost, latency, or failure budget
- No plan-quality evaluation method (how do you know a generated week is good?)
- Feature list is ~25 features; roughly 15 are P0 in the original, which is 3–4x an MVP
- Auth, multi-tenancy, and data deletion are named but not designed
- Assumed live prices would exist; resolved to approximate pricing for MVP (item 1) —
  the "cheapest basket" promise is now honest about being an estimate, not gone

## Scope warning

The spec asks for a polished MVP with 15 P0 features in one build. That reliably
produces broad scaffolding and nothing working. The roadmap trades breadth for a
working spine: deterministic core → real data → planner → list → optimization. If
something must be cut, cut Discover, drag-and-drop, snacks, and household mode before
cutting aggregation or optimization — those two are the product.
