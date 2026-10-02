/**
 * ============================================================
 * CHASSIS BOM ENGINE (nomenclature / débit)
 * ============================================================
 * Pure functions — no database access — so they are fully testable:
 *
 *   expandItem()      one chassis (model × L × H × params × qty × colour)
 *                     → flat component lines (recursing into sub-models:
 *                     glass units, panels, combined frames…)
 *   aggregateNeeds()  lines → needs per workshop / article / colour, in
 *                     the article's STOCK unit (bars, m, m², sheets, units)
 *   optimizeBars()    1D cutting-stock (first-fit decreasing) with saw
 *                     kerf and bar-end trim → bars + cutting plan
 *   priceChassis()    cost (materials + lacquer + labour) and proposed
 *                     devis price from the model's pricing rule
 *
 * The caller (services/productionPlanning.js) loads the company's
 * models, series, articles, colours and settings and passes them in a
 * `ctx`:
 *   ctx.models    Map id → ChassisModel (plain object)
 *   ctx.series    Map id → ProfileSeries
 *   ctx.products  Map id → Product
 *   ctx.finishes  Map id → Finish
 *   ctx.workshops Map code → Workshop
 *   ctx.settings  ProductionSettings
 * ============================================================
 */
const { evaluate } = require("./formulaEngine");
const { DEFAULT_MEASURE } = require("../config/chassisCatalog");
const optimizer = require("./cuttingOptimizer");

const MAX_DEPTH = 4;
const round = (x, d = 3) => { const f = 10 ** d; return Math.round((Number(x) || 0) * f) / f; };
const idOf = (v) => (v && typeof v === "object" && v._id ? String(v._id) : v ? String(v) : null);

function paramValue(param, raw) {
  const v = raw === undefined || raw === null || raw === "" ? param.default : raw;
  if (param.type === "boolean") return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
  if (param.type === "product" || param.type === "model") return v ? String(v) : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Variables available to a model's formulas, in override order:
 * series variables < model variables < parameters < L/H < derived.
 * Product/model parameters are exposed as 1 (chosen) / 0 (not chosen)
 * so `condition: "vitrage"` works; their ids are returned separately.
 */
// ------------------------------------------------------------------
// Profile geometry (like FPPRO's profile library). Each profile article
// may carry: épaisseur de chambre (ch), ailette externe (ae), ailette
// interne (ai) — their sum is the total height (hp, the dimension in the
// plane of the frame, used for mitres) — and the width (lp). In formulas:
//   ae, ai, ch, hp, lp            → the component's OWN article
//   ae_<role>, ch_<role>, …       → the article of another component of
//                                   the model (e.g. ch_dormant_v), usable
//                                   in intermediate values too
// e.g. dormant with a 25 mm couvre-joint (ailette externe), opening 1000:
// length "L + 2*ae" → 1050 cut 45/45.
// ------------------------------------------------------------------
const GEOM_KEYS = ["ch", "ae", "ai", "hp", "lp"];
const roleVar = (role) => String(role || "").replace(/[^A-Za-z0-9_]/g, "_");

function geometryOf(product) {
  const p = product || {};
  const ch = Number(p.profileChamber) || 0;
  const ae = Number(p.profileOuterFin) || 0;
  const ai = Number(p.profileInnerFin) || 0;
  const hp = Number(p.profileHeight) || (ch + ae + ai) || Number(p.profileDepth) || 0;
  return { ch, ae, ai, hp, lp: Number(p.profileWidth) || 0 };
}

/** Names every model formula may use for the profile geometry (for the formula checker). */
function geometryVarNames(components = []) {
  const out = [...GEOM_KEYS];
  for (const c of components || []) {
    if (!c?.role || c.kind === "model") continue;
    for (const g of GEOM_KEYS) out.push(`${g}_${roleVar(c.role)}`);
  }
  return [...new Set(out)];
}

function buildVariables(model, series, L, H, params = {}, ctx = null) {
  // Built-in: cj = couvre-joint of the frame per side (0 unless the series / model sets it).
  const vars = { cj: 0 };
  const refs = {};
  for (const v of series?.variables || []) vars[v.key] = Number(v.value) || 0;
  for (const v of model.variables || []) vars[v.key] = Number(v.value) || 0;
  for (const p of model.parameters || []) {
    const value = paramValue(p, params[p.key]);
    if (p.type === "product" || p.type === "model") {
      refs[p.key] = value;
      vars[p.key] = value ? 1 : 0;
    } else {
      let n = value;
      if (p.min !== null && p.min !== undefined && n < p.min) n = p.min;
      if (p.max !== null && p.max !== undefined && n > p.max) n = p.max;
      vars[p.key] = n;
    }
  }
  vars.L = Number(L) || 0;
  vars.H = Number(H) || 0;
  // Geometry of each component's article (0 when unknown / not chosen).
  for (const g of GEOM_KEYS) vars[g] = 0;
  for (const c of model.components || []) {
    if (!c?.role || c.kind === "model") continue;
    const pid = idOf(c.product) || (c.productParam ? refs[c.productParam] : null);
    const geo = geometryOf(pid && ctx?.products ? ctx.products.get(String(pid)) : null);
    for (const g of GEOM_KEYS) vars[`${g}_${roleVar(c.role)}`] = geo[g];
  }
  const errors = [];
  for (const d of model.derived || []) {
    try {
      vars[d.key] = evaluate(d.formula, vars);
    } catch (error) {
      vars[d.key] = 0;
      errors.push({ where: `${model.name} › ${d.label || d.key}`, field: "derived", message: error.message });
    }
  }
  return { vars, refs, errors };
}

/**
 * Expands one chassis into component lines.
 * item = { model, L, H, quantity, finish, params, ref, label }
 * Returns { lines, assemblies, labour: [{ workshop, minutes }], errors, warnings }.
 */
function expandItem(item, ctx, depth = 0, path = "", inherited = {}) {
  const out = { lines: [], assemblies: [], labour: [], errors: [], warnings: [] };
  const model = ctx.models.get(idOf(item.model));
  const where = path || item.ref || item.label || "";
  if (!model) {
    out.errors.push({ where, field: "model", message: "Modèle de châssis introuvable ou inactif" });
    return out;
  }
  if (depth > MAX_DEPTH) {
    out.errors.push({ where, field: "model", message: "Trop de niveaux de sous-modèles (boucle ?)" });
    return out;
  }
  const qty = Number(item.quantity) || 0;
  const L = Number(item.L) || 0;
  const H = Number(item.H) || 0;
  const lim = model.limits || {};
  if ((lim.minL && L < lim.minL) || (lim.maxL && L > lim.maxL) || (lim.minH && H < lim.minH) || (lim.maxH && H > lim.maxH)) {
    out.warnings.push({ where: where || model.name, message: `${model.name} : ${round(L, 0)} × ${round(H, 0)} mm hors des limites (${lim.minL || "–"}–${lim.maxL || "–"} × ${lim.minH || "–"}–${lim.maxH || "–"})` });
  }
  const series = model.series ? ctx.series.get(idOf(model.series)) : null;
  const { vars, refs, errors } = buildVariables(model, series, L, H, item.params || {}, ctx);
  out.errors.push(...errors.map((e) => ({ ...e, where: `${where} › ${e.where}` })));
  const finish = idOf(item.finish) || inherited.finish || null;
  const label = path || [item.ref, item.label || model.name].filter(Boolean).join(" ");
  const itemRef = inherited.itemRef || item.ref || "";
  const itemKey = inherited.itemKey || (item._id ? String(item._id) : itemRef);
  const defaultWorkshop = model.defaultWorkshop || inherited.workshop || "ALU";

  let scope = vars; // the component's own geometry (ae, ch…) is layered on per component
  const ev = (formula, field, comp, fallback = 0) => {
    try {
      return evaluate(formula, scope, fallback);
    } catch (error) {
      out.errors.push({ where: `${label} › ${comp.label}`, field, message: error.message });
      return fallback;
    }
  };

  for (const comp of model.components || []) {
    const ownId = comp.kind === "model" ? null : idOf(comp.product) || (comp.productParam ? refs[comp.productParam] : null);
    scope = ownId ? { ...vars, ...geometryOf(ctx.products?.get(String(ownId))) } : vars;
    if (comp.condition && !ev(comp.condition, "condition", comp, 1)) continue;
    const perChassis = ev(comp.qty || "1", "qty", comp, 0);
    if (!(perChassis > 0)) continue;
    const pieces = perChassis * qty;
    const workshop = (comp.workshop || defaultWorkshop).toUpperCase();

    if (comp.kind === "model") {
      const subId = idOf(comp.subModel) || (comp.modelParam ? refs[comp.modelParam] : null);
      if (!subId) {
        out.warnings.push({ where: `${label} › ${comp.label}`, message: `« ${comp.label} » : aucun modèle choisi` });
        continue;
      }
      const sub = ctx.models.get(subId);
      const glassType = !sub ? ctx.glassTypes?.get(subId) : null;
      if (glassType) {
        const W = ev(comp.width || "L", "width", comp, L);
        const Hh = ev(comp.height || "H", "height", comp, H);
        expandGlassType(glassType, {
          W, H: Hh, pieces, path: `${label} › ${comp.label}`, itemRef, itemKey, finish,
          workshop: (glassType.workshop || comp.workshop || "VIT").toUpperCase(), parentWorkshop: defaultWorkshop,
        }, out);
        continue;
      }
      if (!sub) {
        out.errors.push({ where: `${label} › ${comp.label}`, field: "model", message: "Sous-modèle introuvable ou inactif" });
        continue;
      }
      const W = ev(comp.width || "L", "width", comp, L);
      const Hh = ev(comp.height || "H", "height", comp, H);
      const subPath = `${label} › ${comp.label}`;
      out.assemblies.push({
        model: subId, name: sub.name, family: sub.family, workshop: (sub.defaultWorkshop || workshop).toUpperCase(),
        parentWorkshop: defaultWorkshop, width: round(W, 1), height: round(Hh, 1), pieces, path: subPath, itemRef, itemKey, finish,
      });
      const child = expandItem(
        { model: subId, L: W, H: Hh, quantity: pieces, params: sub.parameters?.reduce((acc, p) => ({ ...acc, [p.key]: p.default }), {}) || {} },
        ctx, depth + 1, subPath, { finish, itemRef, itemKey, workshop: sub.defaultWorkshop || workshop },
      );
      out.lines.push(...child.lines);
      out.assemblies.push(...child.assemblies);
      out.labour.push(...child.labour);
      out.errors.push(...child.errors);
      out.warnings.push(...child.warnings);
      continue;
    }

    const measure = comp.measure || DEFAULT_MEASURE[comp.kind] || "count";
    const product = idOf(comp.product) || (comp.productParam ? refs[comp.productParam] : null);
    const line = {
      role: comp.role, label: comp.label, kind: comp.kind, measure, product,
      finishMode: comp.finish || "none",
      finish: comp.finish === "project" ? finish : null,
      workshop, pieces: round(pieces, 4), angle: comp.angle || "", waste: Number(comp.waste) || 0,
      path: label, itemRef, itemKey, modelName: model.name,
    };
    if (measure === "length") {
      line.length = round(ev(comp.length || "0", "length", comp, 0), 1);
      if (!(line.length > 0)) { out.warnings.push({ where: `${label} › ${comp.label}`, message: `« ${comp.label} » : longueur nulle` }); continue; }
    } else if (measure === "area") {
      line.width = round(ev(comp.width || "L", "width", comp, L), 1);
      line.height = round(ev(comp.height || "H", "height", comp, H), 1);
      if (!(line.width > 0 && line.height > 0)) { out.warnings.push({ where: `${label} › ${comp.label}`, message: `« ${comp.label} » : dimension nulle` }); continue; }
    }
    out.lines.push(line);
  }

  scope = vars;
  for (const l of model.labour || []) {
    const minutes = ev(l.minutes || "0", "labour", { label: `Main d'œuvre ${l.workshop}` }, 0) * qty;
    if (minutes > 0) out.labour.push({ workshop: (l.workshop || defaultWorkshop).toUpperCase(), minutes: round(minutes, 1) });
  }
  return out;
}

/**
 * A glass composition (models/GlassType) used as a glass unit: one area
 * line per layer sheet — its article is the first allowed plateau, the
 * others travel in `glassCandidates` so the planner can pick from stock —
 * plus the extras (film, spacer, butyl…) and the glazing labour.
 */
function expandGlassType(gt, { W, H, pieces, path, itemRef, itemKey, finish, workshop, parentWorkshop }, out) {
  const w = round(W, 1);
  const h = round(H, 1);
  if (!(w > 0 && h > 0)) { out.warnings.push({ where: path, message: `${gt.name} : dimension nulle` }); return; }
  out.assemblies.push({
    model: null, glassType: String(gt._id), name: gt.name, family: "vitrage", workshop, parentWorkshop,
    width: w, height: h, pieces, path, itemRef, itemKey, finish,
  });
  const base = { finishMode: "none", finish: null, workshop, angle: "", path, itemRef, itemKey, modelName: gt.name, glassType: String(gt._id), glassTypeName: gt.name };
  (gt.layers || []).forEach((layer, i) => {
    const sheets = (layer.sheets || []).map((x) => idOf(x)).filter(Boolean);
    const count = Math.max(1, Number(layer.count) || 1);
    const name = layer.label || (layer.thickness ? `Verre ${layer.thickness} mm` : `Verre ${i + 1}`);
    if (!sheets.length) out.warnings.push({ where: path, message: `${gt.name} › ${name} : aucun plateau autorisé` });
    out.lines.push({
      ...base, role: `verre_${i + 1}`, label: `${gt.name} — ${name}`, kind: "glass", measure: "area",
      product: sheets[0] || null, glassCandidates: sheets, layerThickness: layer.thickness || null,
      pieces: round(pieces * count, 4), width: w, height: h, waste: 0,
    });
  });
  for (const [i, x] of (gt.extras || []).entries()) {
    const q = Number(x.qty) || 0;
    if (!(q > 0)) continue;
    const label = `${gt.name} — ${x.label || "Accessoire"}`;
    const product = idOf(x.product);
    if (x.measure === "area") {
      out.lines.push({ ...base, role: `extra_${i + 1}`, label, kind: "panel", measure: "area", product, pieces: round(pieces * q, 4), width: w, height: h, waste: 0 });
    } else if (x.measure === "perimeter") {
      const inset = Number(x.inset) || 0;
      const lw = Math.max(0, w - 2 * inset);
      const lh = Math.max(0, h - 2 * inset);
      out.lines.push({ ...base, role: `extra_${i + 1}`, label, kind: "gasket", measure: "length", product, pieces: round(pieces * q, 4), length: round(2 * (lw + lh), 1), waste: 0 });
    } else {
      out.lines.push({ ...base, role: `extra_${i + 1}`, label, kind: "accessory", measure: "count", product, pieces: round(pieces * q, 4), waste: 0 });
    }
  }
  const minutes = ((Number(gt.labourPerPane) || 0) + (Number(gt.labourPerM2) || 0) * (w * h) / 1e6) * pieces;
  if (minutes > 0) out.labour.push({ workshop, minutes: round(minutes, 1) });
}

/** Expands several items (a project's ouvrages). */
function expandItems(items, ctx) {
  const out = { lines: [], assemblies: [], labour: [], errors: [], warnings: [] };
  for (const item of items) {
    const r = expandItem(item, ctx);
    for (const k of Object.keys(out)) out[k].push(...r[k]);
  }
  return out;
}

// ------------------------------------------------------------------
// Bar optimisation — see services/cuttingOptimizer.js
// ------------------------------------------------------------------
/**
 * cuts = [{ length, qty, label?, ref?, angle? }]
 * opts = { barLength, kerf, trim (début de barre), endTrim (fin de barre),
 *          spacing (espace entre chaque coupe), minReusableOffcut }
 */
function optimizeBars(cuts, opts = {}) {
  return optimizer.optimizeBars(cuts, opts);
}

/** Bar-cutting options from the production settings (overrides win). */
function barOptions(settings = {}, barLength, overrides = {}, depth = 0) {
  const pick = (k, sk, def) => (overrides[k] !== undefined && overrides[k] !== null && overrides[k] !== "" ? Number(overrides[k]) : settings[sk] ?? def);
  return {
    barLength: barLength || Number(settings.defaultBarLength) || 6500,
    kerf: pick("kerf", "kerf", 4),
    trim: pick("trim", "trimAllowance", 10),
    endTrim: pick("endTrim", "barEndTrim", 0),
    spacing: pick("spacing", "cutSpacing", 0),
    minReusableOffcut: pick("minReusableOffcut", "minReusableOffcut", 600),
    // Tête-bêche mitres need the profile width in the mitre plane (article "profileDepth").
    depth: Number(depth) || 0,
    nest: overrides.nest !== undefined && overrides.nest !== "" ? !(overrides.nest === false || overrides.nest === "false" || overrides.nest === "0") : settings.mitreNesting !== false,
  };
}

/** Glass / sheet cutting options from the production settings (overrides win). */
function sheetOptions(settings = {}, overrides = {}) {
  const has = (k) => overrides[k] !== undefined && overrides[k] !== null && overrides[k] !== "";
  return {
    edgeTrim: has("edgeTrim") ? Number(overrides.edgeTrim) : settings.glassEdgeTrim ?? 10,
    gap: has("gap") ? Number(overrides.gap) : settings.glassCutGap ?? 2,
    allowRotation: has("allowRotation") ? !(overrides.allowRotation === false || overrides.allowRotation === "false" || overrides.allowRotation === "0") : settings.glassAllowRotation !== false,
  };
}

// ------------------------------------------------------------------
// Stock-unit conversion
// ------------------------------------------------------------------
function stockUnitLabel(product) {
  const mode = product?.stockMode || "unit";
  return { bar: "barre", meter: "m", m2: "m²", sheet: "plaque", kg: "kg" }[mode] || product?.unit || "u";
}

/**
 * Turns an aggregated need into a quantity in the article's stock unit.
 * need = { measure, pieces, totalLength (mm), area (m²), cuts, waste }
 */
function toStockQuantity(need, product, settings = {}) {
  const mode = product?.stockMode || (need.measure === "length" ? "meter" : need.measure === "area" ? "m2" : "unit");
  const waste = 1 + (Number(need.waste) || 0) / 100;
  const pack = Number(product?.packSize) > 0 ? Number(product.packSize) : 1;
  const result = { quantity: 0, unit: stockUnitLabel(product || { stockMode: mode }), cutPlan: null, warning: "" };
  if (need.measure === "length") {
    const meters = need.totalLength / 1000;
    if (mode === "bar") {
      const barLength = Number(product?.barLength) || Number(settings.defaultBarLength) || 6500;
      const plan = optimizeBars(need.cuts || [], barOptions(settings, barLength, {}, geometryOf(product).hp));
      result.quantity = plan.bars;
      result.cutPlan = plan;
      if (plan.oversize.length) result.warning = `${plan.oversize.length} pièce(s) plus longue(s) que la barre (${barLength} mm)`;
    } else if (mode === "kg") {
      if (Number(product?.weightPerMeter) > 0) result.quantity = meters * waste * Number(product.weightPerMeter);
      else { result.quantity = meters * waste; result.warning = "Poids au mètre non renseigné : quantité en mètres"; }
    } else if (mode === "unit") {
      result.quantity = (meters * waste) / pack;
      if (pack === 1) result.warning = "Article compté à l'unité : indiquez le conditionnement (m par unité)";
    } else {
      result.quantity = meters * waste;
    }
  } else if (need.measure === "area") {
    const glassWaste = need.kind === "glass" && !need.waste ? 1 + (Number(settings.glassWastePercent) || 0) / 100 : waste;
    const m2 = need.area * glassWaste;
    if (mode === "sheet") {
      const sheet = (Number(product?.sheetWidth) || 0) * (Number(product?.sheetHeight) || 0) / 1e6;
      if (sheet > 0) result.quantity = Math.ceil(m2 / sheet - 1e-9);
      else { result.quantity = m2; result.warning = "Format de plaque non renseigné : quantité en m²"; }
    } else if (mode === "unit") {
      result.quantity = m2 / pack;
    } else {
      result.quantity = m2;
    }
  } else {
    result.quantity = (need.pieces * waste) / (mode === "unit" ? pack : 1);
  }
  result.quantity = round(result.quantity, 3);
  return result;
}

/**
 * Groups lines per (workshop, article, colour) and converts to stock
 * units. `resolveProduct(line)` returns the article actually consumed
 * (the colour variant for "project" lines) — default: the line's own.
 */
function aggregateNeeds(lines, ctx, resolveProduct = (l) => l.product) {
  const groups = new Map();
  for (const l of lines) {
    const product = resolveProduct(l);
    const key = [l.workshop, product || `?${l.role}|${l.label}`, l.finish || "", l.measure].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        workshop: l.workshop, product, baseProduct: l.product, finish: l.finish, kind: l.kind, measure: l.measure,
        label: l.label, pieces: 0, totalLength: 0, area: 0, waste: l.waste, cuts: [], pieceList: [],
      });
    }
    const g = groups.get(key);
    g.pieces += l.pieces;
    g.waste = Math.max(g.waste, l.waste);
    if (l.measure === "length") {
      g.totalLength += l.length * l.pieces;
      const existing = g.cuts.find((c) => c.length === l.length && c.angle === l.angle && c.ref === l.itemRef && c.label === l.label);
      if (existing) existing.qty += l.pieces; else g.cuts.push({ length: l.length, qty: l.pieces, angle: l.angle, label: l.label, ref: l.itemRef });
    } else if (l.measure === "area") {
      g.area += (l.width * l.height * l.pieces) / 1e6;
      const existing = g.pieceList.find((c) => c.width === l.width && c.height === l.height && c.ref === l.itemRef && c.label === l.label);
      if (existing) existing.qty += l.pieces; else g.pieceList.push({ width: l.width, height: l.height, qty: l.pieces, label: l.label, ref: l.itemRef });
    }
  }
  const needs = [];
  for (const g of groups.values()) {
    const product = g.product ? ctx.products.get(String(g.product)) || ctx.products.get(String(g.baseProduct)) : null;
    const conv = toStockQuantity(g, product, ctx.settings || {});
    needs.push({
      ...g,
      totalLength: round(g.totalLength, 1),
      area: round(g.area, 4),
      pieces: round(g.pieces, 3),
      theoretical: conv.quantity,
      unit: conv.unit,
      cutPlan: conv.cutPlan || undefined,
      barLength: conv.cutPlan?.barLength || undefined,
      cuts: g.measure === "length" ? g.cuts : undefined,
      pieceList: g.measure === "area" ? g.pieceList : undefined,
      warning: !g.product ? `Article non défini pour « ${g.label} »` : conv.warning,
      materialType: product?.materialType || "",
    });
  }
  return needs;
}

// ------------------------------------------------------------------
// Costing & pricing
// ------------------------------------------------------------------
/** Cost price of one STOCK unit of an article. */
function unitCostOf(product, products) {
  if (!product) return 0;
  if (Number(product.standardCost) > 0) return Number(product.standardCost);
  const prices = (product.prices || []).map((p) => Number(p.price)).filter((p) => p > 0);
  if (prices.length) return Math.min(...prices);
  if (product.baseProduct && products) {
    const base = products.get(String(idOf(product.baseProduct)));
    if (base && base !== product) return unitCostOf(base, null);
  }
  return 0;
}

/** Cost of the BASE measure (per mm, per m², per piece) of an article. */
function costPerMeasure(product, measure, products, settings = {}) {
  const c = unitCostOf(product, products);
  if (!c) return 0;
  const mode = product.stockMode || "unit";
  const pack = Number(product.packSize) > 0 ? Number(product.packSize) : 1;
  if (measure === "length") {
    if (mode === "bar") return c / (Number(product.barLength) || Number(settings.defaultBarLength) || 6500);
    if (mode === "meter") return c / 1000;
    if (mode === "kg") return (c * (Number(product.weightPerMeter) || 0)) / 1000;
    return c / (pack * 1000);
  }
  if (measure === "area") {
    if (mode === "sheet") {
      const sheet = (Number(product.sheetWidth) || 0) * (Number(product.sheetHeight) || 0) / 1e6;
      return sheet > 0 ? c / sheet : c;
    }
    if (mode === "unit") return c / pack;
    return c;
  }
  return mode === "unit" ? c / pack : c;
}

/** Painted m² of one base measure (per mm of profile, per m² of sheet). */
function paintAreaPerMeasure(product, measure, settings = {}) {
  if (measure === "length") {
    if (Number(product.perimeter) > 0) return Number(product.perimeter) / 1e6;
    if (Number(product.paintSurface) > 0) return Number(product.paintSurface) / (Number(product.barLength) || Number(settings.defaultBarLength) || 6500);
    return 0;
  }
  if (measure === "area") return 1;
  return 0;
}

/**
 * Proposed price of ONE chassis.
 * spec = { model, L, H, params, finish, quantity }
 */
function priceChassis(spec, ctx) {
  const model = ctx.models.get(idOf(spec.model));
  if (!model) return { error: "Modèle introuvable" };
  const r = expandItem({ ...spec, quantity: 1 }, ctx);
  const settings = ctx.settings || {};
  const profileWaste = 1 + (Number(settings.pricingProfileWaste ?? 10) / 100);
  const finish = spec.finish ? ctx.finishes.get(idOf(spec.finish)) : null;
  let materials = 0;
  let lacquer = 0;
  const missingPrices = new Set();
  const detail = [];
  for (const l of r.lines) {
    const base = l.product ? ctx.products.get(String(l.product)) : null;
    if (!base) continue;
    const lineFinish = l.finish ? ctx.finishes.get(String(l.finish)) : null;
    const variant = lineFinish && ctx.variantFor ? ctx.variantFor(base, lineFinish) : null;
    const quantityBase = l.measure === "length" ? l.length * l.pieces : l.measure === "area" ? (l.width * l.height * l.pieces) / 1e6 : l.pieces;
    const waste = l.measure === "length" && l.kind === "profile" ? profileWaste : 1 + (l.waste || 0) / 100;
    let unit = variant && unitCostOf(variant, null) ? costPerMeasure(variant, l.measure, ctx.products, settings) : costPerMeasure(base, l.measure, ctx.products, settings);
    if (!unit) missingPrices.add(base.name);
    let lacq = 0;
    // Lacquered in-house and no priced variant → raw price + powder.
    if (lineFinish && lineFinish.kind === "lacquer" && !(variant && unitCostOf(variant, null)) && (l.kind === "profile" || l.kind === "panel")) {
      const powder = lineFinish.powderProduct ? ctx.products.get(idOf(lineFinish.powderProduct)) : null;
      const coverage = Number(powder?.coverage) || Number(settings.defaultCoverage) || 0.12;
      const powderKg = unitCostOf(powder, ctx.products);
      lacq = paintAreaPerMeasure(base, l.measure, settings) * coverage * powderKg * quantityBase * waste;
    }
    const cost = unit * quantityBase * waste;
    materials += cost;
    lacquer += lacq;
    detail.push({ label: l.label, path: l.path, product: base.name, measure: l.measure, quantity: round(quantityBase, 3), cost: round(cost + lacq, 2) });
    unit = 0;
  }
  let labourMinutes = 0;
  let labour = 0;
  for (const l of r.labour) {
    labourMinutes += l.minutes;
    const w = ctx.workshops?.get(l.workshop);
    labour += (l.minutes / 60) * (Number(w?.hourlyRate) || 0);
  }
  const cost = materials + lacquer + labour;
  const p = model.pricing || {};
  const areaM2 = (Number(spec.L) * Number(spec.H)) / 1e6;
  let price;
  let basis;
  if (p.mode === "per_m2" && Number(p.pricePerM2) > 0) {
    price = Math.max(areaM2, Number(p.minArea) || 0) * Number(p.pricePerM2);
    basis = `${round(Math.max(areaM2, Number(p.minArea) || 0), 3)} m² × ${p.pricePerM2}`;
  } else if (p.mode === "per_ml" && Number(p.pricePerMl) > 0) {
    price = (Number(spec.L) / 1000) * Number(p.pricePerMl);
    basis = `${round(Number(spec.L) / 1000, 3)} ml × ${p.pricePerMl}`;
  } else if (p.mode === "per_unit" && Number(p.pricePerUnit) > 0) {
    price = Number(p.pricePerUnit);
    basis = "prix unitaire";
  } else {
    const coef = Number(p.coefficient) || Number(settings.defaultCoefficient) || 1.8;
    price = cost * coef;
    basis = `coût × ${coef}`;
  }
  if (finish && Number(finish.surchargePercent) > 0) price *= 1 + Number(finish.surchargePercent) / 100;
  if (Number(p.minPrice) > 0) price = Math.max(price, Number(p.minPrice));
  return {
    unitPrice: round(price, 2),
    basis,
    cost: { materials: round(materials, 2), lacquer: round(lacquer, 2), labour: round(labour, 2), total: round(cost, 2) },
    labourMinutes: round(labourMinutes, 1),
    marginPercent: price > 0 ? round(((price - cost) / price) * 100, 1) : null,
    missingPrices: [...missingPrices],
    detail,
    errors: r.errors,
    warnings: r.warnings,
  };
}

/** Human description of a chassis line for the devis / invoice. */
/**
 * The pieces of a chassis designation, kept apart so a screen or a PDF
 * can lay them out: { name, series, size, finish, finishColor, options[] }.
 */
function describeChassisParts(spec, ctx) {
  const model = ctx.models.get(idOf(spec.model));
  if (!model) return null;
  const series = model.series ? ctx.series.get(idOf(model.series)) : null;
  const out = { name: model.name, series: null, size: `${round(spec.L, 0)} × ${round(spec.H, 0)} mm`, finish: null, finishColor: null, options: [] };
  // The series is named unless the model name already says it ("… — série 67").
  const lowerName = model.name.toLowerCase();
  if (series && !lowerName.includes(String(series.name).toLowerCase()) && !/\bs[ée]rie\b|\bseries\b/.test(lowerName)) out.series = `série ${series.name}`;
  const finish = spec.finish ? ctx.finishes.get(idOf(spec.finish)) : null;
  if (finish) { out.finish = finish.name ? `${finish.code} ${finish.name}` : finish.code; out.finishColor = finish.color || null; }
  for (const p of model.parameters || []) {
    if (p.fixed) continue;
    const raw = spec.params?.[p.key];
    const v = paramValue(p, raw);
    if (p.type === "boolean") { if (v) out.options.push(p.label); continue; }
    if (p.type === "choice") { const o = (p.options || []).find((x) => Number(x.value) === Number(v)); if (o) out.options.push(`${p.label} : ${o.label}`); continue; }
    if (p.type === "model") { const m = v ? ctx.models.get(v) || ctx.glassTypes?.get(v) : null; if (m) out.options.push(`${p.label} : ${m.name}`); continue; }
    if (p.type === "product") { const pr = v ? ctx.products.get(v) : null; if (pr) out.options.push(`${p.label} : ${pr.name}`); continue; }
    if (p.type === "number" && raw !== undefined && raw !== null && raw !== "" && Number(raw) !== Number(p.default)) out.options.push(`${p.label} : ${v}${p.unit ? ` ${p.unit}` : ""}`);
  }
  return out;
}

function describeChassis(spec, ctx) {
  const d = describeChassisParts(spec, ctx);
  if (!d) return "";
  return [d.name, d.series, d.size, d.finish, ...d.options].filter(Boolean).join(" — ");
}

module.exports = {
  buildVariables, geometryOf, geometryVarNames, GEOM_KEYS, expandItem, expandItems, expandGlassType, optimizeBars, barOptions, sheetOptions, toStockQuantity, aggregateNeeds,
  unitCostOf, costPerMeasure, paintAreaPerMeasure, priceChassis, describeChassis, describeChassisParts, stockUnitLabel, paramValue, round, idOf,
};
