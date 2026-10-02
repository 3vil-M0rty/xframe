const express = require("express");
const Project = require("../models/Project");
const ProductionOrder = require("../models/ProductionOrder");
const Transfer = require("../models/Transfer");
const Offcut = require("../models/Offcut");
const Product = require("../models/Product");
const Company = require("../models/Company");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { hideMoney } = require("../middleware/hideMoney");
const { has } = require("../services/permissionService");
const { canAccessProduction, canWorkInWorkshop } = require("../permissions/permissions");
const { isId, bad } = require("../utils/salesHelpers");
const { logAudit } = require("../services/auditLogger");
const flow = require("../services/workshopFlow");
const tracking = require("../services/trackingService");
const notifications = require("../services/businessNotifications");
const { orderCutting } = require("../services/cuttingData");

/**
 * ============================================================
 * WORKSHOP FLOW — /api/production-flow (see services/workshopFlow.js)
 * ============================================================
 * GET    /projects/:projectId                 orders, transfers, bars / accessories to issue
 * POST   /projects/:projectId/issue           { category: bars|accessories, lines, note }
 * GET    /to-issue?companyId=                 projects with bars / accessories left to issue
 * GET    /transfers?companyId=&status=sent    receptions waiting in my workshops
 * POST   /transfers/:id/receive               { lines: [{ line, receivedQty }], note }
 * POST   /orders/:id/finish-laquage           { powderKg | powder: [{ need, kg }], outputs?, note }
 * POST   /orders/:id/finish-vitrage           { note }
 * POST   /orders/:id/frames-done              aluminium: chassis made without glass
 * POST   /orders/:id/subcontract              { supplier, note } → draft purchase order
 * DELETE /orders/:id/subcontract
 * POST   /orders/:id/offcuts-from-plan        reusable offcuts of the cutting plan → offcut stock
 * GET    /offcuts?companyId=&product=         offcut stock
 * POST   /offcuts                             { company, product, length, quantity, location }
 * DELETE /offcuts/:id
 * ============================================================
 */
const router = express.Router();
router.use(auth, guard(ROUTE_PERMISSIONS.productionFlow));
router.use(hideMoney(["unitCost", "cost", "standardCost", "prices", "price", "unitPrice"]));

const fail = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};

async function loadOrder(req, res) {
  if (!isId(req.params.id)) { bad(res, "Invalid ID"); return null; }
  const order = await ProductionOrder.findById(req.params.id);
  if (!order) { bad(res, "Work order not found", 404); return null; }
  if (!canWorkInWorkshop(req.user, order.workshop)) { bad(res, "This work order belongs to another workshop", 403); return null; }
  return order;
}

router.get("/projects/:projectId", async (req, res) => {
  try {
    if (!isId(req.params.projectId)) return bad(res, "Invalid ID");
    const project = await Project.findById(req.params.projectId).select("company number name").lean();
    if (!project) return bad(res, "Project not found", 404);
    const data = await flow.projectFlow(project._id);
    const me = req.user;
    for (const o of data.orders) o.canWork = canWorkInWorkshop(me, o.workshop?._id);
    res.json({
      success: true,
      data: {
        ...data,
        can: {
          issueBars: has(me, "production.flow.issueBars"),
          issueAccessories: has(me, "production.flow.issueAccessories"),
          receive: has(me, "production.flow.receive"),
          complete: has(me, "production.orders.complete"),
          start: has(me, "production.orders.start"),
          subcontract: has(me, "production.flow.subcontract"),
          offcuts: has(me, "production.flow.offcuts"),
          all: canAccessProduction(me),
        },
      },
    });
  } catch (error) { fail(res, error, "Error loading the workshop flow"); }
});

router.post("/projects/:projectId/issue", async (req, res) => {
  try {
    if (!isId(req.params.projectId)) return bad(res, "Invalid ID");
    const category = req.body.category === "accessories" ? "accessories" : "bars";
    if (!has(req.user, category === "bars" ? "production.flow.issueBars" : "production.flow.issueAccessories")) return bad(res, "You don't have the permission for this action", 403);
    const project = await Project.findById(req.params.projectId).select("company number name").lean();
    if (!project) return bad(res, "Project not found", 404);
    const transfers = await flow.issue(project, { category, lines: req.body.lines || [], note: req.body.note }, req.user.id);
    await logAudit(req, { company: project.company, action: "create", resourceType: "Transfer", resourceId: project._id, resourceLabel: `${project.number} : ${transfers.map((t) => t.number).join(", ")}` });
    res.status(201).json({ success: true, data: transfers });
  } catch (error) { fail(res, error, "Error issuing the material"); }
});

/** Projects with bars / accessories still to issue (for the people who issue). */
router.get("/to-issue", async (req, res) => {
  try {
    if (!isId(req.query.companyId)) return bad(res, "A valid company is required");
    const projectIds = await ProductionOrder.distinct("project", { company: req.query.companyId, project: { $ne: null }, status: { $in: ["planned", "in_progress"] } });
    const out = [];
    for (const pid of projectIds) {
      const project = await Project.findById(pid).select("number name dueDate").lean();
      if (!project) continue;
      const f = await flow.projectFlow(pid);
      const bars = f.bars.reduce((a, b) => a + (b.toIssue || 0), 0);
      const accessories = f.accessories.filter((a) => a.toIssue > 0).length;
      if (bars > 0 || accessories > 0) out.push({ project, bars, accessories });
    }
    out.sort((a, b) => new Date(a.project.dueDate || 8.64e15) - new Date(b.project.dueDate || 8.64e15));
    res.json({ success: true, data: out });
  } catch (error) { fail(res, error, "Error loading the issues to do"); }
});

router.get("/transfers", async (req, res) => {
  try {
    if (!isId(req.query.companyId) || !(await Company.exists({ _id: req.query.companyId }))) return bad(res, "A valid company is required");
    const filter = { company: req.query.companyId };
    if (req.query.status) filter.status = req.query.status;
    if (!canAccessProduction(req.user)) filter.toWorkshop = { $in: req.user.workshops || [] };
    const rows = await Transfer.find(filter)
      .populate("project", "number name")
      .populate("toWorkshop", "code name color")
      .populate("fromWorkshop", "code name color")
      .populate("toOrder", "number kind status")
      .populate("sentBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json({ success: true, data: rows });
  } catch (error) { fail(res, error, "Error loading the transfers"); }
});

router.post("/transfers/:id/receive", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    const t = await Transfer.findById(req.params.id);
    if (!t) return bad(res, "Transfer not found", 404);
    if (!canWorkInWorkshop(req.user, t.toWorkshop)) return bad(res, "Only the receiving workshop can receive this", 403);
    const { order } = await flow.receive(t, req.body || {}, req.user.id);
    if (order && order.kind === "laquage" && order.status === "in_progress") await tracking.onOrderStarted(order);
    res.json({ success: true, data: t });
  } catch (error) { fail(res, error, "Error receiving"); }
});

router.post("/orders/:id/finish-laquage", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    const r = await flow.finishLaquage(order, req.body || {}, req.user.id);
    await logAudit(req, { company: order.company, action: "update", resourceType: "ProductionOrder", resourceId: order._id, resourceLabel: `${order.number} terminé (laquage)` });
    await notifications.onOrderCompleted(order, req.user.id, { shortages: [] });
    res.json({ success: true, data: { order: r.order, transfer: r.transfer } });
  } catch (error) { fail(res, error, "Error finishing the lacquering"); }
});

router.post("/orders/:id/finish-vitrage", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    const r = await flow.finishVitrage(order, req.body || {}, req.user.id);
    await tracking.onOrderCompleted(order, req.user.id);
    await notifications.onOrderCompleted(order, req.user.id, { shortages: order.$locals.shortages || [] });
    res.json({ success: true, data: { order: r.order, transfer: r.transfer } });
  } catch (error) { fail(res, error, "Error finishing the glazing"); }
});

router.post("/orders/:id/frames-done", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    res.json({ success: true, data: await flow.framesDone(order, req.user.id) });
  } catch (error) { fail(res, error, "Error saving"); }
});

router.post("/orders/:id/subcontract", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    if (!isId(req.body.supplier)) return bad(res, "Choose a supplier");
    const r = await flow.subcontract(order, req.body, req.user.id);
    await logAudit(req, { company: order.company, action: "create", resourceType: "PurchaseOrder", resourceId: r.purchaseOrder._id, resourceLabel: `${r.purchaseOrder.number} (sous-traitance ${order.number})` });
    res.status(201).json({ success: true, data: r });
  } catch (error) { fail(res, error, "Error sub-contracting"); }
});

router.delete("/orders/:id/subcontract", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    res.json({ success: true, data: await flow.cancelSubcontract(order, req.user.id) });
  } catch (error) { fail(res, error, "Error cancelling the sub-contracting"); }
});

// ---------------- offcuts ----------------
router.post("/orders/:id/offcuts-from-plan", async (req, res) => {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;
    const { report } = await orderCutting(order._id, {});
    let n = 0;
    for (const b of report.bars) {
      if (!b.plan || !b.product) continue;
      for (const p of b.plan.patterns) {
        if (!p.reusable || !(p.offcut > 0)) continue;
        await Offcut.create({ company: order.company, product: b.product, length: Math.floor(p.offcut), quantity: p.count, sourceOrder: order._id, sourceProject: order.project || null, note: `Débit ${order.number}`, createdBy: req.user.id });
        n += p.count;
      }
    }
    res.status(201).json({ success: true, data: { created: n } });
  } catch (error) { fail(res, error, "Error saving the offcuts"); }
});

router.get("/offcuts", async (req, res) => {
  try {
    if (!isId(req.query.companyId)) return bad(res, "A valid company is required");
    const filter = { company: req.query.companyId, quantity: { $gt: 0 } };
    if (req.query.product) filter.product = { $in: String(req.query.product).split(",").filter(isId) };
    const rows = await Offcut.find(filter)
      .populate("product", "name internalReference finish baseProduct barLength")
      .populate("sourceProject", "number")
      .sort({ product: 1, length: -1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (error) { fail(res, error, "Error loading the offcuts"); }
});

router.post("/offcuts", async (req, res) => {
  try {
    const { company } = req.body;
    if (!isId(company) || !isId(req.body.product)) return bad(res, "Choose an article");
    const product = await Product.findOne({ _id: req.body.product, company }).select("_id barLength").lean();
    if (!product) return bad(res, "Article not found");
    const length = Math.round(Number(req.body.length));
    const quantity = Math.round(Number(req.body.quantity ?? 1));
    if (!(length > 0) || !(quantity > 0)) return bad(res, "Enter the length (mm) and the quantity");
    if (product.barLength && length > product.barLength) return bad(res, "An offcut can't be longer than the bar");
    const row = await Offcut.create({ company, product: product._id, length, quantity, location: String(req.body.location || "").slice(0, 80), note: String(req.body.note || "").slice(0, 200), createdBy: req.user.id });
    res.status(201).json({ success: true, data: row });
  } catch (error) { fail(res, error, "Error saving the offcut"); }
});

router.delete("/offcuts/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid ID");
    await Offcut.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (error) { fail(res, error, "Error deleting the offcut"); }
});

module.exports = router;
