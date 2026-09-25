# UX and design direction

## Feel

Modern, warm, premium, approachable, food-focused, intelligent. Generous spacing,
prominent food imagery, tactile cards. It should make the user want to cook.

Avoid: enterprise dashboard chrome, heavy gradients, futuristic "AI" visuals, clutter,
animation for its own sake, emoji as a substitute for design.

Native mobile app (iOS + Android). Every screen must work one-handed, reachable with a
thumb, on a phone held one-handed — there is no desktop layout to fall back to.

## Navigation

`Home` · `Week` · `Shop` · `Pantry` · `Discover` · `Profile`

- **Home** — today's meals + quick actions
- **Week** — the planner
- **Shop** — grocery list + optimization + Deal Radar
- **Pantry** — fridge / freezer / pantry
- **Discover** — recipes and ideas (thin in MVP)
- **Profile** — preferences, household, budget, stores

## Home screen tells a story

```
Good afternoon 👋

Tonight
Creamy Garlic Chicken Pasta
25 min · Easy
[Start Cooking]

This Week
6 meals planned · $87 estimated · 89/100

Smart Suggestions
🥬 Use spinach tonight
🔥 Chicken is on sale nearby
🍝 You already have 72% of tomorrow's ingredients
```

Each suggestion is generated from real computed state — expiring pantry items, deals
intersecting the plan, pantry coverage. Never show a suggestion the system can't back
with a number.

## Loading states do work

Replace "Loading…" with what's actually happening:
"Comparing your ingredients…" · "Building your grocery list…" · "Looking for
better-value options…" · "Balancing your week…" · "Finding ways to use leftovers…"

Meal generation takes seconds — stream or stage the reveal (days filling in one by one)
rather than blocking on a spinner.

## Empty states

- Pantry: "Your pantry is looking suspiciously empty." → `[Add items]`
- Week (Free): "Seven days. Zero decisions." → `[Build My Week]`
- Week (Pro): same copy, two actions — `[Plan My Week]` (primary, AI auto-fill) and a
  smaller `Build it myself` link to the same manual flow Free users get. Pro never
  loses the manual path.
- Grocery list: "Your shopping list appears when your meals do."
- Deal Radar with no relevant deals: "Nothing on sale that you actually need this
  week. That's a good week."

## Errors

- AI failure (Pro only): "Meal planning took a wrong turn. Let's try again." + retry
- Pricing unavailable: "We couldn't check prices, so we're using your saved prices."
  with the date of those prices
- Never render fabricated live data. Estimated pricing always carries an "Estimated
  pricing" badge (`docs/open-questions.md` item 1 — grounded in published average
  grocery costs, not live retailer data).

## Motion

Subtle only, and only on: checking a grocery item, plan generation, swapping a meal,
cart optimization result, completing a cooking step. Respect
`prefers-reduced-motion`.

## Cooking mode

Full screen, one step, large type, high contrast, thumb-reachable prev/next, inline
timer on timed steps, keeps the screen awake, exits back to where you were.

## Copy rules

Speak like a competent friend, not a marketing page. State numbers, name causes.
"Tuesday lunch is already paid for" beats "Optimized leftover utilization". Never claim
savings the optimizer didn't compute.

## Recipe imagery

Resolved in `docs/open-questions.md` item 2 — two distinct, deliberately different
card treatments, chosen by where the recipe came from (`Recipe.source`), not by tier:

- **Local library** (`source: 'seed'` or `'user'`): a designed gradient/illustration
  placeholder per cuisine — no licensed stock, no photo generation pipeline, no
  hotlinked images ever. Image-forward card: large image area, title and meta
  (time · difficulty · cost) below it, matching the "prominent food imagery" feel in
  `Feel` above.
- **AI-generated** (`source: 'ai'`, Pro only): **no image, not even a placeholder.**
  A visually distinct, denser, text-forward card — no image slot at all, larger title
  type to fill the space a photo would have taken, tags and meta more prominent. The
  goal is for the absence of a photo to read as intentional and honest, not broken —
  do not reuse the cuisine placeholder here, that would imply it's a vetted library
  dish when it isn't. A small "Custom recipe" label in the card header makes the
  distinction explicit without leaning on "AI" branding (`Feel` above: avoid
  futuristic AI visuals).

Never hotlink scraped photos, and never generate a photo-realistic image and present
it as if it depicts the actual dish — that would be a fabrication, same category of
mistake as inventing a price.

## Build My Week (Free and Pro manual flow)

Browsing and picking is the default interaction, not a fallback — design it as a real
flow, not an afterthought bolted onto the auto-generate button:

- Library browse view: filter by cuisine, diet tag, prep time, "uses what I have."
  Cards use the local-library imagery treatment above.
- Picking a dish for a slot that conflicts with a hard constraint (allergy) is
  blocked at the tap — don't let it into the grid, explain why in one line.
- Picking a dish that conflicts with a soft preference (dislike, third chicken dinner
  this week) shows a dismissible inline warning at the moment of picking, not a
  after-the-fact review screen — "Sam doesn't usually go for mushrooms — add anyway?"
  State the actual cause, per `Copy rules` below.
