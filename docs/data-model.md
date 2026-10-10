# Data model

## The three ideas that make the model work

1. **Ingredient is canonical; RecipeIngredient is messy.** A recipe says "1 large
   onion, diced". That parses into `ingredientId: onion, quantity: 1, unit: piece,
   note: "diced"`. Aggregation happens on `ingredientId`, never on the text.
2. **Ingredient carries conversion data.** `gramsPerPiece`, `gramsPerCup`, `density`.
   Without this you cannot add "1 onion" to "200g onion", and the whole grocery list
   falls apart. See `docs/algorithms.md`.
3. **Product ≠ Ingredient.** A Product is a purchasable SKU at a store ("No Name
   Yellow Onions 3lb bag"). It maps to an Ingredient with a pack size in the
   ingredient's base unit. Prices attach to Products, never to Ingredients.

## Entities

**User** — id, email, passwordHash? (null when the account only uses Google or Apple),
createdAt, householdId, birthYear?, ageConfirmedAt? (only the year is kept, never the full
date of birth; both null on accounts from before the 16+ check, `docs/open-questions.md`
item 29)

**OAuthAccount** — id, userId, provider (`google` | `apple`), subject (the provider's
stable user id), email?, createdAt. Unique on (provider, subject).

**HouseholdInvite** — id, householdId, codeHash (only the hash of the 8-character
code is stored), expiresAt (7 days), createdByUserId, acceptedAt?, acceptedByUserId?

**Household** — id, name, weeklyBudgetCents, budgetTier, defaultServings, timezone,
subscriptionTier (`free` | `pro` — gates `AIProvider` access, see
`docs/open-questions.md` item 11; unrelated to `budgetTier`, which is a grocery-spend
preference)

**HouseholdMember** — id, householdId, name, isChild, userId?, role (`owner` |
`member`), costShare (weight in the cost split; 0 = not paying), profileCompletedAt?
(null until profile setup is done). Every user has exactly one member row.

**Preference** — id, householdId | memberId, type (`cuisine_like`, `dislike`,
`allergy`, `diet`, `skill`, `max_cook_minutes`, `leftover_tolerance`, `busy_day`,
`eat_out_day`), value, weight

**Ingredient** — id, name, aliases[], category (shopping aisle), baseUnit (`g` | `ml` |
`piece`), gramsPerPiece?, gramsPerCup?, density?, shelfLifeDays?, isStaple,
proteinGroup? (`chicken` for breast, thigh, and ground chicken alike; `legumes`,
`eggs`, … — what Plan My Week varies; null for non-proteins)

**Recipe** — id, title, imageUrl, servings, prepMinutes, cookMinutes, difficulty,
cuisines[], dietTags[], mealSlots[] (which slots the dish suits — default lunch and
dinner), instructions (ordered steps with optional `timerSeconds`),
source (`seed` | `ai` | `user`), nutrition?

**RecipeIngredient** — id, recipeId, ingredientId, quantity, unit, note?, optional

**MealPlan** — id, householdId, weekStartDate, status, scoreId, estimatedCostCents

**Meal** — id, mealPlanId, date, slot (`breakfast`|`lunch`|`dinner`|`snack`),
recipeId?, servings, type (`cook` | `leftover` | `eat_out` | `skip`),
leftoverOfMealId?, customTitle?

**PantryItem** — id, householdId, ingredientId, quantity, unit, location
(`pantry`|`fridge`|`freezer`), expiresAt?, addedAt

**GroceryList** — id, mealPlanId, generatedAt, status

**GroceryListItem** — id, groceryListId, ingredientId? (null for custom items),
customName?, neededQuantity, unit, pantryCovered, finalQuantity, category, checked,
isCustom, isNominal ("to taste": no quantity), alreadyHave, userOverrideQuantity?

**Store** — id, name, chain, address, lat, lng, isDemo

**Product** — id, storeId, ingredientId, name, brand, packSize, packUnit, imageUrl?

**ProductPrice** — id, productId, priceCents, effectiveFrom, effectiveTo?, isSale,
regularPriceCents?, source (`mock` | `receipt` | `provider`)

**Deal** — id, storeId, productId, discountPercent, startsAt, endsAt, description

**ShoppingOptimization** — id, groceryListId, strategy
(`min_cost`|`min_stores`|`best_overall`), totalCents, storeBreakdown (json),
unavailableItems[], computedAt

**Receipt** (P2) — id, householdId, storeId?, imageUrl, purchasedAt, totalCents,
parseStatus

**ReceiptItem** (P2) — id, receiptId, rawText, productId?, ingredientId?, quantity,
priceCents

**PriceHistory** — id, householdId, ingredientId, unitPriceCents, storeId?,
observedAt, source

**MealRating** — id, memberId, recipeId, rating (`love`|`fine`|`no`), createdAt

**MealPlanScore** — id, mealPlanId, total, budget, ingredientEfficiency,
wasteReduction, convenience, variety, explanation

## Invariants

- **Money is integer cents.** No floats anywhere near a price. Format only at render.
- **Quantities are stored in the ingredient's `baseUnit`** on GroceryListItem and
  PantryItem. Recipe input units are converted on the way in. One exception: produce
  sold by count (`soldByCount`) is listed in `piece`, so "Onions — 3", not "450 g".
- A `leftover` Meal must reference `leftoverOfMealId`, contributes **zero** grocery
  demand, and its source meal must have cooked servings ≥ combined consumption.
- `neededQuantity` is what's left after the pantry; `finalQuantity =
  roundUp(neededQuantity)` to a sensible purchase increment for the ingredient.
- Allergies are hard filters. Dislikes are soft (heavy penalty). Never trade an allergy
  for cost or score.
- Every ProductPrice row carries `source`. UI must be able to tell demo pricing from
  real pricing at any time.
