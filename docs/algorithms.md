# The deterministic core

This is where the product is either real or fake. All of it lives in `lib/domain`,
takes plain values, returns plain values, and has unit tests. No AI, no I/O.

## 1. Unit normalization

Convert every recipe quantity into the ingredient's `baseUnit` before anything else.

```
mass:   g, kg, oz, lb            → g
volume: ml, l, tsp, tbsp, cup    → ml
count:  piece, clove, bunch, can → piece
```

Cross-family conversion needs ingredient data:

- volume → mass: `grams = ml * density`
- piece → mass: `grams = pieces * gramsPerPiece`
- cup → mass: `grams = cups * gramsPerCup`

If the conversion data is missing, **do not guess**. Keep the item in its original unit,
aggregate only with same-unit entries, and flag `needsReview` so the list shows
"2 bunches + 200 g" rather than a wrong number. Seed data must include conversion
factors for every ingredient used by the 30 seed recipes.

Vague units (`pinch`, `to taste`, `handful`) map to a nominal amount and are marked
`isNominal` — they appear on the list but never affect cost or optimization.

## 2. Grocery aggregation

```
demand = for each non-leftover meal:
           for each recipe ingredient:
             qty * (mealServings / recipeServings), converted to baseUnit
       → group by ingredientId → sum

needed = demand - pantryQuantity   (floor 0)
buyQty = roundUpToPurchaseIncrement(needed, ingredient)
```

Purchase increments: produce sold by count rounds to whole pieces; bulk items round to
a sensible step (e.g. 100 g). Round **after** summing, never per recipe — that's the
whole point of "1 + ½ + 2 onions = 3", not 4.

Pantry subtraction is a preview until the user confirms; keep `pantryCovered` visible
so they can override "already have".

## 3. Costing

`ProductPrice.priceCents` itself comes from `MockGroceryProvider`'s approximate
pricing (per-ingredient reference unit prices with per-store variance — see
`docs/open-questions.md` item 1), not live retailer data. Everything below is
unaffected by that — it's the same math regardless of where the price numbers came
from; only the UI's "Estimated pricing" badge changes.

Cost of an ingredient quantity = cheapest available product that satisfies it:

```
unitPrice   = product.priceCents / product.packSizeInBaseUnit
packsNeeded = ceil(buyQty / product.packSizeInBaseUnit)
lineCost    = packsNeeded * product.priceCents
```

Two numbers matter and must not be confused:
- **spend** = what you pay = `packsNeeded * price`
- **consumed value** = `buyQty * unitPrice` = what the meals actually use

Cost per serving uses consumed value. Basket totals use spend. Leftover pack quantity
is surplus, not waste, if the ingredient keeps.

Integer cents throughout. Round only at render.

## 4. Basket optimization

Input: list items with quantities, candidate products per store, store distances.
Output: three strategies.

```
minCost:   for each item, pick the cheapest product across all stores.
           Total = sum. Report the store count it implies.
minStores: for each single store, cost the whole basket
           (items it doesn't carry go to a "missing" bucket, priced at the
           cheapest elsewhere and counted as a required second stop).
           Pick the cheapest complete-enough single store.
bestOverall: start from the best single store (the anchor). For every other
           store, compute the savings from moving items whose price gap
           exceeds a threshold. Accept a second store only if
           savings > TRIP_COST (default $6, tunable) and detour ≤ maxDetourKm.
           Cap at 2 stores in the MVP.
```

Report per strategy: total, per-store breakdown, savings vs. the naive single-store
basket, and the **top 3 items driving the savings** — that's the line the demo needs
("most of your savings come from chicken, tomatoes, yogurt, and rice").

Also handle: item unavailable at a store, minimum purchase quantities, loyalty price
variants (treat as a separate ProductPrice with a flag). Never assume availability.

Greedy is correct enough here. Don't build an ILP solver for a 25-item basket.

## 5. "Should I buy it?" (P1)

Recommend the larger pack when:
`largerPackUnitPrice < currentUnitPrice` **and**
`expectedUseWithinShelfLife ≥ ~70% of pack` — where expected use = this week's demand
plus historical usage of the ingredient. Otherwise recommend the smaller pack and say
why (waste, shelf life). Always show both unit prices.

## 6. MealMesh Score

Fixed weights, deterministic, 0–100 each, then weighted total.

| Sub-score | Weight | Basis |
|---|---|---|
| Budget | 0.25 | planned spend vs. budget; 100 at ≤85% of budget, 0 at ≥125% |
| Ingredient efficiency | 0.25 | share of ingredients used in ≥2 meals, weighted by cost |
| Waste reduction | 0.20 | consumed value ÷ spend, plus credit for expiring-item use |
| Convenience | 0.15 | total active cook minutes vs. preferences, weighted by busy days |
| Variety | 0.15 | distinct proteins, cuisines, and cooking methods across the week |

Total = round(Σ weight × sub-score). The explanation is AI-written **from these
numbers** and must reference a concrete cause in the plan, not a generic compliment.

The score must be stable: same plan in, same number out. Snapshot-test it.

### Exact formulas (implemented in `packages/domain/src/score`)

The table above names what each sub-score is based on but not the formula; these are
the formulas actually implemented — change this section if the implementation changes,
they must never drift apart.

- **Budget** — `ratio = spendCents / budgetCents`. 100 at `ratio ≤ 0.85`, 0 at
  `ratio ≥ 1.25`, linear between.
- **Ingredient efficiency** — `(cost of ingredients used in ≥2 meals) / (total
  ingredient cost) × 100`.
- **Waste reduction** — `min(100, consumedValueCents/spendCents × 100) × 0.8`, plus up
  to 20 points of credit for `expiringItemsUsed / expiringItemsTotal`.
- **Convenience** — average active cook minutes per meal vs.
  `preferredMaxCookMinutes`; 100 if at or under, otherwise a penalty scaled by how far
  over and multiplied by `1 + busyDayCount × 0.1` (running over hurts more on a busier
  week).
- **Variety** — average of `distinctProteins`, `distinctCuisines`, and
  `distinctCookingMethods`, each scored against a target of 3 (100 at 3 or more).

## 7. "What changed?" (P1)

On any edit, recompute cost, unused-ingredient count, cook minutes, and score against
the pre-edit snapshot, and show the deltas. No AI needed — it's arithmetic on two
computed plans.

## Test cases to write first

- `1 onion + ½ onion + 2 onions = 3 onions`
- `200 g spinach + 1 bunch spinach` with `gramsPerPiece` known → single g figure
- same, with `gramsPerPiece` unknown → two lines, `needsReview`
- pantry has 500 g rice, week needs 400 g → rice absent from list
- leftover meal adds zero demand
- pack rounding: needs 200 g parmesan, only 500 g pack → spend = 1 pack,
  consumed value = 200 g worth
- two-store split rejected when savings < trip cost, accepted when above
- score is identical across two runs of the same plan
