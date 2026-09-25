import { describe, expect, it } from "vitest";
import { convertToBaseUnit } from "../src/units/index.js";
import type { IngredientConversion } from "../src/types.js";

const onion: IngredientConversion = { id: "onion", baseUnit: "g", gramsPerPiece: 150 };
const spinachWithFactor: IngredientConversion = { id: "spinach", baseUnit: "g", gramsPerPiece: 300 };
const spinachNoFactor: IngredientConversion = { id: "spinach", baseUnit: "g" };
const rice: IngredientConversion = { id: "rice", baseUnit: "g", gramsPerCup: 185 };
const oil: IngredientConversion = { id: "oil", baseUnit: "ml" };
const cumin: IngredientConversion = { id: "cumin", baseUnit: "g", density: 0.5 };
const salt: IngredientConversion = { id: "salt", baseUnit: "g", gramsPerCup: 290 };

describe("convertToBaseUnit", () => {
  it("converts a mass unit straight through when baseUnit is already grams", () => {
    const result = convertToBaseUnit({ value: 200, unit: "g" }, spinachWithFactor);
    expect(result).toEqual({ ingredientId: "spinach", value: 200, unit: "g", needsReview: false, isNominal: false });
  });

  it("converts a count unit to grams via gramsPerPiece", () => {
    const result = convertToBaseUnit({ value: 2, unit: "piece" }, onion);
    expect(result.value).toBe(300);
    expect(result.unit).toBe("g");
    expect(result.needsReview).toBe(false);
  });

  it("converts a bunch to grams via gramsPerPiece when the factor is known", () => {
    const result = convertToBaseUnit({ value: 1, unit: "bunch" }, spinachWithFactor);
    expect(result.value).toBe(300);
    expect(result.needsReview).toBe(false);
  });

  it("flags needsReview and keeps the original unit when gramsPerPiece is missing", () => {
    const result = convertToBaseUnit({ value: 1, unit: "bunch" }, spinachNoFactor);
    expect(result.needsReview).toBe(true);
    expect(result.unit).toBe("bunch");
    expect(result.value).toBe(1);
  });

  it("prefers the cup shortcut over density for dry goods", () => {
    const result = convertToBaseUnit({ value: 2, unit: "cup" }, rice);
    expect(result.value).toBe(370);
    expect(result.unit).toBe("g");
    expect(result.needsReview).toBe(false);
  });

  it("converts volume units straight through when baseUnit is already ml", () => {
    const result = convertToBaseUnit({ value: 3, unit: "tbsp" }, oil);
    expect(result.value).toBeCloseTo(3 * 14.7868, 4);
    expect(result.unit).toBe("ml");
  });

  it("converts a volume unit to grams via density when no gramsPerCup applies", () => {
    const result = convertToBaseUnit({ value: 1, unit: "tsp" }, cumin);
    expect(result.value).toBeCloseTo(4.92892 * 0.5, 4);
    expect(result.unit).toBe("g");
    expect(result.needsReview).toBe(false);
  });

  it("maps nominal units to a zero-value, non-blocking line", () => {
    const result = convertToBaseUnit({ value: 1, unit: "pinch" }, salt);
    expect(result.isNominal).toBe(true);
    expect(result.value).toBe(0);
    expect(result.unit).toBe("g");
    expect(result.needsReview).toBe(false);
  });
});
