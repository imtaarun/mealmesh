import { describe, expect, it } from "vitest";
import { ageOn, checkAge, MINIMUM_AGE } from "../src/common/age.js";

describe("ageOn", () => {
  const today = new Date(Date.UTC(2026, 9, 10)); // 10 Oct 2026

  it("counts whole years, turning a year older on the birthday itself", () => {
    expect(ageOn("2010-10-10", today)).toBe(16);
    expect(ageOn("2010-10-11", today)).toBe(15);
    expect(ageOn("2010-09-30", today)).toBe(16);
  });

  it("rejects dates that don't exist", () => {
    expect(ageOn("2010-02-30", today)).toBeNull();
    expect(ageOn("2010-13-01", today)).toBeNull();
    expect(ageOn("10/10/2010", today)).toBeNull();
  });

  it("handles a 29 February birthday", () => {
    expect(ageOn("2008-02-29", new Date(Date.UTC(2024, 1, 28)))).toBe(15);
    expect(ageOn("2008-02-29", new Date(Date.UTC(2024, 1, 29)))).toBe(16);
  });
});

describe("checkAge", () => {
  const yearsAgo = (years: number, extraDays = 0) => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - years);
    d.setUTCDate(d.getUTCDate() + extraDays);
    return d.toISOString().slice(0, 10);
  };

  it(`lets in someone who turned ${MINIMUM_AGE} today, and keeps only the year`, () => {
    const dob = yearsAgo(MINIMUM_AGE);
    expect(checkAge(dob)).toBe(Number(dob.slice(0, 4)));
  });

  it(`refuses someone a day short of ${MINIMUM_AGE}, without naming the cut-off`, () => {
    expect(() => checkAge(yearsAgo(MINIMUM_AGE, 1))).toThrow("isn't available for you yet");
  });

  it("refuses future and implausible dates as invalid, not as under age", () => {
    expect(() => checkAge(yearsAgo(-1))).toThrow("doesn't look right");
    expect(() => checkAge("1850-01-01")).toThrow("doesn't look right");
  });
});
