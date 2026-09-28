const express = require("express");
const Company = require("../models/Company");
const Customer = require("../models/Customer");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const Project = require("../models/Project");
const Workshop = require("../models/Workshop");
const Finish = require("../models/Finish");
const InventoryMovement = require("../models/InventoryMovement");
const ProductionOrder = require("../models/ProductionOrder");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireWorkshopAccess } = require("../middleware/permissionMiddleware");
const { hideMoney, dropMoneyInput } = require("../middleware/hideMoney");
const { canAccessProduction, canWorkInWorkshop } = require("../permissions/permissions");
const { isId, bad } = require("../utils/salesHelpers");
const { logAudit } = require("../services/auditLogger");
const { createWithNumber } = require("../services/documentNumberService");
const { fetchLogoBuffer } = require("../services/pdfHelpers");
const { generateProductionOrderPdf } = require("../services/productionPdfService");
const {
  ensureProductionDefaults, loadContext, consume, completeOrder, powderFor, ensureVariant, httpError,
} = require("../services/productionPlanning");
const { stockUnitLabel, round } = require("../services/chassisBom");
const notifications = require("../services/businessNotifications");
const tracking = require("../services/trackingService");

/**
 * ============================================================
 * WORK ORDERS (ordres de fabrication) — /api/production-orders
 * ============================================================
 * Production sees every workshop; a workshop's manager and members
 * see and work their own workshop's orders.
 *
 * GET   /board?companyId=                  workshops with their queues
 * GET   /?companyId=&workshop=&status=&project=
 * GET   /:id                               order + dependencies + movements
 * POST  /                                  manual order (e.g. laquage for an outside customer)
 * PATCH /:id                               dates, priority, assignees, notes
 * POST  /:id/start       { force? }
 * POST  /:id/consume     { lines: [{ need, quantity }], extra: [{ product, quantity }] }
 * POST  /:id/complete    { consumeRemaining?, outputs?: [{ output, produced, rejected }], force? }
 * POST  /:id/cancel      { reason }
 * GET   /:id/pdf         fiche de fabrication (what to make + planned materials)
 * ============================================================
 */
const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.productionOrders));
router.use(auth, requireWorkshopAccess);
// Workshop staff don't see cost prices (see canSeeFinancials).
router.use(hideMoney(["unitCost", "consumedCost", "cost", "standardCost", "prices", "price", "unitPrice"]));
router.use(dropMoneyInput(["unitCost"]));

const fail = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message, shortages: error.shortages, details: error.details });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};

/** Workshops this user may see (null = all). */
function scopeFilter(req) {
  if (canAccessProduction(req.user)) return null;
  return { $in: req.user.workshops || [] };
}

async function loadOrder(req, res) {
  if (!isId(req.params.id)) { bad(res, "Invalid ID"); return null; }
  const order = await ProductionOrder.findById(req.params.id);
  if (!order) { bad(res, "Work order not found", 404); return null; }
  if (!canWorkInWorkshop(req.user, order.workshop)) { bad(res, "This work order belongs to another workshop", 403); return null; }
  return order;
}

// ---------------- board ----------------
router.get("/board", async (req, res) => {
  try {
    const companyId = req.query.companyId;
    if (!isId(companyId) || !(await Company.exists({ _id: companyId }))) return bad(res, "A valid company is required");
    await ensureProductionDefaults(companyId);
    const wFilter = { company: companyId, isActive: true };
    const scope = scopeFilter(req);
    if (scope) wFilter._id = scope;
    const workshops = await Workshop.find(wFilter).populate("manager", "firstName lastName").populate("members", "firstName lastName").sort({ order: 1 }).lean();
    const orders = await ProductionOrder.find({ company: companyId, workshop: { $in: workshops.map((w) => w._id) }, status: { $in: ["planned", "in_progress", "done"] } })
      .select("number workshop status priority dueDate project title items completedAt dependsOn")
      .populate("project", "number name")
      .populate("dependsOn", "status")
      .sort({ dueDate: 1, createdAt: 1 })
      .lean();
    const now = new Date();
    const since = new Date(Date.now() - 30 * 86400000);
    res.json({
      success: true,
      data: workshops.map((w) => {
        const mine = orders.filter((o) => String(o.workshop) === String(w._id));
        const open = mine.filter((o) => o.status !== "done").map(({ items, ...o }) => ({
          ...o,
          progress: { total: (items || []).reduce((a, i) => a + (i.quantity || 0), 0), done: (items || []).reduce((a, i) => a + (i.done || 0), 0) },
          late: !!(o.dueDate && new Date(o.dueDate) < now),
          blocked: (o.dependsOn || []).some((d) => d.status !== "done" && d.status !== "cancelled"),
        }));
        return {
          ...w,
          orders: open,
          counts: {
            planned: open.filter((o) => o.status === "planned").length,
            inProgress: open.filter((o) => o.status === "in_progress").length,
            late: open.filter((o) => o.late).length,
            doneLast30: mine.filter((o) => o.status === "done" && o.completedAt && new Date(o.completedAt) >= since).length,
          },
          isManager: (req.user.managedWorkshops || []).includes(String(w._id)),
        };
      }),
    });
  } catch (error) { fail(res, error, "Error loading the workshops"); }
});

// ---------------- list ----------------
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.companyId) {
      if (!isId(req.query.companyId)) return bad(res, "Invalid company");
      filter.company = req.query.companyId;
    }
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.project && isId(req.query.project)) filter.project = req.query.project;
    const scope = scopeFilter(req);
    if (req.query.workshop && isId(req.query.workshop)) {
      if (scope && !(req.user.workshops || []).includes(String(req.query.workshop))) return bad(res, "This workshop is not yours", 403);
      filter.workshop = req.query.workshop;
    } else if (scope) filter.workshop = scope;
    const rows = await ProductionOrder.find(filter)
      .populate("workshop", "code name kind color")
      .populate("project", "number name")
      .populate("customer", "name")
      .populate("dependsOn", "number status")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    for (const r of rows) r.needs = (r.needs || []).map(({ cuts, cutPlan, pieceList, ...n }) => n);
    res.json({ success: true, data: rows });
  } catch (error) { fail(res, error, "Error loading the work orders"); }
});

/**
 * What the workshop sees of a need: the planned quantity only (bars of
 * the article's length, accessories, gaskets, m² of glass…). The cut
 * list, bar plan and glass piece list stay internal — they are only used
 * to compute how many bars to take out.
 */
function plannedNeed({ cuts, cutPlan, pieceList, ...n }) {
  const barLength = cutPlan?.barLength || n.product?.barLength || undefined;
  return { ...n, barLength: n.unit === "barre" || n.product?.stockMode === "bar" ? barLength : undefined };
}

// ---------------- detail ----------------
router.get("/:id", async (req, res) => {
  try {
    const found = await loadOrder(req, res);
    if (!found) return;
    const order = await ProductionOrder.findById(found._id)
      .populate("workshop", "code name kind color manager")
      .populate("project", "number name dueDate location")
      .populate("customer", "name phone")
      .populate("dependsOn", "number status workshop completedAt")
      .populate("assignees", "firstName lastName")
      .populate("items.model", "name family")
      .populate("items.finish", "code name color")
      .populate("items.product", "name internalReference")
      .populate("needs.product", "name internalReference unit quantity stockMode materialType barLength")
      .populate("needs.finish", "code name color")
      .populate("outputs.product", "name internalReference quantity")
      .populate("outputs.variant", "name internalReference quantity standardCost")
      .populate("outputs.finish", "code name color")
      .populate("history.by", "firstName lastName email")
      .lean();
    const movements = await InventoryMovement.find({ productionOrder: order._id })
      .populate("product", "name internalReference unit")
      .populate("performedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();
    const deps = await Workshop.find({ _id: { $in: (order.dependsOn || []).map((d) => d.workshop) } }).select("code name").lean();
    for (const d of order.dependsOn || []) d.workshop = deps.find((w) => String(w._id) === String(d.workshop)) || d.workshop;
    const blocked = (order.dependsOn || []).some((d) => d.status !== "done" && d.status !== "cancelled");
    const cost = movements.reduce((s, m) => s + (m.type === "out" ? 1 : m.type === "in" && m.reason?.startsWith("Retour") ? -1 : 0) * m.quantity * (m.unitCost || 0), 0);
    order.needs = (order.needs || []).map(plannedNeed);
    res.json({ success: true, data: { ...order, movements, blocked, consumedCost: round(cost, 2), canManage: canAccessProduction(req.user) || (req.user.managedWorkshops || []).includes(String(order.workshop._id)) } });
  } catch (error) { fail(res, error, "Error loading the work order"); }
});

// ---------------- manual order ----------------
/**
 * body: { company, workshop, title, project?, customer?, customerMaterial?, dueDate?, priority?,
 *         items?: [{ label, quantity, L?, H? }],
 *         needs?: [{ product, quantity, label? }],
 *         lacquer?: [{ product, finish, quantity }] }   (laquage workshops)
 */
router.post("/", async (req, res) => {
  try {
    const company = req.body.company;
    if (!isId(company) || !(await Company.exists({ _id: company }))) return bad(res, "A valid company is required");
    if (!isId(req.body.workshop)) return bad(res, "Choose a workshop");
    const workshop = await Workshop.findOne({ _id: req.body.workshop, company }).lean();
    if (!workshop) return bad(res, "Workshop not found");
    if (!canWorkInWorkshop(req.user, workshop._id)) return bad(res, "This workshop is not yours", 403);
    let project = null;
    if (req.body.project) {
      project = await Project.findOne({ _id: req.body.project, company }).select("number name customer").lean();
      if (!project) return bad(res, "Project not found");
    }
    let customer = null;
    if (req.body.customer) {
      if (!isId(req.body.customer) || !(await Customer.exists({ _id: req.body.customer, company }))) return bad(res, "Customer not found");
      customer = req.body.customer;
    }
    const customerMaterial = !!req.body.customerMaterial;
    const items = [];
    const needs = [];
    const outputs = [];
    for (const it of Array.isArray(req.body.items) ? req.body.items : []) {
      if (!String(it?.label || "").trim()) continue;
      items.push({ label: String(it.label).slice(0, 300), quantity: Math.max(0, Number(it.quantity) || 1), L: Number(it.L) || null, H: Number(it.H) || null });
    }
    for (const n of Array.isArray(req.body.needs) ? req.body.needs : []) {
      if (!isId(n?.product)) continue;
      const p = await Product.findOne({ _id: n.product, company }).lean();
      if (!p) return bad(res, "Article not found");
      needs.push({ product: p._id, baseProduct: p.baseProduct || p._id, kind: p.materialType || "other", materialType: p.materialType || "", label: n.label || p.name, measure: "count", theoretical: Math.max(0, Number(n.quantity) || 0), unit: stockUnitLabel(p) });
    }
    const lacquer = Array.isArray(req.body.lacquer) ? req.body.lacquer : [];
    if (lacquer.length) {
      if (workshop.kind !== "laquage") return bad(res, "Lacquering lines need a Laquage workshop");
      const ctx = await loadContext(company);
      const powderByFinish = new Map();
      for (const l of lacquer) {
        const q = Number(l?.quantity);
        if (!(q > 0) || !isId(l.product) || !isId(l.finish)) continue;
        const base = await Product.findOne({ _id: l.product, company }).lean();
        const finish = await Finish.findOne({ _id: l.finish, company }).lean();
        if (!base || !finish) return bad(res, "Article or colour not found");
        const powder = finish.powderProduct ? await Product.findById(finish.powderProduct).lean() : null;
        const p = powderFor(base, q, powder, ctx.settings);
        items.push({ label: `${base.name} → ${finish.code}`, product: base._id, finish: finish._id, quantity: q });
        if (!customerMaterial) {
          ctx.products.set(String(base._id), base);
          const variant = await ensureVariant(ctx, base, finish, req.user.id);
          outputs.push({ product: base._id, variant: variant._id, finish: finish._id, quantity: q, paintSurface: p.surface });
          needs.push({ product: base._id, baseProduct: base._id, kind: base.materialType || "profile", materialType: base.materialType || "", label: `${base.name} (brut, à laquer)`, measure: "count", theoretical: q, unit: stockUnitLabel(base) });
        }
        const key = String(finish._id);
        const pw = powderByFinish.get(key) || { finish, powder, kg: 0 };
        pw.kg += p.kg;
        powderByFinish.set(key, pw);
      }
      for (const { finish, powder, kg } of powderByFinish.values()) {
        needs.push({ product: powder?._id || null, baseProduct: powder?._id || null, kind: "powder", materialType: "powder", label: `Poudre ${finish.code}${finish.name ? ` ${finish.name}` : ""}`, measure: "count", theoretical: round(kg, 3), unit: "kg", warning: powder ? "" : "Aucune poudre associée à cette couleur" });
      }
    }
    if (!items.length && !needs.length) return bad(res, "Add at least one line");
    const order = await createWithNumber(ProductionOrder, {
      company,
      workshop: workshop._id,
      kind: workshop.kind,
      project: project?._id || null,
      customer: customer || project?.customer || null,
      customerMaterial,
      title: String(req.body.title || (project ? `${project.number} — ${project.name}` : workshop.name)).slice(0, 200),
      status: "planned",
      priority: ["low", "normal", "high", "urgent"].includes(req.body.priority) ? req.body.priority : "normal",
      dueDate: req.body.dueDate || null,
      items,
      needs,
      outputs,
      notes: req.body.notes,
      history: [{ status: "planned", note: "Ordre créé manuellement", by: req.user.id }],
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }, "OF");
    await logAudit(req, { company, action: "create", resourceType: "ProductionOrder", resourceId: order._id, resourceLabel: `${order.number} (${workshop.name})` });
    await notifications.onOrderCreated(order, req.user.id);
    res.status(201).json({ success: true, data: order });
  } catch (error) { fail(res, error, "Error creating the work order"); }
});

// ---------------- edit ----------------
router.patch("/:id", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    for (const f of ["plannedStart", "dueDate"]) if (req.body[f] !== undefined) order[f] = req.body[f] || null;
    if (req.body.dueDate !== undefined) order.lateNotifiedAt = null;
    if (req.body.priority !== undefined && ["low", "normal", "high", "urgent"].includes(req.body.priority)) order.priority = req.body.priority;
    for (const f of ["notes", "title"]) if (req.body[f] !== undefined) order[f] = String(req.body[f] || "");
    if (req.body.assignees !== undefined) {
      const ids = (Array.isArray(req.body.assignees) ? req.body.assignees : []).filter(isId);
      order.assignees = (await Employee.find({ _id: { $in: ids }, company: order.company }).select("_id").lean()).map((e) => e._id);
    }
    if (Array.isArray(req.body.items)) {
      for (const it of req.body.items) {
        const item = order.items.id(it.item);
        if (item && it.done !== undefined) item.done = Math.max(0, Math.min(item.quantity, Number(it.done) || 0));
      }
    }
    order.updatedBy = req.user.id;
    await order.save();
    if (Array.isArray(req.body.items)) await tracking.onOrderProgress(order, req.user.id);
    res.json({ success: true, data: order });
  } catch (error) { fail(res, error, "Error saving the work order"); }
});

router.post("/:id/start", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    if (!["planned", "draft"].includes(order.status)) return bad(res, "This work order is not waiting to start");
    const deps = await ProductionOrder.find({ _id: { $in: order.dependsOn } }).select("number status").lean();
    const pending = deps.filter((d) => !["done", "cancelled"].includes(d.status));
    if (pending.length && !req.body.force) return res.status(409).json({ success: false, message: `En attente de : ${pending.map((d) => d.number).join(", ")}`, pending });
    order.status = "in_progress";
    order.startedAt = new Date();
    order.history.push({ status: "in_progress", note: pending.length ? `Démarré sans attendre ${pending.map((d) => d.number).join(", ")}` : "", by: req.user.id });
    await order.save();
    await tracking.onOrderStarted(order);
    res.json({ success: true, data: order });
  } catch (error) { fail(res, error, "Error starting the work order"); }
});

router.post("/:id/consume", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    const wasStarted = order.status === "in_progress";
    const cost = await consume(order, { lines: req.body.lines || [], extra: req.body.extra || [] }, req.user.id);
    if (!wasStarted && order.status === "in_progress") await tracking.onOrderStarted(order);
    res.json({ success: true, data: { order, cost } });
  } catch (error) { fail(res, error, "Error booking the consumption"); }
});

router.post("/:id/complete", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    const settings = await ensureProductionDefaults(order.company);
    await completeOrder(order, req.body || {}, req.user.id, settings);
    await logAudit(req, { company: order.company, action: "update", resourceType: "ProductionOrder", resourceId: order._id, resourceLabel: `${order.number} terminé` });
    await tracking.onOrderCompleted(order, req.user.id);
    await notifications.onOrderCompleted(order, req.user.id, { shortages: req.body.force ? order.$locals.shortages || [] : [] });
    res.json({ success: true, data: order });
  } catch (error) { fail(res, error, "Error completing the work order"); }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    if (order.status === "done") throw httpError("A completed work order cannot be cancelled");
    order.status = "cancelled";
    order.history.push({ status: "cancelled", note: String(req.body.reason || "").slice(0, 500), by: req.user.id });
    await order.save();
    await logAudit(req, { company: order.company, action: "update", resourceType: "ProductionOrder", resourceId: order._id, resourceLabel: `${order.number} annulé` });
    await notifications.onOrderCancelled(order, req.user.id, String(req.body.reason || "").slice(0, 200));
    res.json({ success: true, data: order });
  } catch (error) { fail(res, error, "Error cancelling the work order"); }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    const found = await loadOrder(req, res);
    if (!found) return;
    const order = await ProductionOrder.findById(found._id)
      .populate("workshop", "code name kind")
      .populate("project", "number name location dueDate")
      .populate("customer", "name")
      .populate("items.finish", "code name")
      .populate("needs.product", "name internalReference barLength stockMode materialType")
      .populate("needs.finish", "code name")
      .populate("outputs.product", "name internalReference")
      .populate("outputs.finish", "code name")
      .lean();
    order.needs = (order.needs || []).map(plannedNeed);
    const company = await Company.findById(order.company).lean();
    const logoBuffer = await fetchLogoBuffer(company).catch(() => null);
    const doc = generateProductionOrderPdf({ order, company, logoBuffer });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${order.number}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) { fail(res, error, "Error generating the PDF"); }
});

module.exports = router;
