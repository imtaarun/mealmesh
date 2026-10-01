import { describe, expect, it } from "vitest";
import { splitCents } from "../src/split/index.js";

describe("splitCents", () => {
  it("splits evenly when it divides", () => {
    expect(splitCents(9000, [{ id: "a", weight: 1 }, { id: "b", weight: 1 }, { id: "c", weight: 1 }])).toEqual({ a: 3000, b: 3000, c: 3000 });
  });

  it("hands out leftover cents so the parts add up to the total exactly", () => {
    const parts = splitCents(10000, [{ id: "a", weight: 1 }, { id: "b", weight: 1 }, { id: "c", weight: 1 }]);
    expect(parts).toEqual({ a: 3334, b: 3333, c: 3333 });
    expect(Object.values(parts).reduce((s, n) => s + n, 0)).toBe(10000);
  });

  it("weights shares — a double share pays twice, a zero share pays nothing", () => {
    expect(splitCents(9191, [{ id: "a", weight: 2 }, { id: "b", weight: 1 }, { id: "kid", weight: 0 }])).toEqual({ a: 6127, b: 3064, kid: 0 });
  });

  it("gives the whole amount to the only payer", () => {
    expect(splitCents(1, [{ id: "a", weight: 1 }])).toEqual({ a: 1 });
  });

  it("refuses a split where nobody pays", () => {
    expect(() => splitCents(100, [{ id: "a", weight: 0 }])).toThrow("at least one person");
  });
});
