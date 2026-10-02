import { describe, it, expect } from "vitest";
const PDFDocument = require("pdfkit");
const { sketchChassis, drawSketchPdf, DRAWING_TYPES } = require("./chassisSketch");

describe("chassis sketch", () => {
  it("draws every schematic type inside its box", () => {
    for (const type of DRAWING_TYPES) {
      const { shapes, box } = sketchChassis({ drawing: { type, leaves: 2, layers: 2, parts: ["left", "center", "right"] }, L: 2400, H: 1200, params: { nx: 3, ny: 2 }, width: 150, height: 100 });
      expect(shapes.length, type).toBeGreaterThan(0);
      expect(box.w / box.h).toBeCloseTo(2, 1);
      for (const s of shapes) {
        const xs = s.t === "line" ? [s.x1, s.x2] : [s.x];
        for (const x of xs) { expect(x).toBeGreaterThanOrEqual(-4); expect(x).toBeLessThanOrEqual(154); }
      }
    }
  });

  it("uses the leaves parameter over the model's hint", () => {
    const two = sketchChassis({ drawing: { type: "sliding", leaves: 2 }, params: {} }).shapes.filter((s) => s.fill === "glass").length;
    const three = sketchChassis({ drawing: { type: "sliding", leaves: 2 }, params: { n: 3 } }).shapes.filter((s) => s.fill === "glass").length;
    expect(two).toBe(2);
    expect(three).toBe(3);
  });

  it("falls back to a generic sketch for unknown types and renders into a PDF", () => {
    expect(sketchChassis({ drawing: { type: "constructor" } }).shapes).toHaveLength(3);
    const doc = new PDFDocument();
    expect(() => DRAWING_TYPES.forEach((type) => drawSketchPdf(doc, { x: 40, y: 40, width: 62, height: 50, drawing: { type }, L: 1800, H: 1250, params: {} }))).not.toThrow();
    doc.end();
  });
});
