import { describe, it, expect } from "vitest";
const { evaluate, check, isValidVariableName } = require("./formulaEngine");
const { TEMPLATES, FAMILIES } = require("../config/chassisCatalog");
const bom = require("./chassisBom");

describe("formulaEngine", () => {
  it("computes arithmetic, precedence, functions and ternaries", () => {
    expect(evaluate("(L - 50 + (n-1)*40) / n", { L: 1200, n: 2 })).toBe(595);
    expect(evaluate("2 + 3 * 4 ^ 2", {})).toBe(50);
    expect(evaluate("ms == 1 ? 2 : 0", { ms: 1 })).toBe(2);
    expect(evaluate("if(L > 1500, 3, 2)", { L: 1200 })).toBe(2);
    expect(evaluate("max(1, floor(n/2))", { n: 3 })).toBe(1);
    expect(evaluate("ceil(2*(L+H)/1000/6)", { L: 1000, H: 1000 })).toBe(1);
    expect(evaluate("round(10/3, 2)", {})).toBe(3.33);
    expect(evaluate("ceilto(1234, 50)", {})).toBe(1250);
    expect(evaluate("a and not b or 0", { a: 1, b: 0 })).toBe(1);
    expect(evaluate("-L + l", { L: 5 })).toBe(0);
    expect(evaluate("", {}, 7)).toBe(7);
  });
  it("refuses anything that is not a formula (no code execution)", () => {
    expect(() => evaluate("process.exit()", {})).toThrow();
    expect(() => evaluate("constructor", {})).toThrow(/Unknown variable/);
    expect(() => evaluate("alert(1)", {})).toThrow(/Unknown function/);
    expect(() => evaluate("1 / 0", {})).toThrow(/Division/);
    expect(() => evaluate("L +", { L: 1 })).toThrow();
    expect(() => evaluate("x", {})).toThrow(/Unknown variable "x"/);
  });
  it("checks variables for the editor", () => {
    expect(check("L - jl", ["L", "jl"]).ok).toBe(true);
    const r = check("L - zz", ["L"]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/zz/);
    expect(check("L - (", ["L"]).ok).toBe(false);
    expect(isValidVariableName("jl")).toBe(true);
    expect(isValidVariableName("L")).toBe(false);
    expect(isValidVariableName("max")).toBe(false);
    expect(isValidVariableName("2x")).toBe(false);
  });
});

// Builds an in-memory company catalogue from the templates.
function ctxFromTemplates() {
  const models = new Map();
  const products = new Map();
  let seq = 0;
  const pid = () => `p${(seq += 1)}`;
  const byKey = {};
  for (const t of TEMPLATES) {
    const id = `m_${t.key}`;
    byKey[t.key] = id;
    const components = t.components.map((c) => {
      if (c.kind === "model" || c.productParam) return { ...c };
      const id2 = pid();
      const stockMode = c.kind === "profile" ? "bar" : c.kind === "gasket" ? "meter" : c.kind === "glass" || c.kind === "panel" ? "m2" : "unit";
      products.set(id2, { _id: id2, name: `${c.label}`, stockMode, barLength: 6500, prices: [{ price: c.kind === "profile" ? 130 : 10 }] });
      return { ...c, product: id2 };
    });
    models.set(id, { ...t, _id: id, variables: t.variables, components });
  }
  // glass product for the simple / double glazing templates
  products.set("glass4", { _id: "glass4", name: "Float 4 mm", stockMode: "m2", prices: [{ price: 80 }], materialType: "glass" });
  for (const key of ["simple_vitrage", "double_vitrage"]) {
    const m = models.get(byKey[key]);
    m.parameters = m.parameters.map((p) => ({ ...p, default: "glass4" }));
  }
  return { models, products, series: new Map(), finishes: new Map(), workshops: new Map(), settings: { defaultBarLength: 6500, kerf: 4, trimAllowance: 10 }, byKey };
}

describe("chassis catalogue", () => {
  it("has unique keys, known families and only valid formulas", () => {
    const keys = new Set();
    const families = new Set(FAMILIES.map((f) => f.key));
    for (const t of TEMPLATES) {
      expect(keys.has(t.key), t.key).toBe(false);
      keys.add(t.key);
      expect(families.has(t.family), t.key).toBe(true);
      for (const c of t.components) {
        for (const f of ["qty", "length", "width", "height", "condition"]) {
          if (c[f]) expect(check(c[f]).ok, `${t.key}.${c.role}.${f}: ${c[f]} ${check(c[f]).error}`).toBe(true);
        }
      }
    }
    expect(TEMPLATES.length).toBeGreaterThan(40);
  });

  it("every template expands without formula errors at a mid-range size", () => {
    const ctx = ctxFromTemplates();
    for (const t of TEMPLATES) {
      const L = Math.round(((t.limits.minL || 500) + Math.min(t.limits.maxL || 3000, 3000)) / 2);
      const H = Math.round(((t.limits.minH || 500) + Math.min(t.limits.maxH || 2500, 2500)) / 2);
      const r = bom.expandItem({ model: ctx.byKey[t.key], L, H, quantity: 1, params: {} }, ctx);
      expect(r.errors, `${t.key}: ${JSON.stringify(r.errors)}`).toEqual([]);
    }
  });
});

describe("chassis BOM", () => {
  it("expands a 2-leaf sliding window with its glass unit", () => {
    const ctx = ctxFromTemplates();
    const r = bom.expandItem({ model: ctx.byKey.coulissant_2v, L: 1200, H: 1000, quantity: 3, ref: "F1", params: { vitrage: ctx.byKey.double_vitrage, ms: 0 } }, ctx);
    expect(r.errors).toEqual([]);
    const rail = r.lines.find((l) => l.role === "rail_haut");
    expect(rail.length).toBe(1200);
    expect(rail.pieces).toBe(3);
    // wv = (1200 - 50 + 40) / 2 = 595 ; traverse = wv - 56 = 539 ; 2 leaves × 3 windows
    const trav = r.lines.find((l) => l.role === "traverse_haute");
    expect(trav.length).toBe(539);
    expect(trav.pieces).toBe(6);
    expect(r.lines.find((l) => l.role === "montant_chicane").pieces).toBe(6);
    // Fly screen off → no fly screen lines
    expect(r.lines.some((l) => l.role.startsWith("ms_"))).toBe(false);
    // Glass unit: gw = 595 - 72 = 523, gh = (1000-60) - 72 = 868 ; 2 per window → 6 units
    const dv = r.assemblies.find((a) => a.family === "vitrage");
    expect(dv).toMatchObject({ width: 523, height: 868, pieces: 6, workshop: "VIT" });
    const glass = r.lines.filter((l) => l.kind === "glass");
    expect(glass).toHaveLength(2); // exterior + interior
    expect(glass[0]).toMatchObject({ width: 523, height: 868, pieces: 6, workshop: "VIT" });
    expect(r.labour.find((l) => l.workshop === "ALU").minutes).toBe(3 * (60 + 40));
  });

  it("optimises bars with kerf and trim", () => {
    const plan = bom.optimizeBars([{ length: 3000, qty: 2 }, { length: 2000, qty: 3 }], { barLength: 6500, kerf: 4, trim: 10 });
    // 3000+3000 fit one bar (6008 ≤ 6490); 2000×3 fit a second (6012)
    expect(plan.bars).toBe(2);
    expect(plan.patterns.map((p) => p.cuts.length).sort()).toEqual([2, 3]);
    const over = bom.optimizeBars([{ length: 7000, qty: 1 }], { barLength: 6500 });
    expect(over.oversize).toHaveLength(1);
    expect(over.bars).toBe(2);
  });

  it("converts needs to stock units (bars, metres, m², sheets, packs)", () => {
    const s = { defaultBarLength: 6500, kerf: 4, trimAllowance: 10, glassWastePercent: 10 };
    expect(bom.toStockQuantity({ measure: "length", totalLength: 12000, cuts: [{ length: 3000, qty: 4 }] }, { stockMode: "bar", barLength: 6500 }, s).quantity).toBe(2);
    expect(bom.toStockQuantity({ measure: "length", totalLength: 12000, waste: 5 }, { stockMode: "meter" }, s).quantity).toBe(12.6);
    expect(bom.toStockQuantity({ measure: "length", totalLength: 12000 }, { stockMode: "unit", packSize: 50 }, s).quantity).toBe(0.24);
    expect(bom.toStockQuantity({ measure: "area", area: 2, kind: "glass" }, { stockMode: "m2" }, s).quantity).toBe(2.2);
    expect(bom.toStockQuantity({ measure: "area", area: 5, waste: 10 }, { stockMode: "sheet", sheetWidth: 1250, sheetHeight: 2500 }, s).quantity).toBe(2);
    expect(bom.toStockQuantity({ measure: "count", pieces: 250 }, { stockMode: "unit", packSize: 100 }, s).quantity).toBe(2.5);
    expect(bom.toStockQuantity({ measure: "length", totalLength: 2000 }, { stockMode: "kg", weightPerMeter: 0.8 }, s).quantity).toBe(1.6);
  });

  it("aggregates per workshop and article, and prices a chassis", () => {
    const ctx = ctxFromTemplates();
    const r = bom.expandItems([
      { model: ctx.byKey.coulissant_2v, L: 1200, H: 1000, quantity: 2, ref: "F1", params: { vitrage: ctx.byKey.simple_vitrage } },
      { model: ctx.byKey.coulissant_2v, L: 1500, H: 1200, quantity: 1, ref: "F2", params: { vitrage: ctx.byKey.simple_vitrage } },
    ], ctx);
    const needs = bom.aggregateNeeds(r.lines, ctx);
    const rail = needs.find((n) => n.label.startsWith("Dormant haut"));
    expect(rail.totalLength).toBe(2 * 1200 + 1500);
    expect(rail.cuts).toHaveLength(2);
    expect(rail.theoretical).toBe(1); // 3 cuts fit one 6.5 m bar
    const glass = needs.find((n) => n.kind === "glass");
    expect(glass.workshop).toBe("VIT");
    expect(glass.pieceList).toHaveLength(2);

    const price = bom.priceChassis({ model: ctx.byKey.coulissant_2v, L: 1200, H: 1000, params: { vitrage: ctx.byKey.simple_vitrage } }, ctx);
    expect(price.cost.materials).toBeGreaterThan(0);
    expect(price.unitPrice).toBeCloseTo(price.cost.total * 1.8, 1);
    expect(bom.describeChassis({ model: ctx.byKey.coulissant_2v, L: 1200, H: 1000, params: { vitrage: ctx.byKey.simple_vitrage, ms: 1 } }, ctx))
      .toBe("Fenêtre coulissante 2 vantaux — 1200 × 1000 mm — Vitrage : Simple vitrage — Moustiquaire");
  });
});
