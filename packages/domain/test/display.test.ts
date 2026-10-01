import { describe, expect, it } from "vitest";
import { formatQuantity, scaleQuantity } from "../src/display/index.js";

describe("scaleQuantity", () => {
  it("scales a 4-serving recipe to the meal's servings", () => {
    expect(scaleQuantity(600, 4, 2)).toBe(300);
    expect(scaleQuantity(1.5, 4, 6)).toBe(2.25);
  });
});

describe("formatQuantity", () => {
  it.each([
    [1.5, "cup", "1½ cups"],
    [0.75, "cup", "¾ cup"],
    [1, "cup", "1 cup"],
    [0.33, "cup", "⅓ cup"],
    [2.25, "tbsp", "2¼ tbsp"],
    [0.5, "tsp", "½ tsp"],
    [0.98, "tsp", "1 tsp"],
    [1.2, "cup", "1.2 cups"],
    [3, "clove", "3 cloves"],
    [1, "can", "1 can"],
    [1.5, "piece", "1½"],
    [2, "piece", "2"],
  ] as const)("%s %s → %s", (value, unit, expected) => {
    expect(formatQuantity(value, unit)).toBe(expected);
  });

  it("rounds grams and millilitres the way a recipe would, switching to kg and l", () => {
    expect(formatQuantity(300, "g")).toBe("300 g");
    expect(formatQuantity(287.4, "g")).toBe("285 g");
    expect(formatQuantity(3.2, "g")).toBe("3 g");
    expect(formatQuantity(0.3, "g")).toBe("1 g");
    expect(formatQuantity(1200, "g")).toBe("1.2 kg");
    expect(formatQuantity(2000, "ml")).toBe("2 l");
    expect(formatQuantity(120, "ml")).toBe("120 ml");
  });

  it("writes vague amounts in words, whatever the servings", () => {
    expect(formatQuantity(2, "pinch")).toBe("a pinch");
    expect(formatQuantity(1, "to_taste")).toBe("to taste");
    expect(formatQuantity(1, "handful")).toBe("a handful");
  });

  it("keeps larger units with a decimal", () => {
    expect(formatQuantity(1.25, "lb")).toBe("1.3 lb");
    expect(formatQuantity(2, "kg")).toBe("2 kg");
  });
});
