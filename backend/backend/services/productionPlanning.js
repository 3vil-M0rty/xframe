/**
 * ============================================================
 * PRODUCTION PLANNING — project ouvrages → work orders (OF)
 * ============================================================
 *   ensureProductionDefaults(companyId)  LAQ / ALU / VIT workshops (Laquage
 *                                        and Vitrage feed Aluminium), the
 *                                        BRUT finish and the settings doc
 *   loadContext(companyId)               everything the BOM engine needs
 *   computeProjectPlan(project, ctx)     needs per workshop (preview)
 *   createOrdersForProject(project, u)   saves the work orders
 *   consume(order, lines, user)          books consumptions (stock out)
 *   completeOrder(order, body, user)     finishes an order (laquage:
 *                                        lacquered bars into stock)
 *
 * Colour variants: a component with finish "project" consumes the
 * article IN THE COLOUR of the ouvrage — a separate stock article
 * ("Profilé 4020 — RAL 9016", baseProduct → raw article) created on
 * demand. When that colour is lacquered in-house (Finish.kind
 * "lacquer" + processWorkshop), a Laquage order turns raw bars + powder
 * into that variant; otherwise the variant is bought ready-made.
 *
 * Costing: Laquage consumptions are NOT charged to the project (they
 * become the cost price of the lacquered bars); the Aluminium order
 * then consumes those bars at that cost — so nothing is counted twice.
 * ============================================================
 */
const Product = require("../models/Product");
const Workshop = require("../models/Workshop");
const Finish = require("../models/Finish");
const ProductionSettings = require("../models/ProductionSettings");
const ProfileSeries = require("../models/ProfileSeries");
const ChassisModel = require("../models/ChassisModel");
const GlassType = require("../models/GlassType");
const ProductionOrder = require("../models/ProductionOrder");
const { createWithNumber } = require("./documentNumberService");
const { applyMovement } = require("./inventoryService");
const bom = require("./chassisBom");
const optimizer = require("./cuttingOptimizer");

const { round, idOf } = bom;
const httpError = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

// ------------------------------------------------------------------
// Defaults
// ------------------------------------------------------------------
async function ensureProductionDefaults(companyId) {
  let settings = await ProductionSettings.findOne({ company: companyId });
  if (!settings) {
    try { settings = await ProductionSettings.create({ company: companyId }); } catch (e) { if (e.code !== 11000) throw e; settings = await ProductionSettings.findOne({ company: companyId }); }
  }
  const count = await Workshop.countDocuments({ company: companyId });
  if (count === 0) {
    try {
      const alu = await Workshop.create({ company: companyId, code: "ALU", name: "Aluminium", kind: "aluminium", color: "#4c8dff", order: 2 });
      await Workshop.create({ company: companyId, code: "LAQ", name: "Laquage", kind: "laquage", color: "#e8793f", order: 1, feeds: [alu._id] });
      await Workshop.create({ company: companyId, code: "VIT", name: "Vitrage", kind: "vitrage", color: "#3fb8c4", order: 3, feeds: [alu._id] });
    } catch (e) { if (e.code !== 11000) throw e; }
  }
  if (!(await Finish.exists({ company: companyId }))) {
    try { await Finish.create({ company: companyId, code: "BRUT", name: "Brut / non traité", kind: "raw", color: "#b8bcc2" }); } catch (e) { if (e.code !== 11000) throw e; }
  }
  return settings;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
async function loadProducts(ctx, ids) {
  const missing = [...new Set(ids.filter(Boolean).map(String))].filter((id) => !ctx.products.has(id) && /^[a-f0-9]{24}$/i.test(id));
  if (!missing.length) return;
  const rows = await Product.find({ _id: { $in: missing } }).lean();
  for (const p of rows) ctx.products.set(String(p._id), p);
  const variants = await Product.find({ baseProduct: { $in: rows.map((p) => p._id) } }).lean();
  for (const v of variants) {
    ctx.products.set(String(v._id), v);
    if (v.finish) ctx.variants.set(`${v.baseProduct}|${v.finish}`, v);
  }
}

async function loadContext(companyId, { productIds = [] } = {}) {
  const settings = (await ensureProductionDefaults(companyId)).toObject();
  const [models, series, finishes, workshops, glassTypes] = await Promise.all([
    ChassisModel.find({ company: companyId, isActive: true }).lean(),
    ProfileSeries.find({ company: companyId }).lean(),
    Finish.find({ company: companyId }).lean(),
    Workshop.find({ company: companyId, isActive: true }).sort({ order: 1 }).lean(),
    GlassType.find({ company: companyId, isActive: true }).lean(),
  ]);
  const ctx = {
    companyId: String(companyId),
    settings,
    models: new Map(models.map((m) => [String(m._id), m])),
    series: new Map(series.map((s) => [String(s._id), s])),
    finishes: new Map(finishes.map((f) => [String(f._id), f])),
    workshops: new Map(workshops.map((w) => [w.code, w])),
    workshopsById: new Map(workshops.map((w) => [String(w._id), w])),
    glassTypes: new Map(glassTypes.map((g) => [String(g._id), g])),
    products: new Map(),
    variants: new Map(),
  };
  const ids = [...productIds];
  for (const m of models) {
    for (const c of m.components || []) if (c.product) ids.push(String(c.product));
    for (const p of m.parameters || []) if (p.type === "product" && p.default) ids.push(String(p.default));
  }
  for (const f of finishes) if (f.powderProduct) ids.push(String(f.powderProduct));
  for (const g of glassTypes) {
    for (const l of g.layers || []) for (const sh of l.sheets || []) ids.push(String(sh));
    for (const x of g.extras || []) if (x.product) ids.push(String(x.product));
  }
  await loadProducts(ctx, ids);
  ctx.variantFor = (base, finish) => variantFor(ctx, base, finish);
  return ctx;
}

/** The article consumed for `base` in colour `finish` (null = not created yet). */
function variantFor(ctx, base, finish) {
  if (!base) return null;
  if (!finish || finish.kind === "raw" || base.finish) return base; // raw colour, or already a colour article
  return ctx.variants.get(`${base._id}|${finish._id}`) || null;
}

const safeRef = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12);

/** Finds or creates the colour variant of a raw article. */
async function ensureVariant(ctx, base, finish, actorId) {
  const existing = variantFor(ctx, base, finish);
  if (existing) return existing;
  const ref = base.internalReference ? `${base.internalReference}-${safeRef(finish.code)}` : "";
  let doc;
  try {
    doc = await Product.create({
      company: base.company,
      category: base.category,
      name: `${base.name} — ${finish.code}${finish.name ? ` ${finish.name}` : ""}`.slice(0, 200),
      internalReference: ref || undefined,
      quantity: 0,
      unit: base.unit,
      threshold: 0,
      prices: [],
      currency: base.currency,
      materialType: base.materialType,
      stockMode: base.stockMode,
      barLength: base.barLength,
      profileDepth: base.profileDepth,
      profileChamber: base.profileChamber,
      profileOuterFin: base.profileOuterFin,
      profileInnerFin: base.profileInnerFin,
      profileHeight: base.profileHeight,
      profileWidth: base.profileWidth,
      sheetWidth: base.sheetWidth,
      sheetHeight: base.sheetHeight,
      packSize: base.packSize,
      weightPerMeter: base.weightPerMeter,
      perimeter: base.perimeter,
      paintSurface: base.paintSurface,
      thickness: base.thickness,
      baseProduct: base._id,
      finish: finish._id,
      notes: `Variante couleur de ${base.name}`,
      createdBy: actorId,
      updatedBy: actorId,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    doc = await Product.findOne({ baseProduct: base._id, finish: finish._id });
    if (!doc) doc = await Product.create({ company: base.company, category: base.category, name: `${base.name} — ${finish.code}`, quantity: 0, unit: base.unit, baseProduct: base._id, finish: finish._id, stockMode: base.stockMode, barLength: base.barLength, materialType: base.materialType });
  }
  const lean = doc.toObject ? doc.toObject() : doc;
  ctx.products.set(String(lean._id), lean);
  ctx.variants.set(`${base._id}|${finish._id}`, lean);
  return lean;
}

// ------------------------------------------------------------------
// Laquage maths
// ------------------------------------------------------------------
/** m² painted for ONE stock unit of a raw article. */
function paintSurfacePerUnit(product, settings) {
  if (Number(product.paintSurface) > 0) return Number(product.paintSurface);
  const mode = product.stockMode || "unit";
  const perimeter = Number(product.perimeter) || 0;
  if (mode === "bar") return (perimeter * (Number(product.barLength) || Number(settings.defaultBarLength) || 6500)) / 1e6;
  if (mode === "meter") return perimeter / 1000;
  if (mode === "sheet") return ((Number(product.sheetWidth) || 0) * (Number(product.sheetHeight) || 0)) / 1e6;
  if (mode === "m2") return 1;
  return 0;
}

/** kg of powder to lacquer `quantity` stock units of `product`. */
function powderFor(product, quantity, powder, settings) {
  const waste = 1 + (Number(settings.powderWastePercent) || 0) / 100;
  if (settings.powderMethod === "manual") return { kg: 0, surface: round(paintSurfacePerUnit(product, settings) * quantity, 3), warning: "" };
  const surface = paintSurfacePerUnit(product, settings) * quantity;
  if (settings.powderMethod === "per_unit") {
    if (Number(product.powderPerUnit) > 0) return { kg: round(Number(product.powderPerUnit) * quantity * waste, 3), surface: round(surface, 3), warning: "" };
    return { kg: 0, surface: round(surface, 3), warning: `Poudre par unité non renseignée pour ${product.name}` };
  }
  const coverage = Number(powder?.coverage) || Number(settings.defaultCoverage) || 0;
  if (!surface) return { kg: 0, surface: 0, warning: `Surface laquable non renseignée pour ${product.name} (périmètre ou surface)` };
  return { kg: round(surface * coverage * waste, 3), surface: round(surface, 3), warning: "" };
}

// ------------------------------------------------------------------
// Glass: plateau choice + cutting optimisation
// ------------------------------------------------------------------
const isSheet = (p) => p && p.stockMode === "sheet" && Number(p.sheetWidth) > 0 && Number(p.sheetHeight) > 0;

/** Glass lines that can be cut from plateaux (sheet articles) vs the rest. */
function splitGlassLines(lines, ctx) {
  const glass = [];
  const rest = [];
  for (const l of lines) {
    if (l.measure !== "area" || l.kind !== "glass" || !l.product) { rest.push(l); continue; }
    const ids = (l.glassCandidates?.length ? l.glassCandidates : [l.product]).map(String);
    const candidates = [...new Set(ids)].map((id) => ctx.products.get(id)).filter(isSheet);
    if (!candidates.length) { rest.push(l); continue; }
    glass.push({ ...l, candidates });
  }
  return { glass, rest };
}

/**
 * Groups the panes by workshop and allowed plateaux, picks the plateaux
 * from the stock and computes the cutting layouts. One need per plateau
 * article actually used, in plateaux (sheets).
 */
function planGlass(lines, ctx, warnings = [], stock = new Map()) {
  const groups = new Map();
  for (const l of lines) {
    const ids = l.candidates.map((p) => String(p._id)).sort();
    const key = `${l.workshop}|${ids.join(",")}`;
    if (!groups.has(key)) groups.set(key, { workshop: l.workshop, candidates: l.candidates, labels: new Set(), pieces: [] });
    const g = groups.get(key);
    g.labels.add(l.label);
    const qty = Math.round(Number(l.pieces) || 0);
    if (Math.abs(qty - (Number(l.pieces) || 0)) > 1e-6) warnings.push({ where: l.path, message: `${l.label} : quantité de vitrage non entière (${l.pieces}) arrondie à ${qty}` });
    if (!(qty > 0)) continue;
    const existing = g.pieces.find((x) => x.width === l.width && x.height === l.height && x.ref === l.itemRef && x.label === l.label);
    if (existing) existing.qty += qty; else g.pieces.push({ width: l.width, height: l.height, qty, label: l.label, ref: l.itemRef });
  }
  const opts = bom.sheetOptions(ctx.settings || {});
  const needs = [];
  for (const g of groups.values()) {
    const candidates = g.candidates.map((p) => {
      const id = String(p._id);
      if (!stock.has(id)) stock.set(id, Number(p.quantity) || 0);
      return { id, name: p.name, width: Number(p.sheetWidth), height: Number(p.sheetHeight), stock: stock.get(id) };
    });
    const { allocations, unfit } = optimizer.allocateSheets(g.pieces, candidates, opts);
    for (const c of candidates) stock.set(c.id, Math.max(0, c.stock));
    const label = g.labels.size === 1 ? [...g.labels][0] : `Vitrages (${g.labels.size} compositions)`;
    for (const a of allocations) {
      const product = ctx.products.get(a.candidate.id);
      needs.push({
        workshop: g.workshop, product: a.candidate.id, baseProduct: a.candidate.id, finish: null, kind: "glass", measure: "area",
        label, pieces: a.pieceList.reduce((s, x) => s + x.qty, 0), totalLength: 0, area: round(a.area, 4), waste: 0,
        pieceList: a.pieceList,
        theoretical: a.plan.count,
        unit: "plaque",
        candidates: candidates.map((c) => c.id),
        cutPlan: {
          type: "sheet", sheetWidth: a.plan.sheetWidth, sheetHeight: a.plan.sheetHeight, count: a.plan.count,
          efficiency: a.plan.efficiency, settings: a.plan.settings, fromStock: a.fromStock, toBuy: a.toBuy,
          patterns: optimizer.compactSheets(a.plan.sheets),
        },
        warning: a.toBuy ? `${a.toBuy} plateau(x) ${a.plan.sheetWidth} × ${a.plan.sheetHeight} à acheter` : "",
        materialType: product?.materialType || "glass",
      });
    }
    if (unfit.length) {
      const list = optimizer.piecesToList(unfit);
      const area = unfit.reduce((s, x) => s + (x.width * x.height) / 1e6, 0);
      warnings.push({ where: label, message: `${unfit.length} vitrage(s) plus grand(s) que les plateaux autorisés (${candidates.map((c) => `${c.width}×${c.height}`).join(", ")})` });
      needs.push({
        workshop: g.workshop, product: null, baseProduct: null, finish: null, kind: "glass", measure: "area",
        label: `${label} — hors format`, pieces: unfit.length, totalLength: 0, area: round(area, 4), waste: 0,
        pieceList: list, theoretical: round(area, 3), unit: "m²", candidates: candidates.map((c) => c.id),
        warning: "Plus grand que les plateaux autorisés : à commander à la dimension", materialType: "glass",
      });
    }
  }
  return needs;
}

// ------------------------------------------------------------------
// Plan (preview)
// ------------------------------------------------------------------
/**
 * Computes, for a project, what each workshop must produce and consume.
 * Returns { workshops: [{ workshop, items, needs, outputs, labourMinutes, dependsOnCodes }], errors, warnings }.
 * Needs carry `stock` (current quantity) and `shortage`.
 */
async function computeProjectPlan(project, ctx) {
  const items = (project.items || []).map((it) => ({ ...it, finish: it.finish || project.finish || null }));
  // Product parameters chosen on the lines (e.g. a glass) may not be loaded yet.
  const paramIds = [];
  for (const it of items) for (const v of Object.values(it.params || {})) if (typeof v === "string" && /^[a-f0-9]{24}$/i.test(v)) paramIds.push(v);
  await loadProducts(ctx, paramIds);

  const expanded = bom.expandItems(items, ctx);
  const warnings = [...expanded.warnings];
  const errors = [...expanded.errors];

  const fallbackAlu = [...ctx.workshops.values()].find((w) => w.kind === "aluminium") || [...ctx.workshops.values()][0];
  const workshopCode = (code) => {
    if (ctx.workshops.has(code)) return code;
    if (fallbackAlu) {
      warnings.push({ where: code, message: `Atelier « ${code} » inconnu : rattaché à ${fallbackAlu.name}` });
      return fallbackAlu.code;
    }
    return code;
  };
  for (const l of expanded.lines) l.workshop = workshopCode(l.workshop);

  // Resolve the article actually consumed (colour variant).
  const virtual = new Map();
  const resolve = (l) => {
    if (!l.product) return null;
    const base = ctx.products.get(String(l.product));
    if (!base) return l.product;
    const finish = l.finish ? ctx.finishes.get(String(l.finish)) : null;
    const v = variantFor(ctx, base, finish);
    if (v) return String(v._id);
    const key = `v:${base._id}|${finish._id}`;
    virtual.set(key, { base, finish });
    return key;
  };
  // Glass cut from plateaux: the plateau is chosen from the stock and the
  // panes are nested on it (cutting plan); everything else as before.
  const { glass, rest } = splitGlassLines(expanded.lines, ctx);
  const needs = [...bom.aggregateNeeds(rest, ctx, resolve), ...planGlass(glass, ctx, warnings)];

  const byWorkshop = new Map();
  const bucket = (code) => {
    if (!byWorkshop.has(code)) byWorkshop.set(code, { workshop: ctx.workshops.get(code) || { code, name: code }, items: [], needs: [], outputs: [], labourMinutes: 0 });
    return byWorkshop.get(code);
  };

  // Items: top-level ouvrages → their model's workshop; sub-assemblies that
  // cross into another workshop (a glass unit in a window) → that workshop.
  for (const it of items) {
    const model = ctx.models.get(idOf(it.model));
    if (!model) continue;
    bucket(workshopCode(model.defaultWorkshop || "ALU")).items.push({
      projectItem: it._id || null, ref: it.ref || "", label: it.label || bom.describeChassis(it, ctx), model: model._id,
      finish: it.finish || null, L: it.L, H: it.H, quantity: it.quantity,
    });
  }
  for (const a of expanded.assemblies) {
    const w = workshopCode(a.workshop);
    if (w === workshopCode(a.parentWorkshop)) continue;
    bucket(w).items.push({ projectItem: null, ref: a.itemRef, label: `${a.path} — ${a.name}`, model: a.model, finish: null, L: a.width, H: a.height, quantity: a.pieces });
  }
  for (const l of expanded.labour) bucket(workshopCode(l.workshop)).labourMinutes += l.minutes;

  // Needs → workshops, with stock and lacquering.
  const laquage = new Map(); // workshopCode → { outputs: Map, powder: Map }
  for (const n of needs) {
    const isVirtual = typeof n.product === "string" && n.product.startsWith("v:");
    const product = n.product && !isVirtual ? ctx.products.get(String(n.product)) : null;
    const base = n.baseProduct ? ctx.products.get(String(n.baseProduct)) : null;
    const stock = isVirtual ? 0 : Number(product?.quantity) || 0;
    const need = {
      ...n,
      product: isVirtual ? null : n.product,
      virtualVariant: isVirtual ? { base: String(virtual.get(n.product).base._id), finish: String(virtual.get(n.product).finish._id) } : null,
      productName: product?.name || (isVirtual ? `${base?.name} — ${virtual.get(n.product).finish.code}` : base?.name || null),
      stock,
      unitCost: bom.unitCostOf(product || base, ctx.products),
    };
    bucket(n.workshop).needs.push(need);

    // Lacquered in-house?
    const finish = n.finish ? ctx.finishes.get(String(n.finish)) : null;
    if (!finish || finish.kind !== "lacquer" || !finish.processWorkshop || !base || base.finish) continue;
    if (!["profile", "panel"].includes(n.kind)) continue;
    const lw = ctx.workshopsById.get(String(finish.processWorkshop));
    if (!lw) { warnings.push({ where: finish.code, message: `Atelier de laquage de ${finish.code} introuvable` }); continue; }
    const available = ctx.settings.lacquerFromStockFirst ? stock : 0;
    let toLacquer = Math.max(0, n.theoretical - available);
    if (["bar", "sheet", "unit"].includes(base.stockMode || "unit")) toLacquer = Math.ceil(toLacquer - 1e-9);
    need.fromStock = round(Math.min(available, n.theoretical), 3);
    need.toLacquer = round(toLacquer, 3);
    if (!(toLacquer > 0)) continue;
    if (!laquage.has(lw.code)) laquage.set(lw.code, { outputs: new Map(), powder: new Map() });
    const L = laquage.get(lw.code);
    const key = `${base._id}|${finish._id}`;
    const powder = finish.powderProduct ? ctx.products.get(String(finish.powderProduct)) : null;
    const out = L.outputs.get(key) || { product: base._id, productName: base.name, variant: isVirtual ? null : n.product, finish: finish._id, finishCode: finish.code, quantity: 0, paintSurface: 0, unit: n.unit };
    out.quantity = round(out.quantity + toLacquer, 3);
    const p = powderFor(base, toLacquer, powder, ctx.settings);
    out.paintSurface = round(out.paintSurface + p.surface, 3);
    if (p.warning) warnings.push({ where: base.name, message: p.warning });
    L.outputs.set(key, out);
    const pkey = finish.powderProduct ? String(finish.powderProduct) : `?${finish._id}`;
    const pw = L.powder.get(pkey) || { product: finish.powderProduct || null, finish: finish._id, label: `Poudre ${finish.code}${finish.name ? ` ${finish.name}` : ""}`, kg: 0, surface: 0 };
    pw.kg = round(pw.kg + p.kg, 3);
    pw.surface = round(pw.surface + p.surface, 3);
    L.powder.set(pkey, pw);
  }

  for (const [code, L] of laquage) {
    const b = bucket(code);
    for (const o of L.outputs.values()) {
      b.outputs.push(o);
      b.items.push({ projectItem: null, ref: "", label: `${o.productName} → ${o.finishCode}`, product: o.product, finish: o.finish, quantity: o.quantity });
      const base = ctx.products.get(String(o.product));
      b.needs.push({
        workshop: code, product: String(o.product), baseProduct: String(o.product), finish: null, kind: base?.materialType || "profile",
        materialType: base?.materialType || "profile", measure: "count", label: `${base?.name} (brut, à laquer)`, productName: base?.name,
        pieces: o.quantity, theoretical: o.quantity, unit: bom.stockUnitLabel(base), stock: Number(base?.quantity) || 0,
        unitCost: bom.unitCostOf(base, ctx.products), warning: "",
      });
    }
    for (const pw of L.powder.values()) {
      const powder = pw.product ? ctx.products.get(String(pw.product)) : null;
      b.needs.push({
        workshop: code, product: pw.product ? String(pw.product) : null, baseProduct: pw.product ? String(pw.product) : null, finish: null,
        kind: "powder", materialType: "powder", measure: "count", label: pw.label, productName: powder?.name || null,
        pieces: pw.kg, theoretical: pw.kg, unit: "kg", stock: Number(powder?.quantity) || 0, unitCost: bom.unitCostOf(powder, ctx.products),
        warning: !pw.product ? `Aucune poudre associée à cette couleur (Production → Configuration → Couleurs)` : ctx.settings.powderMethod === "manual" ? "Poudre saisie à la main (méthode manuelle)" : "",
        surface: pw.surface,
      });
    }
  }

  const workshops = [...byWorkshop.values()]
    .filter((w) => w.items.length || w.needs.length)
    .map((w) => {
      // Lacquered in-house: what is not in stock is covered by the laquage order.
      for (const n of w.needs) n.shortage = n.toLacquer !== undefined ? 0 : round(Math.max(0, n.theoretical - n.stock), 3);
      // Glazing feeds Aluminium but doesn't hold it up: the chassis are made, then glazed
      // when the glass units arrive (received on the Aluminium order).
      const feeders = [...ctx.workshops.values()].filter((x) => x.kind !== "vitrage" && (x.feeds || []).some((f) => String(f) === String(w.workshop._id))).map((x) => x.code);
      return { ...w, labourMinutes: round(w.labourMinutes, 1), dependsOnCodes: feeders };
    })
    .sort((a, b) => (a.workshop.order || 0) - (b.workshop.order || 0));

  // Stock shortages are per ARTICLE across workshops: recompute globally.
  const demand = new Map();
  for (const w of workshops) for (const n of w.needs) if (n.product) demand.set(String(n.product), (demand.get(String(n.product)) || 0) + (n.toLacquer !== undefined ? n.fromStock : n.theoretical));
  const shortages = [];
  for (const [id, qty] of demand) {
    const p = ctx.products.get(id);
    const missing = round(qty - (Number(p?.quantity) || 0), 3);
    if (missing > 0) shortages.push({ product: id, name: p?.name, unit: bom.stockUnitLabel(p), needed: round(qty, 3), stock: Number(p?.quantity) || 0, missing });
  }
  for (const w of workshops) for (const n of w.needs) if (!n.product && n.virtualVariant && !n.toLacquer) shortages.push({ product: null, name: n.productName, unit: n.unit, needed: n.theoretical, stock: 0, missing: n.theoretical, variant: true });

  return { workshops, errors, warnings, shortages, lines: expanded.lines.length };
}

// ------------------------------------------------------------------
// Save as work orders
// ------------------------------------------------------------------
/**
 * opts.onlyMissing: the project is already running — only create the
 * orders of the workshops that have none yet (e.g. the glazing order
 * after the glass units were chosen), keep the others untouched.
 */
async function createOrdersForProject(project, actorId, { onlyMissing = false } = {}) {
  const started = await ProductionOrder.find({ project: project._id, status: { $in: ["in_progress", "done"] } }).select("number").lean();
  if (started.length && !onlyMissing) throw httpError(`Des ordres de fabrication sont déjà commencés (${started.map((o) => o.number).join(", ")}). Annulez-les ou créez un OF manuel.`, 409);
  if (!(project.items || []).length) throw httpError("Ajoutez d'abord des ouvrages (châssis) au projet");

  const ctx = await loadContext(project.company);
  const plan = await computeProjectPlan(project.toObject ? project.toObject() : project, ctx);
  if (plan.errors.length) throw httpError("Des formules sont en erreur : corrigez le catalogue avant de lancer la fabrication", 400, { details: plan.errors });

  // Materialise the colour variants.
  for (const w of plan.workshops) {
    for (const n of w.needs) {
      if (n.virtualVariant) {
        const base = ctx.products.get(n.virtualVariant.base);
        const finish = ctx.finishes.get(n.virtualVariant.finish);
        const v = await ensureVariant(ctx, base, finish, actorId);
        n.product = String(v._id);
      }
    }
    for (const o of w.outputs) {
      if (!o.variant) {
        const v = await ensureVariant(ctx, ctx.products.get(String(o.product)), ctx.finishes.get(String(o.finish)), actorId);
        o.variant = v._id;
      }
    }
  }

  // Replace the orders not started yet (or, onlyMissing, keep every existing one).
  const existing = onlyMissing ? await ProductionOrder.find({ project: project._id, status: { $ne: "cancelled" } }) : [];
  const existingByWorkshop = new Map(existing.map((o) => [String(o.workshop), o]));
  if (!onlyMissing) await ProductionOrder.deleteMany({ project: project._id, status: { $in: ["draft", "planned"] } });

  const created = new Map();
  for (const w of plan.workshops) {
    if (!w.workshop._id) continue;
    if (existingByWorkshop.has(String(w.workshop._id))) continue;
    const order = await createWithNumber(ProductionOrder, {
      company: project.company,
      workshop: w.workshop._id,
      kind: w.workshop.kind || "other",
      project: project._id,
      customer: project.customer || null,
      title: `${project.number} — ${project.name}`.slice(0, 200),
      status: "planned",
      dueDate: project.dueDate || null,
      items: w.items,
      needs: w.needs.map((n) => ({
        product: n.product || null, baseProduct: n.baseProduct || null, finish: n.finish || null, kind: n.kind, materialType: n.materialType,
        label: n.label, measure: n.measure, pieces: n.pieces, totalLength: n.totalLength || 0, area: n.area || 0,
        theoretical: n.toLacquer !== undefined ? n.theoretical : n.theoretical, unit: n.unit, unitCost: n.unitCost || 0,
        cuts: n.cuts, cutPlan: n.cutPlan, pieceList: n.pieceList, candidates: n.candidates, warning: n.warning || "",
      })),
      outputs: w.outputs.map((o) => ({ product: o.product, variant: o.variant, finish: o.finish, quantity: o.quantity, paintSurface: o.paintSurface })),
      labourMinutes: w.labourMinutes,
      history: [{ status: "planned", note: "Généré depuis les ouvrages du projet", by: actorId }],
      createdBy: actorId,
      updatedBy: actorId,
    }, "OF");
    created.set(w.workshop.code, { order, dependsOnCodes: w.dependsOnCodes });
  }
  const orderOfCode = (code) => created.get(code)?.order || existing.find((o) => String(o.workshop) === String(ctx.workshops.get(code)?._id));
  for (const { order, dependsOnCodes } of created.values()) {
    const deps = dependsOnCodes.map((c) => orderOfCode(c)?._id).filter(Boolean);
    if (deps.length) { order.dependsOn = deps; await order.save(); }
  }
  // Existing orders not started yet now wait for the new feeders too (Aluminium after a new Vitrage order).
  for (const o of existing) {
    if (o.status !== "planned" && o.status !== "draft") continue;
    const w = ctx.workshopsById.get(String(o.workshop));
    const feeders = [...ctx.workshops.values()].filter((x) => (x.feeds || []).some((f) => String(f) === String(w?._id))).map((x) => created.get(x.code)?.order?._id).filter(Boolean);
    if (feeders.length) { o.dependsOn = [...new Set([...(o.dependsOn || []).map(String), ...feeders.map(String)])]; await o.save(); }
  }
  return { orders: [...created.values()].map((c) => c.order), plan };
}

// ------------------------------------------------------------------
// Consumption & completion
// ------------------------------------------------------------------
async function productCost(product) {
  if (Number(product.standardCost) > 0) return Number(product.standardCost);
  const prices = (product.prices || []).map((p) => Number(p.price)).filter((p) => p > 0);
  if (prices.length) return Math.min(...prices);
  if (product.baseProduct) {
    const base = await Product.findById(product.baseProduct).select("standardCost prices").lean();
    if (base) return productCost(base);
  }
  return 0;
}

/** Books one consumption (quantity > 0: stock out ; < 0: return to stock). */
async function bookConsumption(order, need, quantity, actorId, note = "") {
  const product = await Product.findOne({ _id: need.product, company: order.company });
  if (!product) throw httpError(`Article introuvable pour « ${need.label} »`);
  const unitCost = await productCost(product);
  const isLaquage = order.kind === "laquage";
  if (quantity < 0 && need.consumed + quantity < -1e-9) throw httpError(`Retour supérieur à la quantité consommée pour « ${need.label} »`);
  await applyMovement({
    product,
    type: quantity >= 0 ? "out" : "in",
    quantity: Math.abs(quantity),
    reason: `${quantity >= 0 ? "Consommation" : "Retour"} ${order.number}${note ? ` — ${note}` : ""}`,
    actorId,
    // Laquage consumptions become the cost of the lacquered bars (see header).
    project: isLaquage ? null : order.project || null,
    unitCost,
    productionOrder: order._id,
    workshop: order.workshop,
  });
  need.consumed = round((need.consumed || 0) + quantity, 4);
  need.unitCost = unitCost;
  return unitCost * quantity;
}

/**
 * lines = [{ need: needId, quantity }] ; extra = [{ product, quantity, label? }]
 */
async function consume(order, { lines = [], extra = [] }, actorId) {
  if (["done", "cancelled"].includes(order.status)) throw httpError("Cet ordre est terminé ou annulé");
  let total = 0;
  for (const l of lines) {
    const q = Number(l.quantity);
    if (!q) continue;
    const need = order.needs.id(l.need);
    if (!need) throw httpError("Ligne de besoin introuvable");
    if (!need.product) throw httpError(`Aucun article défini pour « ${need.label} »`);
    total += await bookConsumption(order, need, q, actorId, l.note);
  }
  for (const e of extra) {
    const q = Number(e.quantity);
    if (!q || !e.product) continue;
    const product = await Product.findOne({ _id: e.product, company: order.company }).lean();
    if (!product) throw httpError("Article introuvable");
    let need = order.needs.find((n) => n.extra && String(n.product) === String(product._id));
    if (!need) {
      order.needs.push({ product: product._id, baseProduct: product.baseProduct || product._id, kind: product.materialType || "other", materialType: product.materialType || "", label: e.label || product.name, measure: "count", theoretical: 0, consumed: 0, unit: bom.stockUnitLabel(product), extra: true });
      need = order.needs[order.needs.length - 1];
    }
    total += await bookConsumption(order, need, q, actorId, e.note);
  }
  if (order.status === "planned" || order.status === "draft") {
    order.status = "in_progress";
    order.startedAt = order.startedAt || new Date();
    order.history.push({ status: "in_progress", note: "Premières consommations", by: actorId });
  }
  order.updatedBy = actorId;
  await order.save();
  return round(total, 2);
}

/**
 * Completes an order.
 * body = { consumeRemaining?: bool, outputs?: [{ output: id, produced, rejected }], items?: [{ item: id, done }], note }
 */
async function completeOrder(order, body, actorId, settings) {
  if (["done", "cancelled"].includes(order.status)) throw httpError("Cet ordre est déjà terminé ou annulé");
  const consumeRemaining = body.consumeRemaining ?? settings?.consumeOnComplete ?? true;
  if (consumeRemaining) {
    // Check stock first so nothing is half-booked.
    const shortages = [];
    const plan = [];
    for (const need of order.needs) {
      const remaining = round((need.theoretical || 0) - (need.consumed || 0), 4);
      if (!(remaining > 0) || !need.product) continue;
      if (order.kind === "laquage" && order.customerMaterial && need.kind !== "powder") continue;
      const product = await Product.findById(need.product).select("name quantity").lean();
      if (!product) continue;
      if ((product.quantity || 0) + 1e-9 < remaining) shortages.push({ label: need.label, product: product.name, needed: remaining, stock: product.quantity || 0 });
      plan.push({ need, remaining });
    }
    if (shortages.length && !body.force) throw httpError("Stock insuffisant pour clôturer l'ordre", 409, { shortages });
    order.$locals.shortages = shortages;
    for (const { need, remaining } of plan) {
      const product = await Product.findById(need.product).select("quantity").lean();
      const q = body.force ? Math.min(remaining, product?.quantity || 0) : remaining;
      if (q > 0) await bookConsumption(order, need, q, actorId, "clôture");
    }
  }
  // Laquage: lacquered variants into stock at their cost price.
  if (order.kind === "laquage" && !order.customerMaterial && order.outputs.length) {
    const byOutput = new Map((body.outputs || []).map((o) => [String(o.output), o]));
    const moves = await require("../models/InventoryMovement").find({ productionOrder: order._id }).lean();
    const cost = moves.reduce((s, m) => s + (m.type === "out" ? 1 : m.type === "in" && !m.reason?.startsWith("Production") ? -1 : 0) * (m.quantity || 0) * (m.unitCost || 0), 0);
    const totalQty = order.outputs.reduce((s, o) => {
      const b = byOutput.get(String(o._id));
      const produced = b ? Number(b.produced) : o.quantity - (b?.rejected || 0);
      return s + Math.max(0, produced);
    }, 0);
    // Cost is spread in proportion to painted surface when known, else per unit.
    const totalSurface = order.outputs.reduce((s, o) => s + (o.paintSurface || 0), 0);
    for (const o of order.outputs) {
      const b = byOutput.get(String(o._id));
      const rejected = Math.max(0, Number(b?.rejected) || 0);
      const produced = Math.max(0, b && b.produced !== undefined && b.produced !== "" ? Number(b.produced) : o.quantity - rejected);
      o.produced = produced;
      o.rejected = rejected;
      if (!(produced > 0)) continue;
      const variant = await Product.findOne({ _id: o.variant, company: order.company });
      if (!variant) continue;
      const share = totalSurface > 0 ? (o.paintSurface || 0) / totalSurface : produced / (totalQty || produced);
      const unitCost = produced > 0 ? round((cost * share) / produced, 4) : 0;
      const oldQty = variant.quantity || 0;
      const oldCost = Number(variant.standardCost) || 0;
      await applyMovement({ product: variant, type: "in", quantity: produced, reason: `Production ${order.number} (laquage)`, actorId, unitCost, productionOrder: order._id, workshop: order.workshop });
      // Weighted average cost price of the lacquered article.
      const fresh = await Product.findById(variant._id);
      fresh.standardCost = round((oldQty * oldCost + produced * unitCost) / Math.max(1e-9, oldQty + produced), 4);
      await fresh.save();
    }
  }
  for (const it of body.items || []) {
    const item = order.items.id(it.item);
    if (item) item.done = Math.max(0, Math.min(item.quantity, Number(it.done) || 0));
  }
  if (!body.items) for (const item of order.items) item.done = item.quantity;
  order.status = "done";
  order.completedAt = new Date();
  order.startedAt = order.startedAt || order.completedAt;
  order.history.push({ status: "done", note: body.note || "", by: actorId });
  order.updatedBy = actorId;
  await order.save();
  return order;
}

module.exports = {
  ensureProductionDefaults, loadContext, loadProducts, computeProjectPlan, createOrdersForProject, splitGlassLines, planGlass,
  consume, completeOrder, bookConsumption, powderFor, paintSurfacePerUnit, ensureVariant, variantFor, productCost, httpError,
};
