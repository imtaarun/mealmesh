# MealMesh design system

One React Native (Expo) codebase ships to iOS and Android, so the "platform file" is
the theme in `apps/mobile/src/theme/`. Tokens are platform-aware where Apple's HIG and
Material 3 differ (type scale, touch size), and identical where they agree.

| File | Holds |
|---|---|
| `src/theme/colors.ts` | Color roles × 2 palettes × light/dark |
| `src/theme/spacing.ts` | Spacing, corner radius, `minTouch`, `hairline` |
| `src/theme/typography.ts` | Type roles → SF (iOS) / Roboto (Android) |
| `src/theme/ThemeProvider.tsx` | `useTheme()`; palette switch, saved on device |
| `src/components/ui/` | `Card`, `Button`, `Pill`, `Chip`, `TextLink`, `PressableScale`, `Glass` |

Screens never use a raw hex value or a raw number for these; they read `useTheme()`.

## 1. Spacing

4pt baseline. Screen gutters are `lg` (24); content inside cards is `md` (16).

| Token | pt/dp | Use |
|---|---|---|
| `xs` | 4 | Tight label/value pairs |
| `sm` | 8 | Gaps between pills and chips; list rows |
| `smd` | 12 | Grouped controls |
| `md` | 16 | Card padding; field padding (Material's 16dp minimum) |
| `lg` | 24 | Screen gutters; gaps between sections |
| `xl` | 32 | Large section breaks |
| `xxl` | 48 | Empty states; bottom of scroll views |

The tab bar floats over content, so `Screen` adds its height to the bottom padding.

## 2. Typography

Semantic roles map to each platform's native scale. System fonts are used (San
Francisco on iOS, Roboto on Android), and text follows the user's text size setting
(Dynamic Type / font scale) by default. Nothing turns that off. Body leading is looser
than stock (25pt on iOS rather than 22) for readability. Emphasis uses Semibold
rather than Bold. Large text is tracked slightly tighter, as iOS does.

| Role | iOS (SF) | Android (M3) | Use |
|---|---|---|---|
| `display` | Large Title 34/41 Bold, −0.6 | Headline Large 32/40 Semibold, −0.4 | Home greeting |
| `title` | Title 1 28/34 Bold, −0.4 | Headline Small 24/32 Semibold, −0.2 | Screen titles |
| `heading` | Headline 17/22 Semibold, −0.2 | Title Medium 16/24 Semibold | Section and card headings |
| `body` | Body 17/25 Regular | Body Large 16/24 Regular | Running text |
| `bodyStrong` | Body 17/25 Semibold | Body Large 16/24 Semibold | Emphasis; button labels |
| `caption` | Footnote 13/18 Medium | Label Large 14/20 Medium | Metadata; pill labels; links |
| `label` | Caption 1 12/16 Semibold, +0.4 | Label Medium 12/16 Semibold, +0.5 | Overlines ("TONIGHT") |

## 3. Color tokens

**Minimal colour.** Surfaces are near-neutral (a hint of warmth or green, never
cream). Colour carries meaning only: one solid accent for the main action, a soft
accent tint for secondary actions and selection, and status colours. Lines are
almost invisible (8% of the text colour). Hierarchy comes from type and spacing,
not borders or fills.

Two palettes, each with light and dark variants, chosen by the user in **Profile →
Appearance**. Light or dark follows the system setting.

Source swatches: **Green forest** `#386641` `#6A994E` `#A7C957` `#F2E8CF` `#BC4749`;
**Autumn fall** `#6F1D1B` `#BB9457` `#432818` `#99582A` `#FFE6A7`. Each palette's
identity lives in its accent. Neutrals are only tinted towards it.

| Role | Purpose | Forest light | Forest dark | Autumn light | Autumn dark |
|---|---|---|---|---|---|
| `background` | Screen | `#F5F5F2` | `#0C0D0C` | `#F7F5F1` | `#0E0C0B` |
| `backgroundMuted` | Neutral buttons, chips, fields | `#ECECE7` | `#1F201E` | `#EEEAE4` | `#221F1C` |
| `surface` / `surfaceElevated` | Cards | `#FFFFFF` | `#181917` | `#FFFFFF` | `#1A1715` |
| `text` | Primary text | `#141513` | `#F1F2EE` | `#1A1512` | `#F5F0EA` |
| `textMuted` | Secondary text | `#62655E` | `#A4A69F` | `#6B625A` | `#ABA198` |
| `brandAccent` | Main action, links, active tab | `#2F5D3A` | `#A3C77F` | `#99582A` | `#DDA676` |
| `brandAccentPressed` | Pressed main action | `#244A2E` | `#8CB466` | `#7A4520` | `#C88E5D` |
| `onBrandAccent` | Text on `brandAccent` | `#FFFFFF` | `#11190C` | `#FFFFFF` | `#2A160A` |
| `accentTint` | Secondary actions, selected chips | `#E5EDE3` | `#1D2819` | `#F4E9DE` | `#2C2219` |
| `secondaryAccent` | Supporting accent | `#6A994E` | `#6A994E` | `#BB9457` | `#BB9457` |
| `success` | "✓ In your pantry", savings | `#3B6E2C` | `#A7C957` | `#5A6623` | `#C9BC6E` |
| `highlight` | Deals, score | `#A7C957` | `#A7C957` | `#BB9457` | `#BB9457` |
| `criticalError` | Errors, destructive actions | `#A93C3E` | `#EE9A9B` | `#6F1D1B` | `#F09A92` |
| `border` | Hairlines | text at 8% | text at 8% | text at 8% | text at 8% |
| `glassFill` | Tint over the glass blur | white 55% | `#282A26` 45% | `#FFFCF8` 55% | `#2C2622` 45% |
| `glassEdge` | Glass rim highlight | white 90% | white 16% | white 90% | white 16% |

**Contrast.** Every pair in use is checked against WCAG AA: text on backgrounds and
surfaces ≥ 7:1, and secondary text, links, accents (including on `accentTint`),
errors, and labels on accent buttons ≥ 4.5:1. All 60 pairs pass. The tightest is
Autumn light's `brandAccent` on `accentTint`, at 4.64:1. Re-run the check whenever a
token changes.

Recipe placeholders (until there are photos) are an `accentTint` →
`backgroundMuted` wash with the cuisine's initial in `brandAccent`.

## 4. Corner radius and depth

| Token | Value | Material 3 | Use |
|---|---|---|---|
| `sm` | 8 | Small | Small tags |
| `md` | 12 | Medium | Text fields |
| `lg` | 22 | Large+ | Cards, recipe images |
| `xl` | 32 | Extra Large+ | Sheets and dialogs (reserved) |
| `pill` | 999 | Full | Buttons, pills, chips, glass bars |

- **iOS:** containers use `borderCurve: "continuous"`, Apple's squircle, so corners
  ease in rather than meeting the edge at a point.
- **Android:** the same values, slightly rounder than Material 3's defaults (16/28)
  to match current Material 3 Expressive shapes.
- **Depth:** layers stack `background` → `surface` → `surfaceElevated`, separated by a
  0.5pt hairline (`hairline`) in `border`. Content has no drop shadows (only glass
  does). Android's tab bar uses Material elevation 3.
- **Liquid Glass (iOS):** `Glass` is used only on the control layer, never on
  content, and never stacked on other glass (Apple's rule). Today that means the
  floating tab bar capsule and cooking mode's Back/Next bar. On iOS 26+ it's Apple's
  native material (`GlassView` from `expo-glass-effect`). On older iOS (and web) it's
  emulated: an ultra-thin blur (`expo-blur`), a `glassFill` tint, a `glassEdge`
  hairline rim, and a soft shadow. Android gets a Material tonal surface
  (`surfaceElevated`, elevation 3) instead.

## 5. Motion

`PressableScale` wraps every card, button, pill, and chip. While pressed, it scales to
0.97 and fades to 85%, using a quick spring with no bounce, run on the native thread.
With **Reduce Motion** on, there's no animation.

## 6. Accessibility

- **Touch targets:** `minTouch` is 44pt on iOS (HIG) and 48dp on Android (Material).
  `Button`, `Pill`, `Chip`, and `TextLink` enforce it as both minimum height and
  minimum width. Icon-only or symbol pills ("−", "+", "✕") carry an
  `accessibilityLabel` ("Fewer servings", "Leave cooking mode", "Remove Henry").
  Verified by measuring every interactive element on Home, Week, Recipe, Cooking, and
  Profile in all four palette and mode variants: all are at least 48×48.
- **Roles and states:** buttons announce as buttons, links as links, and chips report
  `selected`. Disabled buttons report `disabled`.
- **Text size:** respected everywhere (see Typography).
- **Contrast:** see Color tokens.

## Components

| Component | What it is |
|---|---|
| `Card` | `surfaceElevated`, `lg` squircle, hairline border, `md` padding; presses scale if `onPress` |
| `Button` | Full-width pill, `minTouch` + 8 tall. `primary` = solid accent; `outline` = `accentTint`; `neutral` = `backgroundMuted`; `danger` = `backgroundMuted` with error text. No outlines. |
| `Pill` | Compact action at least `minTouch` × `minTouch`; same variants |
| `Chip` | Selectable option; selected = `accentTint`, accent text and a ✓ (not colour alone) |
| `Glass` | Floating control-layer container (see Liquid Glass) |
| `TextLink` | Inline text action with a full-size touch target |
| `Screen`, `BackLink`, `LoadingScreen`, `EmptyState` | Screen frame and common states |
