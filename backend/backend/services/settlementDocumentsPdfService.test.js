import { describe, it, expect } from "vitest";

const { estimateSeverance } = require("./settlementDocumentsPdfService");

describe("estimateSeverance (Article 53 tiered formula)", () => {
  it("computes tier-1-only severance correctly (up to 5 years, 96h/year)", () => {
    const result = estimateSeverance(8000, 3);
    const expected = (8000 / 191) * 3 * 96;
    expect(result).toBeCloseTo(expected, 1);
  });

  it("correctly spans tier 1 and tier 2 (crosses the 5-year boundary)", () => {
    const result = estimateSeverance(10000, 8);
    const expected = (10000 / 191) * (5 * 96 + 3 * 144);
    expect(result).toBeCloseTo(expected, 1);
  });

  it("correctly spans all 4 tiers for a long-tenured employee", () => {
    const result = estimateSeverance(12000, 20);
    const expected = (12000 / 191) * (5 * 96 + 5 * 144 + 5 * 192 + 5 * 240);
    expect(result).toBeCloseTo(expected, 1);
  });

  it("returns 0 for zero seniority", () => {
    expect(estimateSeverance(8000, 0)).toBe(0);
  });

  it("returns 0 for zero salary", () => {
    expect(estimateSeverance(0, 5)).toBe(0);
  });

  it("returns 0 (not negative or NaN) for bad/negative seniority data", () => {
    expect(estimateSeverance(8000, -1)).toBe(0);
  });
});
