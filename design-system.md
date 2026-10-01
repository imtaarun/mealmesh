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
| `src/components/ui/` | `Card`, `Button`, `Pill`, `Chip`, `TextLink`, `PressableScale` |

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
rather than Bold.

| Role | iOS (SF) | Android (M3) | Use |
|---|---|---|---|
| `display` | Large Title 34/41 Bold | Headline Large 32/40 Semibold | Home greeting |
| `title` | Title 1 28/34 Bold | Headline Small 24/32 Semibold | Screen titles |
| `heading` | Headline 17/22 Semibold | Title Medium 16/24 Semibold | Section and card headings |
| `body` | Body 17/25 Regular | Body Large 16/24 Regular | Running text |
| `bodyStrong` | Body 17/25 Semibold | Body Large 16/24 Semibold | Emphasis; button labels |
| `caption` | Footnote 13/18 Medium | Label Large 14/20 Medium | Metadata; pill labels; links |
| `label` | Caption 1 12/16 Semibold, +0.4 | Label Medium 12/16 Semibold, +0.5 | Overlines ("TONIGHT") |

## 3. Color tokens

Two palettes, each with light and dark variants, chosen by the user in **Profile →
Appearance**. Light or dark follows the system setting.

Source swatches: **Green forest** `#386641` `#6A994E` `#A7C957` `#F2E8CF` `#BC4749`;
**Autumn fall** `#6F1D1B` `#BB9457` `#432818` `#99582A` `#FFE6A7`. Roles use the
swatches directly where they meet contrast. Surfaces and dark-mode text are lighter or
darker steps of them.

| Role | Purpose | Forest light | Forest dark | Autumn light | Autumn dark |
|---|---|---|---|---|---|
| `background` | Screen | `#F7F1E1` | `#121811` | `#FFF6DD` | `#1C120B` |
| `backgroundMuted` | Badges, chips, inset areas | `#EFE5CB` | `#1E261C` | `#FBE6B3` | `#2A1B11` |
| `surface` | Inputs | `#FFFDF7` | `#192118` | `#FFFBF0` | `#24170E` |
| `surfaceElevated` | Cards, tab bar (Android) | `#FFFFFF` | `#212B1F` | `#FFFFFF` | `#2E1E13` |
| `text` | Primary text | `#1F2A1C` | `#F2E8CF` | `#432818` | `#FFE6A7` |
| `textMuted` | Secondary text | `#56624F` | `#B4B9A2` | `#76563C` | `#CDB389` |
| `brandAccent` | Primary actions, links, active tab | `#386641` | `#A7C957` | `#99582A` | `#D9955C` |
| `brandAccentPressed` | Pressed primary | `#2A4D31` | `#8DB043` | `#6F3E1C` | `#C07B42` |
| `onBrandAccent` | Text on `brandAccent` | `#FFFFFF` | `#16220F` | `#FFFFFF` | `#2A160A` |
| `secondaryAccent` | Supporting accent | `#6A994E` | `#6A994E` | `#BB9457` | `#BB9457` |
| `success` | "✓ In your pantry", savings | `#3F7A2E` | `#A7C957` | `#5F6B24` | `#C9BC6E` |
| `highlight` | Deals, score | `#A7C957` | `#A7C957` | `#BB9457` | `#BB9457` |
| `criticalError` | Errors, destructive actions | `#A93C3E` | `#E58587` | `#6F1D1B` | `#EE8F86` |
| `border` | Hairlines, outlines | `#DDD3B6` | `#313D2D` | `#E8D5A6` | `#3E2B1D` |

**Contrast.** Every pair in use is checked against WCAG AA: text on backgrounds and
surfaces ≥ 7:1, secondary text, links, accents, and errors ≥ 4.5:1, and labels on
accent buttons ≥ 4.5:1. All 56 pairs pass. The tightest is Autumn light's
`brandAccent` on `backgroundMuted`, at 4.51:1. Re-run the check whenever a token
changes.

Exception: the per-cuisine recipe placeholders keep their own warm gradients. They're
food imagery, not interface chrome.

## 4. Corner radius and depth

| Token | Value | Material 3 | Use |
|---|---|---|---|
| `sm` | 8 | Small | Small tags |
| `md` | 12 | Medium | Text fields |
| `lg` | 16 | Large | Cards, recipe images |
| `xl` | 28 | Extra Large | Sheets and dialogs (reserved) |
| `pill` | 999 | Full | Buttons, pills, chips |

- **iOS:** containers use `borderCurve: "continuous"`, Apple's squircle, so corners
  ease in rather than meeting the edge at a point.
- **Android:** the same values are Material 3's shape scale.
- **Depth:** layers stack `background` → `surface` → `surfaceElevated`, separated by a
  0.5pt hairline (`hairline`) in `border`. There are no drop shadows. Android's tab
  bar uses Material elevation 3.
- **Glass (iOS):** the tab bar is `systemUltraThinMaterial` (`expo-blur`). It's
  translucent, so content blurs as it scrolls underneath, and it adapts to light and
  dark automatically.

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
| `Button` | Full-width pill, `minTouch` + 8 tall; variants `primary`, `outline`, `neutral`, `danger` |
| `Pill` | Compact action at least `minTouch` × `minTouch`; same variants |
| `Chip` | Selectable option; selected = `brandAccent` with `onBrandAccent` text |
| `TextLink` | Inline text action with a full-size touch target |
| `Screen`, `BackLink`, `LoadingScreen`, `EmptyState` | Screen frame and common states |
