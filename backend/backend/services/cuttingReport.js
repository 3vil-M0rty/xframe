/**
 * ============================================================
 * CUTTING REPORT (débit) — what the screens and the 4 printouts show
 * ============================================================
 * buildCuttingReport(needs, { settings, overrides, outputs })
 *   needs     work-order needs (or plan needs), `product` populated
 *             (name, internalReference, stockMode, barLength,
 *             sheetWidth, sheetHeight, quantity) or null + productName,
 *             `finish` populated or null, `workshopName`/`workshopKind`
 *   overrides bar: kerf, trim, endTrim, spacing ; glass: edgeTrim, gap,
 *             allowRotation — recomputes the plans without saving the
 *             settings ("what if the blade were 3 mm?")
 *   outputs   laquage outputs (bars to lacquer per colour)
 *
 * → { settings, bars[], glass[], accessories[], powder[], lacquer[], glassPieces[] }
 * ============================================================
 */
const { optimizeBars, packSheets, compactSheets, heelLength, parseAngles } = require("./cuttingOptimizer");
const { barOptions, sheetOptions, stockUnitLabel, round, geometryOf } = require("./chassisBom");

const idOf = (v) => (v && typeof v === "object" && v._id ? String(v._id) : v ? String(v) : null);
const nameOf = (n) => n.product?.name || n.productName || n.label || "";
const finishOf = (f) => (f && typeof f === "object" ? { code: f.code, name: f.name || "", color: f.color || null } : null);

function typeOf(n) {
  const mt = n.materialType || n.product?.materialType || "";
  if (n.kind === "powder" || mt === "powder") return "powder";
  if (n.measure === "area" && (n.kind === "glass" || mt === "glass")) return "glass";
  // Bars = profiles cut to length (gaskets, brushes… measured in metres go with the accessories).
  if (n.measure === "length" && (n.cuts || []).length && (n.kind === "profile" || mt === "profile" || n.product?.stockMode === "bar" || n.unit === "barre")) return "bars";
  if (n.workshopKind === "laquage") return "lacquer";
  return "accessories";
}

const ACCESSORY_GROUPS = ["accessory", "gasket", "consumable", "panel", "profile", "glass", "other"];

function buildCuttingReport(needs = [], { settings = {}, overrides = {}, outputs = [], panes = [] } = {}) {
  const barOpts = barOptions(settings, null, overrides);
  const glassOpts = sheetOptions(settings, overrides);
  const report = {
    settings: {
      kerf: barOpts.kerf, trim: barOpts.trim, endTrim: barOpts.endTrim, spacing: barOpts.spacing,
      minReusableOffcut: barOpts.minReusableOffcut, nest: barOpts.nest, defaultBarLength: Number(settings.defaultBarLength) || 6500,
      edgeTrim: glassOpts.edgeTrim, gap: glassOpts.gap, allowRotation: glassOpts.allowRotation,
    },
    bars: [], glass: [], accessories: [], powder: [], lacquer: [], glassPieces: [],
  };

  for (const n of needs) {
    const type = typeOf(n);
    const product = n.product && typeof n.product === "object" ? n.product : null;
    const base = {
      need: idOf(n._id), product: idOf(n.product), name: nameOf(n), ref: product?.internalReference || "", label: n.label || "",
      finish: finishOf(n.finish), workshop: n.workshopName || "", order: n.orderNumber || "", warning: n.warning || "",
    };

    if (type === "bars") {
      const isBar = product?.stockMode === "bar" || !!n.cutPlan?.barLength || n.unit === "barre";
      const barLength = Number(product?.barLength) || Number(n.cutPlan?.barLength) || Number(n.barLength) || report.settings.defaultBarLength;
      // Mitre / talon / tête-bêche: the profile's total height (chambre + ailettes).
      const geo = geometryOf(product);
      const depth = geo.hp;
      // Cut list: lengths at the long points (pointe à pointe), short points (talons) when the profile width is known.
      const cuts = [...(n.cuts || [])]
        .sort((a, b) => b.length - a.length || String(a.ref).localeCompare(String(b.ref)))
        .map((c) => { const [aL, aR] = parseAngles(c.angle); return { ...c, angleL: aL, angleR: aR, heel: heelLength(c.length, c.angle, depth) }; });
      const totalLength = cuts.reduce((s, c) => s + c.length * c.qty, 0);
      const plan = isBar ? optimizeBars(cuts, barOptions(settings, barLength, overrides, depth)) : null;
      report.bars.push({ ...base, barLength: isBar ? barLength : null, depth, geometry: geo, cuts, totalLength: round(totalLength, 1), plan, stock: product?.quantity ?? null, unit: isBar ? "barre" : stockUnitLabel(product) });
      continue;
    }

    if (type === "glass") {
      const pieceList = n.pieceList || [];
      for (const p of pieceList) report.glassPieces.push({ ...p, glass: base.name, layer: n.label, workshop: base.workshop });
      const W = Number(product?.sheetWidth) || Number(n.cutPlan?.sheetWidth) || 0;
      const H = Number(product?.sheetHeight) || Number(n.cutPlan?.sheetHeight) || 0;
      let plan = null;
      if (W > 0 && H > 0 && pieceList.length) {
        const p = packSheets(pieceList, { width: W, height: H }, glassOpts);
        plan = { sheetWidth: W, sheetHeight: H, count: p.count, efficiency: p.efficiency, patterns: compactSheets(p.sheets), unfit: p.unfit.length, settings: p.settings };
      }
      report.glass.push({
        ...base, pieceList, area: round(n.area || pieceList.reduce((s, x) => s + (x.width * x.height * x.qty) / 1e6, 0), 3),
        pieces: pieceList.reduce((s, x) => s + (Number(x.qty) || 0), 0), plan,
        fromStock: n.cutPlan?.fromStock ?? null, toBuy: n.cutPlan?.toBuy ?? null,
        stock: product?.quantity ?? null, theoretical: n.theoretical, unit: n.unit,
        candidates: (n.candidateNames || []),
      });
      continue;
    }

    const row = {
      ...base, type: n.materialType || product?.materialType || n.kind || "other", kind: n.kind || "", theoretical: round(n.theoretical, 3), consumed: round(n.consumed || 0, 3),
      unit: n.unit || stockUnitLabel(product), pieces: round(n.pieces || 0, 3), stock: product?.quantity ?? null, surface: n.surface ?? null,
    };
    if (type === "powder") report.powder.push(row);
    else if (type === "lacquer") report.lacquer.push(row);
    else report.accessories.push(row);
  }

  // Laquage outputs: what comes out of the oven, per colour.
  report.lacquerOutputs = (outputs || []).map((o) => ({
    name: o.product?.name || o.productName || "", ref: o.product?.internalReference || "", finish: finishOf(o.finish) || (o.finishCode ? { code: o.finishCode, name: "" } : null),
    quantity: o.quantity, paintSurface: o.paintSurface || 0, order: o.orderNumber || "",
  }));

  // Glazing items (panes to assemble) of the glazing orders.
  report.panes = (panes || []).map((i) => ({ ref: i.ref || "", label: i.label || "", L: i.L || null, H: i.H || null, quantity: i.quantity || 0, done: i.done || 0, order: i.orderNumber || "" }));

  const order = (t) => { const i = ACCESSORY_GROUPS.indexOf(t); return i < 0 ? ACCESSORY_GROUPS.length : i; };
  report.accessories.sort((a, b) => order(a.type) - order(b.type) || a.name.localeCompare(b.name, "fr"));
  report.bars.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  report.glass.sort((a, b) => a.label.localeCompare(b.label, "fr") || a.name.localeCompare(b.name, "fr"));
  report.totals = {
    bars: report.bars.reduce((s, b) => s + (b.plan?.bars || 0), 0),
    sheets: report.glass.reduce((s, g) => s + (g.plan?.count || 0), 0),
    panes: report.glassPieces.reduce((s, p) => s + (Number(p.qty) || 0), 0),
    glassArea: round(report.glass.reduce((s, g) => s + g.area, 0), 3),
    powderKg: round(report.powder.reduce((s, p) => s + (p.theoretical || 0), 0), 3),
  };
  return report;
}

module.exports = { buildCuttingReport, typeOf };
