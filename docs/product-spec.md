# Product spec

Priorities: **P0** = MVP, must work in the demo. **P1** = next. **P2** = later, design
for it but don't build it.

## The user's problem

"I need to figure out what we're eating this week, what we need, what I already have,
and where to buy it without overspending." One product answers all four.

## Subscription tiers

Full rationale in `docs/open-questions.md` item 11. Short version:

- **Free** (default): the local recipe library only, no AI anywhere. The week is
  assembled by hand — "Build My Week" — but everything downstream of a chosen set of
  meals (grocery list, pantry subtraction, basket optimization, Deal Radar, MealMesh
  Score) is fully deterministic and works exactly the same as it does for Pro. This is
  the actual product; it is not a crippled trial.
- **Pro**: adds AI — one-tap "Plan My Week" auto-generation, AI-generated custom
  recipes beyond the library, substitution suggestions, and (P2) receipt parsing.
  Build My Week still works for Pro users; Plan My Week is additive.

Nothing money- or quantity-related ever differs by tier — that would violate the
deterministic-core rule in `CLAUDE.md`. Tiering only ever gates AI.

## P0 — MVP features

### Onboarding + preferences
Household size (adults/children), meals per day, cuisines liked, foods disliked,
allergies, dietary restrictions, cooking skill, max cooking time, leftover tolerance,
busy days / eat-out days, weekly budget or tier (Budget / Balanced / Premium).
Keep it to one short flow; every question must change the output.

### Weekly planner
7-day grid, slots for breakfast / lunch / dinner / optional snack. Meal card shows:
dish name, prep time, difficulty, approx cost per serving, major ingredients, dietary
tags, plus an image (local-library card) or the image-less AI card (see
`docs/ux.md` "Recipe imagery" — imagery depends on where the recipe came from, not on
tier). Example: `Creamy Garlic Chicken Pasta — 25 min · Easy · ~$3.80/serving`.

Actions P0: replace, skip, mark as leftover, manually add. "Regenerate" means
different things per tier — Free re-picks from the library (same as replace); Pro can
also ask the AI for a fresh candidate. Both write to the same grid.
Actions P1: drag and drop, duplicate, move.

### Build My Week (Free and Pro)
The default way to fill the grid: browse the local recipe library (filterable by
cuisine, diet tag, prep time, ingredient-on-hand match) and pick a dish per slot by
hand. Conflicts surface at the moment of picking, not after: an allergy match blocks
the pick outright; a disliked ingredient or a repeat-heavy week shows a dismissible
warning the user can accept or back out of. No AI involved — this is deterministic
browse-and-pick, so it works identically on Free and Pro.

### Plan My Week (Pro only)
Generates the whole week as **one system**, not seven independent recipes, with a
single tap. Optimizes for: ingredient reuse, whole-package quantities, leftovers,
cooking time vs. busy days, nutritional and cuisine variety, cost, pantry contents,
waste, current deals.

Mechanics in `docs/architecture.md` (candidate-set + constrained selection, not a
single "give me a week" prompt). Gated on `Household.subscriptionTier === 'pro'` at
the service layer — see `docs/open-questions.md` item 11.

### Recipe detail + cooking mode
Hero image, servings, prep/cook/total time, difficulty, ingredients, instructions,
estimated cost, substitutions. Cooking mode: one large step at a time, `STEP 3 OF 7`,
prev/next, timers on timed steps, screen stays awake.

### Grocery list
Generated from the plan. **Normalize and aggregate** — never concatenate recipe
ingredients. `1 onion` + `1/2 onion` + `2 onions` → `Onions — 3`. Subtract pantry.
Group by shopping category (Produce, Meat & Seafood, Dairy, Pantry, Frozen, Other).
Users can check off, adjust quantity, remove, add custom, mark "already have".

### Pantry
Manual add/edit across pantry / fridge / freezer, with quantity and optional expiry.
"Use It First": if something expires soon, surface meals that consume it —
`🥬 Use your spinach tonight — 3 meals use it`.

### Mock stores, products, prices
5 stores, ~150 products, multiple prices per product, deals, price history. Prices are
approximate — grounded in published Canadian average grocery costs, not live
retailer data (`docs/open-questions.md` item 1) — and every price renders with an
"Estimated pricing" badge. See `docs/data-model.md` and seed requirements below.

### Basket optimization
Whole-basket, not per-item. Three answers: **Minimize Cost**, **Minimize Driving**,
**Best Overall** — showing cheapest single-store basket vs. best two-store split, with
estimated savings and which items drive them. Algorithm in `docs/algorithms.md`.

### Deal Radar
Only deals that touch this week's plan. Format: item, store, % off, quantity you need,
regular vs. sale total, savings, and how many meals use it.

### Weekly budget
Planned spend vs. budget vs. remaining. Suggestions are advisory, never automatic:
"You can save $8.40 by replacing salmon with chicken on Friday." User controls the
tradeoff — never silently optimize away a stated preference.

### MealMesh Score
0–100 with five sub-scores (budget, ingredient efficiency, waste reduction,
convenience, variety) and a one-line human explanation naming the actual cause:
"cheaper than usual because Tuesday's roasted vegetables become Wednesday's lunch."
Formula is fixed and deterministic — see `docs/algorithms.md`. The explanation is the
only AI part.

### Leftovers
Leftovers are first-class meals. A leftover slot consumes an earlier cook's surplus
servings, adds nothing to the grocery list, and reduces cooking load. Show
"Tuesday lunch is already paid for."

## P1

- Substitutions with explained tradeoffs ("Greek yogurt makes the sauce tangier but
  stays creamy")
- "What can I make right now?" — pantry match %, bucketed by time available
- Weekly cooking load strip (easy/medium/heavy per day) + "Make Thursday easier"
- Smart Sunday prep session with estimated time saved
- Grocery Trip Mode: in-store checklist, per-store, sorted by category then aisle
- "Should I buy it?" package-size reasoning (needed qty, package size, unit price,
  expected future use, shelf life)
- "What changed?" — after any edit, show delta in cost, unused ingredients, cook time,
  and score

## P2

- Receipt photo → store, items, quantities, prices, discounts, total → updates pantry
  and price history
- Personal price memory ("eggs are 40% above your normal price")
- Meal Graph visualization of ingredient/leftover flow
- Household mode: multiple members, ❤️/👍/👎 votes, automatic conflict resolution
- Barcode scanning, photo food recognition
- Real retailer/flyer providers

## Seed data requirements (P0)

30 recipes, 100 ingredients, 5 stores, 150 products, multiple prices per product,
deals, price history, one sample pantry. Canadian pricing and terminology. Recipes must
be chosen so ingredient reuse is genuinely possible — a random 30 will make the
optimizer look broken.

## Demo scenario the product must nail

2 people · mostly healthy · Indian + Mediterranean + North American · max 35 min ·
$120/week · prefers leftovers · dislikes mushrooms.

Plan My Week → coherent week → View Grocery List → aggregated list with pantry
subtracted → Optimize My Cart → `$117.40 → $103.80, save $13.60` → "most of your
savings come from chicken, tomatoes, yogurt, and rice" → open Monday dinner → cooking
mode. Seamless, no dead ends.

## Product philosophy

Less thinking. Less waste. Less overspending. More good meals. Between two UX options,
pick the one that removes work from the user.
