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
10. **Store distance and detour cost — INTERIM 2026-10-04.** Households have no location
    yet, so the optimizer treats all five demo stores as nearby (distance 0), and
    charges the default $6 for each extra stop. The Optimize screen shows savings both
    before and after that trip cost. Still open: a location source (postal code at
    onboarding is the cheapest option) and whether the trip cost becomes a setting.
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
13. **Which stores the optimizer considers — RESOLVED 2026-10-01.** The demo week
    showed `best_overall` anchoring on the one store that carried everything ($166.87
    in that run) and only ever pairing other stores *with it*, so a cheaper pair that
    left it out was never considered. A first attempt let `min_stores` pick a cheaper,
    incomplete store and charge one $6 trip for its gaps. Reverted: those gaps were
    spread across two more stores, so the "single store" answer became a three-store
    trip. Decision: `min_stores` keeps meaning fewest stores (a complete store wins,
    then cheapest). `best_overall` now tries every pair of stores within the detour
    limit and charges `TRIP_COST` for each stop after the first, including an extra
    stop for an item neither store in the pair carries. With 5 stores that's 10
    pairs — still greedy, no solver. Demo week now: one store $150.90; best pair
    $126.90.
14. **Purchase increment vs. pack size — RESOLVED 2026-10-01.** `applyPantryAndRound`
    rounded every g/ml line up to 50 and `costLine` bought packs for that rounded
    `finalQuantity`, so ~3 g of oregano bought two 25 g jars ($6.78). `costLine` now
    prices `neededQuantity` (spend and consumed value both); pack sizes do the
    rounding. `finalQuantity` stays as the rounded display quantity for list lines
    without a product. `docs/algorithms.md` §3 updated.
15. **`PriceHistory.unitPriceCents` is an Int per base unit — OPEN.** Most unit
    prices are fractions of a cent per gram or millilitre (chicken ≈ 1.7 ¢/g, spices
    ≈ 4 ¢/g, rice ≈ 0.3 ¢/g), so an integer column rounds them to 0–2 cents and loses
    the information. Not seeded in Phase 3: `PriceHistory` records what a household
    actually paid (receipts, P2), and the seeded price timeline lives on
    `ProductPrice.effectiveFrom/effectiveTo`. Fix the unit (e.g. cents per kg/L, or a
    Float) before building receipts.

16. **What Plan My Week fills — DECIDED 2026-10-01.** Dinners for all seven days,
    and — with leftover tolerance on — the next day's lunch as leftovers (each dinner
    but the last cooks double). Breakfasts and snacks are left for the user: there
    are only 3 breakfast recipes, and filling 7 breakfasts from them would mostly
    repeat eggs. Recipes gained `mealSlots` so a breakfast dish never lands on a
    dinner. Re-planning a week rewrites lunches and dinners and keeps breakfasts and
    snacks the user picked. Revisit when the library has enough breakfasts.
17. **Protein variety needs protein groups — DECIDED 2026-10-01.** The first build
    treated chicken breast, chicken thigh, and ground chicken as three proteins and
    put three chicken dinners in the demo week (and scored its variety 100).
    Ingredients gained `proteinGroup` (chicken, beef, pork, fish, shellfish, legumes,
    eggs, soy, paneer); a recipe's main protein is its first ingredient with one.
18. **AI candidates when the pool is thin — NOT BUILT.** Architecture step 2 says to
    ask the AI for extra candidates when the library is too small. A candidate is only
    usable with ingredients mapped to `Ingredient` rows (quantities, units, prices),
    which is the AI-recipe import that `RecipesService.generate` (Phase 5, Pro) will
    need anyway. Until then the planner draws from the library alone and, if it runs
    out, repeats a dish. Pro's AI use in Plan My Week today is the explanation, which
    only phrases computed numbers.
19. **Diet goals vs. restrictions — DECIDED 2026-10-01.** `healthy` and
    `high_protein` are goals: a bonus in planning, never a filter (the demo household
    is "mostly healthy"). Every other diet tag is a restriction: a recipe without it
    is never planned. A goal outweighs this week's deals: the first build re-picked
    Bacon Cheddar Burgers for the healthy demo household because three of its
    ingredients were on sale.

20. **Housemates — DECIDED 2026-10-02.** Each housemate has their own login and
    joins with a one-time invite code (8 characters, 7 days, single use). The owner
    manages the household. Members can only set their own name, allergies, and
    dislikes, and planning respects everyone's allergies and dislikes. Someone who
    already has an account can join only if they're alone in their household, which
    is then deleted (the app asks first). The owner can't leave while others remain:
    they remove housemates first, or delete their account, which hands ownership on.
21. **What "all your information" means — DECIDED 2026-10-02.** Two pages:
    *History* (weeks, meals cooked, estimated spend, scores, most-cooked dishes) and
    *Your data* (everything stored, a full JSON download through the share sheet, and
    account deletion). The download leaves out password, session, and invite hashes,
    and housemates' email addresses.
22. **Google and Apple sign-in — BUILT, keys pending.** Steps in `docs/oauth-setup.md`.
    Linking rule: a provider account signs in to the account with the same
    *verified* email. **Open:** no nonce check yet. A stolen ID token could be
    replayed within its lifetime (about an hour). Add a nonce (app generates it,
    provider embeds it, backend compares) before launch.
23. **Cost split — DECIDED 2026-10-02.** Splits the week's *estimated* grocery cost
    by each member's share weight (default 1, 0 = not paying, integer cents adding up
    exactly). It's an estimate, so it carries the Estimated pricing badge. Splitting
    real shopping trips (who paid, who owes whom) is a later feature, once Phase 6
    records actual purchases.

24. **Quantities inside step text don't scale — OPEN.** The ingredient list scales to
    the chosen servings, but step text is written for the recipe's own servings
    ("add 2 tbsp butter"). Fixing it means marking quantities up in the instructions;
    until then, cooks go by the ingredient list. Worth doing before AI recipes arrive,
    since they could be generated with markup from the start.

25. **Grocery list stays in step with the plan — DECIDED 2026-10-02.** The list is
    rebuilt from the plan and pantry every time it's opened, so editing the week never
    leaves it stale. What the shopper did carries over: ticks, "Already have", and
    their own items. A changed quantity override is cleared when the plan or pantry
    changes that line, because the old number no longer means anything. Recipe items
    can't be deleted (the plan would bring them back), so they get "Already have";
    custom items can be removed.

26. **Shopping doesn't fill the pantry yet — OPEN.** Ticking items off doesn't add
    them to the pantry. That needs "finished shopping" as a moment (and ideally
    receipts, P2). Until then the pantry is filled by hand.

27. **Which total is "the week's cost" — RESOLVED 2026-10-09.** It's **Best overall**:
    what we'd actually recommend buying, at no more than two stores. Home, Week, Shop
    and Profile all show it, and the housemate split on Week and Profile divides that
    same figure (`splitCents`, on the device). The plan's saved `estimatedCostCents`
    keeps meaning "as planned" for History and the score. The members API's own
    `weekShareCents` is no longer shown by the app.

28. **Budget swaps — DECIDED 2026-10-04.** Only shown when the week is over budget. Up to
    two, each pairing one of the priciest dinners with a different cheaper dinner the
    planner would also allow (diet, cook time, no allergy or dislike, not already this
    week). Never applied without a tap, and applying one also changes the leftover lunch
    that came from that dinner.

29. **Minimum age 16 — DECIDED 2026-10-10.** Sign-up (email, Google or Apple) asks for a
    date of birth; the server checks it and keeps only the year plus when it was
    confirmed. Under 16 gets a neutral "isn't available for you yet" with no hint of the
    limit, nothing is stored, and that phone stops offering sign-up. Accounts made before
    the check are asked once on next use; an under-16 answer there deletes the account.
    Still to do outside the code: set the age rating in App Store Connect and Google Play.

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
