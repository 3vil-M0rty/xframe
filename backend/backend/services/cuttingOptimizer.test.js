import { describe, it, expect } from "vitest";

const o = require("./cuttingOptimizer");

describe("bar cutting", () => {
  it("honours blade, start / end of bar and the space between cuts", () => {
    const plan = o.optimizeBars([{ length: 3000, qty: 2 }, { length: 2000, qty: 3 }], { barLength: 6500, kerf: 4, trim: 15, endTrim: 20, spacing: 2 });
    expect(plan.bars).toBe(2);
    const p3000 = plan.patterns.find((p) => p.cuts[0].length === 3000);
    expect(p3000.cuts.map((c) => c.pos)).toEqual([15, 3021]); // 15 + 3000 + 4 + 2
    expect(plan.settings).toMatchObject({ kerf: 4, trim: 15, endTrim: 20, spacing: 2 });
    // usable 6465: 2000×3 + 2 gaps of 6 = 6012 → offcut 6465 - 6012 - blade
    const p2000 = plan.patterns.find((p) => p.cuts[0].length === 2000);
    expect(p2000.offcut).toBe(449);
  });

  it("uses fewer bars with best fit than one bar per piece", () => {
    const plan = o.optimizeBars([{ length: 4000, qty: 2 }, { length: 2400, qty: 2 }, { length: 1000, qty: 4 }], { barLength: 6500, kerf: 4, trim: 10 });
    expect(plan.bars).toBe(3);
    expect(plan.efficiency).toBeGreaterThan(80);
  });
});

describe("glass plateaux", () => {
  const pieces = [{ width: 1200, height: 800, qty: 6, ref: "R1" }, { width: 600, height: 900, qty: 4, ref: "R2" }];

  it("nests panes on a plateau inside its border, without overlaps", () => {
    const p = o.packSheets(pieces, { width: 3210, height: 2250 }, { edgeTrim: 10, gap: 3 });
    expect(p.unfit).toHaveLength(0);
    for (const s of p.sheets) {
      for (const a of s.pieces) {
        expect(a.x).toBeGreaterThanOrEqual(10);
        expect(a.y).toBeGreaterThanOrEqual(10);
        expect(a.x + a.w).toBeLessThanOrEqual(3200);
        expect(a.y + a.h).toBeLessThanOrEqual(2240);
        for (const b of s.pieces) {
          if (a === b) continue;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
      }
    }
    expect(p.sheets.flatMap((s) => s.pieces)).toHaveLength(10);
  });

  it("picks the plateau from stock: best format first, then the others, then buys", () => {
    const candidates = [
      { id: "big", width: 3210, height: 2250, stock: 0 },
      { id: "mid", width: 2550, height: 1605, stock: 1 },
      { id: "small", width: 2400, height: 1000, stock: 50 },
    ];
    const r = o.allocateSheets(pieces, candidates, { edgeTrim: 10, gap: 3 });
    expect(r.unfit).toHaveLength(0);
    expect(r.allocations.find((a) => a.candidate.id === "big")).toBeUndefined(); // none in stock, and stock covers the job
    const placed = r.allocations.reduce((s, a) => s + a.pieceList.reduce((x, p) => x + p.qty, 0), 0);
    expect(placed).toBe(10);
    expect(r.allocations.every((a) => a.toBuy === 0)).toBe(true);
    // stock was consumed
    expect(candidates.find((c) => c.id === "mid").stock).toBe(0);
  });

  it("reports panes larger than every plateau", () => {
    const r = o.allocateSheets([{ width: 4000, height: 3000, qty: 1 }], [{ id: "a", width: 3210, height: 2250, stock: 5 }], {});
    expect(r.unfit).toHaveLength(1);
  });
});
