const express = require("express");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const Project = require("../models/Project");
const Quote = require("../models/Quote");
const Workshop = require("../models/Workshop");
const Finish = require("../models/Finish");
const ProductionSettings = require("../models/ProductionSettings");
const ProfileSeries = require("../models/ProfileSeries");
const ChassisModel = require("../models/ChassisModel");
const GlassType = require("../models/GlassType");
const ProductionOrder = require("../models/ProductionOrder");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireCatalogView } = require("../middleware/permissionMiddleware");
const { hideMoney, dropMoneyInput } = require("../middleware/hideMoney");
const { canSeeFinancials } = require("../permissions/permissions");
const { isId, bad, validationMessage } = require("../utils/salesHelpers");
const { logAudit } = require("../services/auditLogger");
const { check, isValidVariableName } = require("../services/formulaEngine");
const { FAMILIES, TEMPLATES, DEFAULT_MEASURE, findTemplate, withCoverJoint } = require("../config/chassisCatalog");
const bom = require("../services/chassisBom");
const { ensureProductionDefaults, loadContext, loadProducts } = require("../services/productionPlanning");
const { mergeTemplateVariables, modelFromTemplate } = require("../services/chassisCatalogService");
const { DRAWING_TYPES, OPENINGS } = require("../services/chassisSketch");
const upload = require("../middleware/uploadMiddleware");
const { uploadImage, deleteImage } = require("../services/cloudinaryService");

/**
 * ============================================================
 * PRODUCTION CONFIGURATION — /api/production
 * ============================================================
 * Read: production, workshop staff, sales (to price devis), projects.
 * Write: production only.
 *
 * GET|PUT  /settings?companyId=
 * GET      /workshops?companyId=     · POST /workshops · PUT|DELETE /workshops/:id
 * GET      /finishes?companyId=      · POST /finishes  · PUT|DELETE /finishes/:id
 * GET      /series?companyId=        · POST /series    · PUT|DELETE /series/:id
 * GET      /catalog                  families + templates (config/chassisCatalog.js)
 * GET      /catalog/:key             one template in full
 * POST     /models/import            { companyId, templateKey, series?, name? }
 * GET      /models?companyId=&family=&series=&search=&active=
 * GET      /models/:id               · POST /models · PUT /models/:id · DELETE /models/:id
 * POST     /models/:id/duplicate
 * POST|DELETE /models/:id/image  picture (multipart field "image") replacing the schematic
 * POST     /models/:id/test          { L, H, params, finish, quantity } → BOM, needs, price
 * POST     /models/:id/price         { L, H, params, finish } → devis price + description
 * POST     /formulas/check           { formula, known[] }
 * GET      /articles?companyId=&materialType=&search=   articles for the pickers
 * ============================================================
 */
const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.productionConfig));
router.use(auth, requireCatalogView);
// Pricing rules, hourly rates, colour surcharges and cost prices are
// hidden from people who don't see amounts (see canSeeFinancials) —
// and left untouched when they save a model, workshop or colour.
const CONFIG_MONEY = ["pricing", "hourlyRate", "surchargePercent", "defaultCoefficient", "pricingProfileWaste", "price", "unitCost", "standardCost", "prices", "cost"];
router.use(hideMoney(CONFIG_MONEY));
router.use(dropMoneyInput(["pricing", "hourlyRate", "surchargePercent", "defaultCoefficient", "pricingProfileWaste"]));

// Each write needs its own permission (config/routePermissions.js →
// production.config.edit / production.catalog.create|edit|delete),
// checked by the guard before the handler runs.
function canWrite() {
  return true;
}
async function companyFrom(req, res, source = "query") {
  const id = source === "body" ? req.body.company || req.body.companyId : req.query.companyId;
  if (!isId(id) || !(await Company.exists({ _id: id }))) {
    bad(res, "A valid company is required");
    return null;
  }
  return id;
}
const handle = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message, details: error.details });
  if (error.code === 11000) return bad(res, "This code / name already exists", 409);
  if (error.name === "ValidationError") return bad(res, validationMessage(error, fallback));
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};
const num = (v, def = null) => (v === undefined || v === null || v === "" ? def : Number.isFinite(Number(v)) ? Number(v) : def);

// ================= settings =================
const SETTING_KEYS = ["powderMethod", "defaultCoverage", "powderWastePercent", "defaultBarLength", "kerf", "trimAllowance", "barEndTrim", "cutSpacing", "mitreNesting", "minReusableOffcut", "glassWastePercent", "glassEdgeTrim", "glassCutGap", "glassAllowRotation", "lacquerFromStockFirst", "consumeOnComplete", "defaultCoefficient", "pricingProfileWaste", "deliverRequiresReady"];
router.get("/settings", async (req, res) => {
  try {
    const company = await companyFrom(req, res);
    if (!company) return;
    res.json({ success: true, data: await ensureProductionDefaults(company) });
  } catch (error) { handle(res, error, "Error loading the settings"); }
});
router.put("/settings", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    const company = await companyFrom(req, res);
    if (!company) return;
    const settings = await ensureProductionDefaults(company);
    for (const k of SETTING_KEYS) if (req.body[k] !== undefined) settings[k] = req.body[k];
    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) { handle(res, error, "Error saving the settings"); }
});

// ================= workshops =================
async function employeesOf(companyId, ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(isId);
  if (!list.length) return [];
  return (await Employee.find({ _id: { $in: list }, company: companyId }).select("_id").lean()).map((e) => e._id);
}
router.get("/workshops", async (req, res) => {
  try {
    const company = await companyFrom(req, res);
    if (!company) return;
    await ensureProductionDefaults(company);
    const workshops = await Workshop.find({ company })
      .populate("manager", "firstName lastName jobTitle")
      .populate("members", "firstName lastName jobTitle")
      .populate("feeds", "code name")
      .sort({ order: 1, name: 1 })
      .lean();
    const orders = await ProductionOrder.find({ company, status: { $in: ["planned", "in_progress"] } }).select("workshop status dueDate").lean();
    const now = new Date();
    for (const w of workshops) {
      const mine = orders.filter((o) => String(o.workshop) === String(w._id));
      w.openOrders = { planned: mine.filter((o) => o.status === "planned").length, inProgress: mine.filter((o) => o.status === "in_progress").length, late: mine.filter((o) => o.dueDate && new Date(o.dueDate) < now).length };
    }
    res.json({ success: true, data: workshops });
  } catch (error) { handle(res, error, "Error loading the workshops"); }
});
async function applyWorkshop(w, body, companyId) {
  for (const f of ["code", "name", "kind", "color", "description"]) if (body[f] !== undefined) w[f] = body[f];
  for (const f of ["hourlyRate", "order"]) if (body[f] !== undefined) w[f] = num(body[f], 0);
  if (body.isActive !== undefined) w.isActive = !!body.isActive;
  if (body.manager !== undefined) w.manager = (await employeesOf(companyId, [body.manager]))[0] || null;
  if (body.members !== undefined) w.members = await employeesOf(companyId, body.members);
  if (body.feeds !== undefined) {
    const ids = (Array.isArray(body.feeds) ? body.feeds : []).filter((id) => isId(id) && String(id) !== String(w._id));
    w.feeds = (await Workshop.find({ _id: { $in: ids }, company: companyId }).select("_id").lean()).map((x) => x._id);
  }
}
router.post("/workshops", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    const company = await companyFrom(req, res, "body");
    if (!company) return;
    const w = new Workshop({ company });
    await applyWorkshop(w, req.body, company);
    await w.save();
    await logAudit(req, { company, action: "create", resourceType: "Workshop", resourceId: w._id, resourceLabel: w.name });
    res.status(201).json({ success: true, data: w });
  } catch (error) { handle(res, error, "Error creating the workshop"); }
});
router.put("/workshops/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const w = await Workshop.findById(req.params.id);
    if (!w) return bad(res, "Workshop not found", 404);
    // Full set-up: production.config.edit. Appointing the chef and the team:
    // production.workshops.assign (production manager). A chef d'atelier
    // manages the team of his own workshop.
    const { has: hasPerm } = require("../services/permissionService");
    let body = req.body;
    if (!hasPerm(req.user, "production.config.edit")) {
      if (hasPerm(req.user, "production.workshops.assign")) body = { manager: req.body.manager, members: req.body.members };
      else if ((req.user.managedWorkshops || []).includes(String(w._id))) body = { members: req.body.members };
      else return bad(res, "You don't have the permission for this action", 403);
    }
    await applyWorkshop(w, body, w.company);
    await w.save();
    await logAudit(req, { company: w.company, action: "update", resourceType: "Workshop", resourceId: w._id, resourceLabel: w.name });
    res.json({ success: true, data: w });
  } catch (error) { handle(res, error, "Error saving the workshop"); }
});
router.delete("/workshops/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const w = await Workshop.findById(req.params.id);
    if (!w) return bad(res, "Workshop not found", 404);
    if (await ProductionOrder.exists({ workshop: w._id })) {
      w.isActive = false;
      await w.save();
      return res.json({ success: true, data: w, message: "This workshop has work orders: it was deactivated instead" });
    }
    await Workshop.updateMany({ company: w.company, feeds: w._id }, { $pull: { feeds: w._id } });
    await w.deleteOne();
    res.json({ success: true, message: "Workshop deleted" });
  } catch (error) { handle(res, error, "Error deleting the workshop"); }
});

// ================= finishes =================
router.get("/finishes", async (req, res) => {
  try {
    const company = await companyFrom(req, res);
    if (!company) return;
    await ensureProductionDefaults(company);
    const rows = await Finish.find({ company }).populate("processWorkshop", "code name").populate("powderProduct", "name internalReference quantity unit").sort({ isDefault: -1, code: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (error) { handle(res, error, "Error loading the colours"); }
});
async function applyFinish(f, body, companyId) {
  for (const k of ["code", "name", "kind", "color"]) if (body[k] !== undefined) f[k] = body[k];
  if (body.surchargePercent !== undefined) f.surchargePercent = num(body.surchargePercent, 0);
  if (body.isActive !== undefined) f.isActive = !!body.isActive;
  if (body.isDefault !== undefined) f.isDefault = !!body.isDefault;
  if (body.processWorkshop !== undefined) {
    f.processWorkshop = body.processWorkshop && isId(body.processWorkshop) && (await Workshop.exists({ _id: body.processWorkshop, company: companyId })) ? body.processWorkshop : null;
  }
  if (body.powderProduct !== undefined) {
    f.powderProduct = body.powderProduct && isId(body.powderProduct) && (await Product.exists({ _id: body.powderProduct, company: companyId })) ? body.powderProduct : null;
  }
  if (f.kind === "lacquer" && !f.processWorkshop) {
    const laq = await Workshop.findOne({ company: companyId, kind: "laquage", isActive: true }).select("_id").lean();
    if (laq) f.processWorkshop = laq._id;
  }
  if (f.kind !== "lacquer") f.processWorkshop = null;
}
router.post("/finishes", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    const company = await companyFrom(req, res, "body");
    if (!company) return;
    const f = new Finish({ company });
    await applyFinish(f, req.body, company);
    await f.save();
    if (f.isDefault) await Finish.updateMany({ company, _id: { $ne: f._id } }, { isDefault: false });
    res.status(201).json({ success: true, data: f });
  } catch (error) { handle(res, error, "Error creating the colour"); }
});
router.put("/finishes/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const f = await Finish.findById(req.params.id);
    if (!f) return bad(res, "Colour not found", 404);
    await applyFinish(f, req.body, f.company);
    await f.save();
    if (f.isDefault) await Finish.updateMany({ company: f.company, _id: { $ne: f._id } }, { isDefault: false });
    res.json({ success: true, data: f });
  } catch (error) { handle(res, error, "Error saving the colour"); }
});
router.delete("/finishes/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const f = await Finish.findById(req.params.id);
    if (!f) return bad(res, "Colour not found", 404);
    const used = (await Product.exists({ finish: f._id })) || (await Project.exists({ $or: [{ finish: f._id }, { "items.finish": f._id }] }));
    if (used) {
      f.isActive = false;
      await f.save();
      return res.json({ success: true, data: f, message: "This colour is used: it was deactivated instead" });
    }
    await f.deleteOne();
    res.json({ success: true, message: "Colour deleted" });
  } catch (error) { handle(res, error, "Error deleting the colour"); }
});

// ================= series =================
function cleanVariables(input) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(input) ? input : []) {
    const key = String(v?.key || "").trim();
    if (!key) continue;
    if (!isValidVariableName(key)) throw Object.assign(new Error(`Invalid variable name "${key}" (letters, digits, _ ; not L, H or a function name)`), { status: 400 });
    if (seen.has(key)) throw Object.assign(new Error(`Variable "${key}" is defined twice`), { status: 400 });
    seen.add(key);
    const value = Number(v.value);
    if (!Number.isFinite(value)) throw Object.assign(new Error(`Variable "${key}": enter a number`), { status: 400 });
    out.push({ key, label: String(v.label || "").slice(0, 150), value });
  }
  return out;
}
router.get("/series", async (req, res) => {
  try {
    const company = await companyFrom(req, res);
    if (!company) return;
    const rows = await ProfileSeries.find({ company }).sort({ name: 1 }).lean();
    const counts = await ChassisModel.find({ company, series: { $in: rows.map((r) => r._id) } }).select("series").lean();
    for (const r of rows) r.modelCount = counts.filter((c) => String(c.series) === String(r._id)).length;
    res.json({ success: true, data: rows });
  } catch (error) { handle(res, error, "Error loading the series"); }
});
async function applySeries(s, body) {
  for (const k of ["name", "supplier", "description"]) if (body[k] !== undefined) s[k] = body[k];
  if (body.families !== undefined) s.families = (Array.isArray(body.families) ? body.families : []).filter((f) => FAMILIES.some((x) => x.key === f));
  if (body.variables !== undefined) s.variables = cleanVariables(body.variables);
  if (body.isActive !== undefined) s.isActive = !!body.isActive;
}
router.post("/series", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    const company = await companyFrom(req, res, "body");
    if (!company) return;
    const s = new ProfileSeries({ company });
    await applySeries(s, req.body);
    await s.save();
    res.status(201).json({ success: true, data: s });
  } catch (error) { handle(res, error, "Error creating the series"); }
});
router.put("/series/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const s = await ProfileSeries.findById(req.params.id);
    if (!s) return bad(res, "Series not found", 404);
    await applySeries(s, req.body);
    await s.save();
    // "Frames from the profile's ailette externe": frame pieces get + ae per mitred end.
    let updatedModels = 0;
    if (req.body.applyCoverJoint) {
      const models = await ChassisModel.find({ series: s._id });
      for (const m of models) {
        const before = JSON.stringify(m.components.map((c) => c.length));
        m.components = m.components.map((c) => withCoverJoint(c.toObject ? c.toObject() : c));
        if (JSON.stringify(m.components.map((c) => c.length)) !== before) { await m.save(); updatedModels += 1; }
      }
    }
    res.json({ success: true, data: { ...s.toObject(), updatedModels } });
  } catch (error) { handle(res, error, "Error saving the series"); }
});
router.delete("/series/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const s = await ProfileSeries.findById(req.params.id);
    if (!s) return bad(res, "Series not found", 404);
    if (await ChassisModel.exists({ series: s._id })) return bad(res, "Move or delete the models of this series first", 409);
    await s.deleteOne();
    res.json({ success: true, message: "Series deleted" });
  } catch (error) { handle(res, error, "Error deleting the series"); }
});

// ================= catalogue (templates) =================
router.get("/catalog", (req, res) => {
  res.json({
    success: true,
    data: {
      families: FAMILIES,
      templates: TEMPLATES.map((t) => ({
        key: t.key, family: t.family, name: t.name, name_en: t.name_en, description: t.description, drawing: t.drawing,
        parameters: t.parameters.length, components: t.components.length, variables: t.variables.map((v) => v.key),
      })),
    },
  });
});
router.get("/catalog/:key", (req, res) => {
  const t = findTemplate(req.params.key);
  if (!t) return bad(res, "Template not found", 404);
  res.json({ success: true, data: t });
});

// ================= models =================
const KINDS = ["profile", "gasket", "glass", "panel", "accessory", "consumable", "model"];
const PARAM_TYPES = ["number", "boolean", "choice", "product", "model"];

/**
 * Validates and cleans a model body. Every formula is checked against the
 * variables that will exist at run time (L, H, parameters, series +
 * model variables, derived values defined ABOVE it).
 */
/** The schematic hint of a model (see services/chassisSketch.js) — only known keys are kept. */
function cleanDrawing(d) {
  if (!d || typeof d !== "object") return {};
  const out = { type: DRAWING_TYPES.includes(d.type) ? d.type : "generic" };
  const int = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min ? Math.min(n, max) : undefined; };
  if (int(d.leaves, 1, 12)) out.leaves = int(d.leaves, 1, 12);
  if (int(d.rails, 1, 4)) out.rails = int(d.rails, 1, 4);
  if (int(d.layers, 1, 4)) out.layers = int(d.layers, 1, 4);
  if (int(d.nx, 1, 20)) out.nx = int(d.nx, 1, 20);
  if (int(d.ny, 1, 20)) out.ny = int(d.ny, 1, 20);
  if (OPENINGS.includes(d.opening) && d.opening) out.opening = d.opening;
  if (d.solid) out.solid = true;
  if (d.bars) out.bars = true;
  if (Array.isArray(d.parts)) out.parts = d.parts.filter((x) => ["left", "center", "right", "top", "bottom", "middle"].includes(x)).slice(0, 6);
  return out;
}

async function cleanModel(body, companyId, selfId = null) {
  const fail = (m) => { throw Object.assign(new Error(m), { status: 400 }); };
  const out = {};
  for (const k of ["name", "code", "description", "unit"]) if (body[k] !== undefined) out[k] = String(body[k] ?? "").trim();
  if (body.name !== undefined && !out.name) fail("Enter the model name");
  if (body.family !== undefined) {
    if (!FAMILIES.some((f) => f.key === body.family)) fail("Unknown family");
    out.family = body.family;
  }
  if (body.defaultWorkshop !== undefined) out.defaultWorkshop = String(body.defaultWorkshop || "ALU").toUpperCase();
  if (body.drawing !== undefined) out.drawing = cleanDrawing(body.drawing);
  if (body.vatRate !== undefined) out.vatRate = num(body.vatRate, 20);
  if (body.isActive !== undefined) out.isActive = !!body.isActive;
  if (body.limits !== undefined) out.limits = { minL: num(body.limits?.minL), maxL: num(body.limits?.maxL), minH: num(body.limits?.minH), maxH: num(body.limits?.maxH) };
  if (body.pricing !== undefined) {
    const p = body.pricing || {};
    out.pricing = {
      mode: ["cost_plus", "per_m2", "per_ml", "per_unit"].includes(p.mode) ? p.mode : "cost_plus",
      coefficient: num(p.coefficient, 1.8), pricePerM2: num(p.pricePerM2, 0), pricePerMl: num(p.pricePerMl, 0),
      pricePerUnit: num(p.pricePerUnit, 0), minArea: num(p.minArea, 0), minPrice: num(p.minPrice, 0),
    };
  }
  if (body.series !== undefined) {
    if (body.series && !(isId(body.series) && (await ProfileSeries.exists({ _id: body.series, company: companyId })))) fail("Series not found");
    out.series = body.series || null;
  }
  if (body.variables !== undefined) out.variables = cleanVariables(body.variables);

  const needFull = body.parameters !== undefined || body.derived !== undefined || body.components !== undefined || body.labour !== undefined || body.deliveryParts !== undefined;
  if (!needFull) return out;
  const existing = selfId ? await ChassisModel.findById(selfId).lean() : null;
  const parameters = body.parameters !== undefined ? body.parameters : existing?.parameters || [];
  const derived = body.derived !== undefined ? body.derived : existing?.derived || [];
  const components = body.components !== undefined ? body.components : existing?.components || [];
  const labour = body.labour !== undefined ? body.labour : existing?.labour || [];
  const variables = out.variables || existing?.variables || [];
  const seriesId = out.series !== undefined ? out.series : existing?.series;
  const series = seriesId ? await ProfileSeries.findById(seriesId).lean() : null;

  const known = new Set(["L", "H", "cj", ...(series?.variables || []).map((v) => v.key), ...variables.map((v) => v.key)]);
  const cleanParams = [];
  for (const p of Array.isArray(parameters) ? parameters : []) {
    const key = String(p?.key || "").trim();
    if (!isValidVariableName(key)) fail(`Invalid parameter name "${key}"`);
    if (cleanParams.some((x) => x.key === key)) fail(`Parameter "${key}" is defined twice`);
    const type = PARAM_TYPES.includes(p.type) ? p.type : "number";
    let def = p.default;
    if (type === "product") def = def && isId(def) && (await Product.exists({ _id: def, company: companyId })) ? String(def) : null;
    else if (type === "model") def = def && isId(def) && String(def) !== String(selfId) && ((await ChassisModel.exists({ _id: def, company: companyId })) || (await GlassType.exists({ _id: def, company: companyId }))) ? String(def) : null;
    else if (type === "boolean") def = def === true || def === 1 || def === "1" || def === "true" ? 1 : 0;
    else def = num(def, 0);
    const options = type === "choice" ? (Array.isArray(p.options) ? p.options : []).filter((o) => o && o.label !== undefined && Number.isFinite(Number(o.value))).map((o) => ({ value: Number(o.value), label: String(o.label).slice(0, 80) })) : [];
    if (type === "choice" && !options.length) fail(`Parameter "${key}": add at least one choice`);
    cleanParams.push({
      key, label: String(p.label || key).slice(0, 120), type, default: def,
      min: num(p.min), max: num(p.max), unit: String(p.unit || "").slice(0, 10), fixed: !!p.fixed, options,
      family: String(p.family || ""), materialType: String(p.materialType || ""),
    });
    known.add(key);
  }
  // Profile geometry of the components' articles (ae, ch, hp… and ae_<role>…).
  for (const g of bom.geometryVarNames(Array.isArray(components) ? components : [])) known.add(g);
  const cleanDerived = [];
  for (const d of Array.isArray(derived) ? derived : []) {
    const key = String(d?.key || "").trim();
    if (!isValidVariableName(key)) fail(`Invalid intermediate value name "${key}"`);
    if (known.has(key)) fail(`"${key}" is already a parameter or variable`);
    const r = check(d.formula, [...known]);
    if (!r.ok) fail(`Intermediate value "${key}": ${r.error}`);
    cleanDerived.push({ key, label: String(d.label || "").slice(0, 120), formula: String(d.formula).trim() });
    known.add(key);
  }
  const knownList = [...known];
  const paramByKey = new Map(cleanParams.map((p) => [p.key, p]));
  const cleanComponents = [];
  const productIds = [];
  const modelIds = [];
  for (const [i, c] of (Array.isArray(components) ? components : []).entries()) {
    const n = `Component ${i + 1}${c?.label ? ` (${c.label})` : ""}`;
    if (!KINDS.includes(c?.kind)) fail(`${n}: unknown type`);
    if (!String(c.label || "").trim()) fail(`${n}: enter a label`);
    const measure = c.kind === "model" ? "count" : ["length", "area", "count"].includes(c.measure) ? c.measure : DEFAULT_MEASURE[c.kind];
    for (const f of ["qty", "condition", ...(measure === "length" ? ["length"] : []), ...(measure === "area" || c.kind === "model" ? ["width", "height"] : [])]) {
      if (!c[f] || !String(c[f]).trim()) {
        if (f === "qty") fail(`${n}: enter the quantity formula`);
        if (f === "length") fail(`${n}: enter the cut length formula`);
        continue;
      }
      const r = check(c[f], knownList);
      if (!r.ok) fail(`${n} — ${f}: ${r.error}`);
    }
    if (c.productParam && paramByKey.get(c.productParam)?.type !== "product") fail(`${n}: "${c.productParam}" is not an article parameter`);
    if (c.modelParam && paramByKey.get(c.modelParam)?.type !== "model") fail(`${n}: "${c.modelParam}" is not a model parameter`);
    if (c.product) { if (!isId(c.product)) fail(`${n}: invalid article`); productIds.push(String(c.product)); }
    if (c.subModel) {
      if (!isId(c.subModel) || String(c.subModel) === String(selfId)) fail(`${n}: invalid sub-model`);
      modelIds.push(String(c.subModel));
    }
    cleanComponents.push({
      ...(c._id && isId(c._id) ? { _id: c._id } : {}),
      role: String(c.role || `c${i + 1}`).trim().slice(0, 60), label: String(c.label).trim().slice(0, 150), kind: c.kind, measure,
      product: c.kind === "model" ? null : c.product || null, subModel: c.kind === "model" ? c.subModel || null : null,
      productParam: c.kind === "model" ? "" : String(c.productParam || ""), modelParam: c.kind === "model" ? String(c.modelParam || "") : "",
      qty: String(c.qty).trim(), length: String(c.length || "").trim(), width: String(c.width || "").trim(), height: String(c.height || "").trim(),
      angle: String(c.angle || "").slice(0, 20), finish: ["project", "raw", "none"].includes(c.finish) ? c.finish : "none",
      workshop: String(c.workshop || "").toUpperCase().slice(0, 12), condition: String(c.condition || "").trim(),
      waste: Math.min(100, Math.max(0, num(c.waste, 0))), notes: String(c.notes || "").slice(0, 300),
    });
  }
  if (productIds.length) {
    const found = await Product.countDocuments({ _id: { $in: [...new Set(productIds)] }, company: companyId });
    if (found !== new Set(productIds).size) fail("An article of the components does not belong to this company");
  }
  if (modelIds.length) {
    const found = await ChassisModel.countDocuments({ _id: { $in: [...new Set(modelIds)] }, company: companyId });
    if (found !== new Set(modelIds).size) fail("A sub-model does not belong to this company");
  }
  const cleanLabour = [];
  for (const l of Array.isArray(labour) ? labour : []) {
    if (!l?.minutes) continue;
    const r = check(l.minutes, knownList);
    if (!r.ok) fail(`Labour (${l.workshop}): ${r.error}`);
    cleanLabour.push({ workshop: String(l.workshop || "ALU").toUpperCase(), minutes: String(l.minutes).trim() });
  }
  const deliveryParts = body.deliveryParts !== undefined ? body.deliveryParts : existing?.deliveryParts || [];
  const cleanDelivery = [];
  const PART_KINDS = ["complete", "frame", "sash", "glass", "module", "screen", "panel", "accessory", "other"];
  for (const [i, d] of (Array.isArray(deliveryParts) ? deliveryParts : []).entries()) {
    const label = String(d?.label || "").trim();
    if (!label) fail(`Delivery part ${i + 1}: enter a label`);
    const key = String(d.key || label).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 40) || `part${i + 1}`;
    if (cleanDelivery.some((x) => x.key === key)) fail(`Delivery part "${label}" is defined twice`);
    for (const f of ["qty", "condition", "width", "height"]) {
      if (!d[f] || !String(d[f]).trim()) continue;
      const r = check(d[f], knownList);
      if (!r.ok) fail(`Delivery part "${label}" — ${f}: ${r.error}`);
    }
    cleanDelivery.push({
      key, label: label.slice(0, 150), kind: PART_KINDS.includes(d.kind) ? d.kind : "other", qty: String(d.qty || "1").trim(), condition: String(d.condition || "").trim(),
      perPiece: !!d.perPiece, pieceLabel: String(d.pieceLabel || "").trim().slice(0, 100),
      width: String(d.width || "").trim(), height: String(d.height || "").trim(),
    });
  }
  Object.assign(out, { parameters: cleanParams, derived: cleanDerived, components: cleanComponents, labour: cleanLabour, deliveryParts: cleanDelivery });
  return out;
}

router.get("/models", async (req, res) => {
  try {
    const company = await companyFrom(req, res);
    if (!company) return;
    const filter = { company };
    if (req.query.family) filter.family = req.query.family;
    if (req.query.series && isId(req.query.series)) filter.series = req.query.series;
    if (req.query.active !== "all") filter.isActive = req.query.active === "false" ? false : true;
    if (req.query.search) filter.name = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const rows = await ChassisModel.find(filter).populate("series", "name").sort({ family: 1, name: 1 }).lean();
    res.json({
      success: true,
      data: rows.map((m) => ({
        ...m,
        componentCount: (m.components || []).length,
        unmapped: (m.components || []).filter((c) => c.kind !== "model" && !c.product && !c.productParam).length,
        components: req.query.full === "true" ? m.components : undefined,
      })),
    });
  } catch (error) { handle(res, error, "Error loading the models"); }
});

router.get("/models/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const m = await ChassisModel.findById(req.params.id)
      .populate("series")
      .populate("components.product", "name internalReference unit stockMode materialType barLength quantity")
      .populate("components.subModel", "name family")
      .lean();
    if (!m) return bad(res, "Model not found", 404);
    res.json({ success: true, data: m });
  } catch (error) { handle(res, error, "Error loading the model"); }
});

router.post("/models", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    const company = await companyFrom(req, res, "body");
    if (!company) return;
    const data = await cleanModel({ family: "autre", components: [], parameters: [], derived: [], ...req.body }, company);
    const m = await ChassisModel.create({ ...data, company, createdBy: req.user.id, updatedBy: req.user.id });
    await logAudit(req, { company, action: "create", resourceType: "ChassisModel", resourceId: m._id, resourceLabel: m.name });
    res.status(201).json({ success: true, data: m });
  } catch (error) { handle(res, error, "Error creating the model"); }
});

router.post("/models/import", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    const company = await companyFrom(req, res, "body");
    if (!company) return;
    const t = findTemplate(req.body.templateKey);
    if (!t) return bad(res, "Template not found", 404);
    let series = null;
    if (req.body.series) {
      series = await ProfileSeries.findOne({ _id: req.body.series, company });
      if (!series) return bad(res, "Series not found");
      // The template's variables join the series (existing values are kept).
      mergeTemplateVariables(series, t);
      await series.save();
    }
    const m = await ChassisModel.create(modelFromTemplate(t, { company, series, name: req.body.name, code: req.body.code, actorId: req.user.id }));
    await logAudit(req, { company, action: "create", resourceType: "ChassisModel", resourceId: m._id, resourceLabel: `${m.name} (modèle ${t.key})` });
    res.status(201).json({ success: true, data: m });
  } catch (error) { handle(res, error, "Error importing the template"); }
});

router.put("/models/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const m = await ChassisModel.findById(req.params.id);
    if (!m) return bad(res, "Model not found", 404);
    const data = await cleanModel(req.body, m.company, m._id);
    Object.assign(m, data, { updatedBy: req.user.id });
    await m.save();
    res.json({ success: true, data: m });
  } catch (error) { handle(res, error, "Error saving the model"); }
});

router.post("/models/:id/duplicate", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const m = await ChassisModel.findById(req.params.id).lean();
    if (!m) return bad(res, "Model not found", 404);
    const { _id, createdAt, updatedAt, __v, ...rest } = m;
    const copy = await ChassisModel.create({
      ...rest,
      name: String(req.body.name || `${m.name} (copie)`).slice(0, 150),
      series: req.body.series && isId(req.body.series) ? req.body.series : m.series,
      components: m.components.map(({ _id: cid, ...c }) => c),
      image: { url: null, publicId: null }, // the uploaded picture belongs to the original
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: copy });
  } catch (error) { handle(res, error, "Error duplicating the model"); }
});

router.delete("/models/:id", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const m = await ChassisModel.findById(req.params.id);
    if (!m) return bad(res, "Model not found", 404);
    const used = (await Project.exists({ "items.model": m._id }))
      || (await Quote.exists({ "lines.chassis.model": m._id }))
      || (await ChassisModel.exists({ _id: { $ne: m._id }, "components.subModel": m._id }));
    if (used) {
      m.isActive = false;
      await m.save();
      return res.json({ success: true, data: m, message: "This model is used: it was deactivated instead" });
    }
    if (m.image?.publicId) await deleteImage(m.image.publicId).catch(() => {});
    await m.deleteOne();
    res.json({ success: true, message: "Model deleted" });
  } catch (error) { handle(res, error, "Error deleting the model"); }
});

/** Picture of a model (photo, catalogue drawing) — replaces the generated schematic. */
router.post("/models/:id/image", upload.single("image"), async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    if (!req.file) return bad(res, "Please select an image");
    const m = await ChassisModel.findById(req.params.id);
    if (!m) return bad(res, "Model not found", 404);
    const old = m.image?.publicId;
    const result = await uploadImage(req.file.buffer, `frame/companies/${m.company}/chassis-models/${m._id}`);
    m.image = { url: result.secure_url, publicId: result.public_id };
    m.updatedBy = req.user.id;
    await m.save();
    if (old) await deleteImage(old).catch(() => {});
    res.json({ success: true, data: m, message: "Image uploaded" });
  } catch (error) { handle(res, error, "Error uploading the image"); }
});

router.delete("/models/:id/image", async (req, res) => {
  try {
    if (!canWrite(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const m = await ChassisModel.findById(req.params.id);
    if (!m) return bad(res, "Model not found", 404);
    const old = m.image?.publicId;
    m.image = { url: null, publicId: null };
    m.updatedBy = req.user.id;
    await m.save();
    if (old) await deleteImage(old).catch(() => {});
    res.json({ success: true, data: m, message: "Image removed" });
  } catch (error) { handle(res, error, "Error removing the image"); }
});

/** BOM of one chassis for the model editor's test panel. */
router.post("/models/:id/test", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const m = await ChassisModel.findById(req.params.id).select("company").lean();
    if (!m) return bad(res, "Model not found", 404);
    const ctx = await loadContext(m.company);
    // A deactivated model can still be tested.
    if (!ctx.models.has(String(m._id))) ctx.models.set(String(m._id), await ChassisModel.findById(m._id).lean());
    const params = req.body.params || {};
    await loadProducts(ctx, Object.values(params).filter((v) => typeof v === "string" && isId(v)));
    const spec = { model: String(m._id), L: num(req.body.L, 1000), H: num(req.body.H, 1000), quantity: num(req.body.quantity, 1), params, finish: isId(req.body.finish) ? req.body.finish : null, ref: "T" };
    const r = bom.expandItem(spec, ctx);
    const needs = bom.aggregateNeeds(r.lines, ctx);
    const price = bom.priceChassis(spec, ctx);
    const vars = bom.buildVariables(ctx.models.get(String(m._id)), ctx.models.get(String(m._id)).series ? ctx.series.get(String(ctx.models.get(String(m._id)).series)) : null, spec.L, spec.H, params).vars;
    res.json({
      success: true,
      data: {
        variables: vars,
        lines: r.lines.map((l) => ({ ...l, productName: l.product ? ctx.products.get(String(l.product))?.name || null : null })),
        assemblies: r.assemblies,
        labour: r.labour,
        needs: needs.map((n) => ({ ...n, productName: n.product ? ctx.products.get(String(n.product))?.name || null : null })),
        price,
        description: bom.describeChassis(spec, ctx),
        errors: r.errors,
        warnings: r.warnings,
      },
    });
  } catch (error) { handle(res, error, "Error testing the model"); }
});

/** Proposed devis price + description (sales). */
router.post("/models/:id/price", async (req, res) => {
  try {
    if (!canSeeFinancials(req.user)) return bad(res, "Prices are not shown to your account", 403);
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const m = await ChassisModel.findById(req.params.id).select("company isActive unit vatRate").lean();
    if (!m) return bad(res, "Model not found", 404);
    const L = num(req.body.L);
    const H = num(req.body.H);
    if (!(L > 0 && H > 0)) return bad(res, "Enter the width and height");
    const ctx = await loadContext(m.company);
    const params = req.body.params || {};
    await loadProducts(ctx, Object.values(params).filter((v) => typeof v === "string" && isId(v)));
    const spec = { model: String(m._id), L, H, params, finish: isId(req.body.finish) ? req.body.finish : null };
    const price = bom.priceChassis(spec, ctx);
    if (price.error) return bad(res, price.error);
    res.json({ success: true, data: { ...price, description: bom.describeChassis(spec, ctx), unit: m.unit || "u", vatRate: m.vatRate ?? 20 } });
  } catch (error) { handle(res, error, "Error pricing the chassis"); }
});

router.post("/formulas/check", (req, res) => {
  const known = Array.isArray(req.body.known) ? req.body.known.map(String) : null;
  res.json({ success: true, data: check(String(req.body.formula || ""), known) });
});

/** Articles for the catalogue pickers (with technical fields). */
router.get("/articles", async (req, res) => {
  try {
    const company = await companyFrom(req, res);
    if (!company) return;
    const filter = { company, isActive: { $ne: false } };
    if (req.query.variants !== "true") filter.baseProduct = null;
    if (req.query.materialType) filter.materialType = { $in: String(req.query.materialType).split(",") };
    if (req.query.search) {
      const rx = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      filter.$or = [{ name: rx }, { internalReference: rx }];
    }
    const rows = await Product.find(filter)
      .select("name internalReference unit quantity materialType stockMode barLength profileDepth profileChamber profileOuterFin profileInnerFin profileHeight profileWidth sheetWidth sheetHeight packSize prices standardCost finish baseProduct")
      .sort({ name: 1 })
      .limit(Math.min(Number(req.query.limit) || 500, 2000))
      .lean();
    res.json({ success: true, data: rows });
  } catch (error) { handle(res, error, "Error loading the articles"); }
});

// ================= glass compositions (vitrages) =================
/**
 * "44.2 / 10 / 6": layers (2 × 4 mm from plateaux 3000×1000 or 2400×1000,
 * 10 mm from 3 plateaux, 6 mm…), extras (PVB film, spacer…), labour.
 * Chosen on a chassis line wherever a glass unit is asked.
 */
const GLASS_POPULATE = [
  { path: "layers.sheets", select: "name internalReference stockMode sheetWidth sheetHeight quantity thickness materialType" },
  { path: "extras.product", select: "name internalReference stockMode unit quantity materialType" },
];

async function cleanGlassType(body, company) {
  const name = String(body.name || "").trim();
  if (!name) throw Object.assign(new Error("Give the glass composition a name (e.g. 44.2 / 10 / 6)"), { status: 400 });
  const layers = (Array.isArray(body.layers) ? body.layers : []).slice(0, 8).map((l) => ({
    label: String(l?.label || "").trim().slice(0, 120),
    thickness: num(l?.thickness),
    count: Math.min(6, Math.max(1, Math.round(num(l?.count, 1)))),
    sheets: [...new Set((Array.isArray(l?.sheets) ? l.sheets : []).map((x) => String(x?._id || x)).filter(isId))],
  }));
  if (!layers.length) throw Object.assign(new Error("Add at least one glass layer"), { status: 400 });
  const extras = (Array.isArray(body.extras) ? body.extras : []).slice(0, 12).map((x) => ({
    product: isId(String(x?.product?._id || x?.product || "")) ? String(x.product?._id || x.product) : null,
    label: String(x?.label || "").trim().slice(0, 120),
    measure: ["area", "perimeter", "count"].includes(x?.measure) ? x.measure : "area",
    qty: Math.max(0, num(x?.qty, 1)),
    inset: Math.max(0, num(x?.inset, 0)),
  })).filter((x) => x.product || x.label);
  const ids = [...new Set([...layers.flatMap((l) => l.sheets), ...extras.map((x) => x.product).filter(Boolean)])];
  if (ids.length) {
    const found = await Product.countDocuments({ _id: { $in: ids }, company });
    if (found !== ids.length) throw Object.assign(new Error("An article does not belong to this company"), { status: 400 });
  }
  return {
    name: name.slice(0, 120),
    code: String(body.code || "").trim().toUpperCase().slice(0, 30),
    description: String(body.description || "").trim().slice(0, 500),
    layers, extras,
    workshop: String(body.workshop || "VIT").trim().toUpperCase().slice(0, 10) || "VIT",
    labourPerPane: Math.max(0, num(body.labourPerPane, 0)),
    labourPerM2: Math.max(0, num(body.labourPerM2, 0)),
    isActive: body.isActive !== false,
  };
}

router.get("/glass-types", async (req, res) => {
  try {
    const company = await companyFrom(req, res);
    if (!company) return;
    const filter = { company };
    if (req.query.active === "true") filter.isActive = true;
    const rows = await GlassType.find(filter).populate(GLASS_POPULATE).sort({ name: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (error) { handle(res, error, "Error loading the glass compositions"); }
});
router.post("/glass-types", async (req, res) => {
  try {
    const company = await companyFrom(req, res, "body");
    if (!company) return;
    const doc = await GlassType.create({ company, ...(await cleanGlassType(req.body, company)), createdBy: req.user.id, updatedBy: req.user.id });
    await logAudit(req, { company, action: "create", resourceType: "GlassType", resourceId: doc._id, resourceLabel: doc.name });
    res.status(201).json({ success: true, data: await GlassType.findById(doc._id).populate(GLASS_POPULATE).lean() });
  } catch (error) { handle(res, error, "Error saving the glass composition"); }
});
router.put("/glass-types/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const doc = await GlassType.findById(req.params.id);
    if (!doc) return bad(res, "Glass composition not found", 404);
    Object.assign(doc, await cleanGlassType({ ...doc.toObject(), ...req.body }, doc.company), { updatedBy: req.user.id });
    await doc.save();
    res.json({ success: true, data: await GlassType.findById(doc._id).populate(GLASS_POPULATE).lean() });
  } catch (error) { handle(res, error, "Error saving the glass composition"); }
});
router.delete("/glass-types/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const doc = await GlassType.findById(req.params.id);
    if (!doc) return bad(res, "Glass composition not found", 404);
    // Still chosen on a project / devis line → deactivate instead of deleting.
    const id = String(doc._id);
    const projects = await Project.find({ company: doc.company }).select("items.params").lean();
    const quotes = await Quote.find({ company: doc.company }).select("lines.chassis.params").lean();
    const inUse = projects.some((p) => (p.items || []).some((i) => Object.values(i.params || {}).map(String).includes(id)))
      || quotes.some((q) => (q.lines || []).some((l) => Object.values(l.chassis?.params || {}).map(String).includes(id)));
    if (inUse) {
      doc.isActive = false;
      await doc.save();
      return res.json({ success: true, deactivated: true, message: "Used on a project: deactivated" });
    }
    await doc.deleteOne();
    await logAudit(req, { company: doc.company, action: "delete", resourceType: "GlassType", resourceId: doc._id, resourceLabel: doc.name });
    res.json({ success: true });
  } catch (error) { handle(res, error, "Error deleting the glass composition"); }
});

module.exports = router;
