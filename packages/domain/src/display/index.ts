// Showing recipe quantities to a cook — scaled to the meal's servings and written the
// way a recipe would say them ("1½ cups", "300 g", "a pinch"), never "1.4999 cup".
// Display only: the grocery list and costs work from base units (units/, aggregation/).

import type { Unit } from "../types.js";

export function scaleQuantity(value: number, recipeServings: number, servings: number): number {
  return (value * servings) / recipeServings;
}

const FRACTIONS: Array<[number, string]> = [
  [0, ""],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

/** 1.5 → "1½", 0.33 → "⅓", 1.2 → "1.2" (no kitchen fraction is close enough). */
function kitchenNumber(value: number): string {
  const whole = Math.floor(value);
  const [fraction, glyph] = FRACTIONS.reduce((best, f) => (Math.abs(value - whole - f[0]) < Math.abs(value - whole - best[0]) ? f : best));
  if (Math.abs(value - whole - fraction) > 0.05) return trim(value, 1);
  if (fraction === 1) return String(whole + 1);
  if (!glyph) return String(whole);
  return whole === 0 ? glyph : `${whole}${glyph}`;
}

function trim(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

/** Grams or millilitres: nearest 5 under 1000 (whole numbers under 10), then kg or l. */
function metric(value: number, small: string, large: string): string {
  if (value >= 1000) return `${trim(value / 1000, 1)} ${large}`;
  if (value < 10) return `${Math.max(1, Math.round(value))} ${small}`;
  return `${Math.round(value / 5) * 5} ${small}`;
}

const COUNTED: Partial<Record<Unit, [string, string]>> = {
  cup: ["cup", "cups"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  bunch: ["bunch", "bunches"],
  tsp: ["tsp", "tsp"],
  tbsp: ["tbsp", "tbsp"],
};

export function formatQuantity(value: number, unit: Unit): string {
  switch (unit) {
    case "pinch":
      return "a pinch";
    case "to_taste":
      return "to taste";
    case "handful":
      return "a handful";
    case "g":
      return metric(value, "g", "kg");
    case "ml":
      return metric(value, "ml", "l");
    case "kg":
    case "l":
    case "oz":
    case "lb":
      return `${trim(value, 1)} ${unit}`;
    case "piece":
      return kitchenNumber(value);
  }
  const [one, many] = COUNTED[unit]!;
  return `${kitchenNumber(value)} ${value > 1 ? many : one}`;
}
