const express = require("express");
const Company = require("../models/Company");
const Project = require("../models/Project");
const TrackingUnit = require("../models/TrackingUnit");
const DeliveryNote = require("../models/DeliveryNote");
const ProductionOrder = require("../models/ProductionOrder");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { canViewProjects, canAccessLogistics, canUpdateTracking } = require("../permissions/permissions");
const { has, hasAny } = require("../services/permissionService");
// Tracking actions by department: production marks started / made / ready,
// logistics marks installed / accepted (config/permissionCatalog.js).
const LOGISTICS_ACTIONS = ["installed", "received", "uninstalled", "unreceived"];
const actionPermission = (action) => (LOGISTICS_ACTIONS.includes(action) ? "logistics.tracking.update" : "production.tracking.update");
const { isId, bad } = require("../utils/salesHelpers");
const { logAudit } = require("../services/auditLogger");
const tracking = require("../services/trackingService");
const notifications = require("../services/businessNotifications");

/**
 * ============================================================
 * CHASSIS TRACKING — /api/tracking
 * ============================================================
 * Read: whoever sees projects, and logistics. Update: production,
 * logistics, owners. Cancelling a chassis: production / owners.
 *
 * GET  /projects?companyId=&status=           overview: every project's progress per stage
 * GET  /projects/:projectId                   units + parts (+ availability) + summary + notes
 * POST /projects/:projectId/sync              rebuild units from the ouvrages
 * POST /projects/:projectId/actions           { action, targets: [{ unit, part?, quantity? }], note }
 * PUT  /units/:unitId/parts                   edit a unit's breakdown { parts: [{ _id?, label, kind, quantity }] }
 * POST /units/:unitId/cancel                  { reason } — cancels one chassis (ouvrage quantity − 1)
 * ============================================================
 */
const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.tracking));
router.use(auth, (req, res, next) => (canViewProjects(req.user) || canAccessLogistics(req.user) || hasAny(req.user, ["production.tracking.view", "logistics.tracking.view"]) ? next() : bad(res, "You do not have access to chassis tracking", 403)));

const fail = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};

router.get("/projects", async (req, res) => {
  try {
    const companyId = req.query.companyId;
    if (!isId(companyId) || !(await Company.exists({ _id: companyId }))) return bad(res, "A valid company is required");
    const statuses = req.query.status === "all" ? undefined : ["planned", "in_progress", "on_hold"];
    const projects = await Project.find({ company: companyId, ...(statuses ? { status: { $in: statuses } } : {}) })
      .select("number name status dueDate customer items manager location")
      .populate("customer", "name")
      .populate("manager", "firstName lastName")
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();
    const ids = projects.map((p) => p._id);
    const [units, notes, orders] = await Promise.all([
      TrackingUnit.find({ project: { $in: ids } }).select("project status cancelled modified parts").lean(),
      DeliveryNote.find({ project: { $in: ids }, status: { $in: ["planned", "shipped", "delivered"] } }).select("project number status date deliveredAt").sort({ date: 1 }).lean(),
      ProductionOrder.find({ project: { $in: ids }, status: { $ne: "cancelled" } }).select("project status").lean(),
    ]);
    const now = new Date();
    const data = projects.filter((p) => (p.items || []).length > 0).map((p) => {
      const mine = units.filter((u) => String(u.project) === String(p._id));
      const s = tracking.summarize(mine);
      const pn = notes.filter((n) => String(n.project) === String(p._id));
      const po = orders.filter((o) => String(o.project) === String(p._id));
      const readyPieces = mine.filter((u) => !u.cancelled).reduce((a, u) => a + u.parts.reduce((b, x) => b + (x.cancelled ? 0 : Math.max(0, x.readyQty - x.deliveredQty)), 0), 0);
      return {
        _id: p._id, number: p.number, name: p.name, status: p.status, dueDate: p.dueDate, customer: p.customer, manager: p.manager, location: p.location,
        chassis: (p.items || []).reduce((a, i) => a + (i.quantity || 0), 0),
        tracked: mine.length > 0,
        summary: s,
        readyPieces,
        orders: { total: po.length, done: po.filter((o) => o.status === "done").length },
        nextDelivery: pn.find((n) => n.status !== "delivered" && n.date) || null,
        lastDelivery: [...pn].reverse().find((n) => n.status === "delivered") || null,
        late: !!(p.dueDate && new Date(p.dueDate) < now && s.percent.delivered < 100),
      };
    });
    res.json({ success: true, data });
  } catch (error) { fail(res, error, "Error loading the tracking overview"); }
});

async function loadProject(req, res) {
  if (!isId(req.params.projectId)) { bad(res, "Invalid project ID"); return null; }
  const project = await Project.findById(req.params.projectId);
  if (!project) { bad(res, "Project not found", 404); return null; }
  return project;
}

router.get("/projects/:projectId", async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    let units = await TrackingUnit.find({ project: project._id }).populate("finish", "code name color").populate("model", "name drawing family").populate("history.by", "firstName lastName email").sort({ ref: 1, index: 1 });
    // First visit on a project with ouvrages: build its tracking.
    if (!units.length && (project.items || []).length) {
      await tracking.syncProjectUnits(project, req.user.id);
      units = await TrackingUnit.find({ project: project._id }).populate("finish", "code name color").populate("model", "name drawing family").populate("history.by", "firstName lastName email").sort({ ref: 1, index: 1 });
    }
    const withAvail = await tracking.withAvailability(units, project.company);
    // Items order, then unit index.
    const order = new Map((project.items || []).map((it, i) => [String(it._id), i]));
    withAvail.sort((a, b) => (order.get(String(a.projectItem)) ?? 999) - (order.get(String(b.projectItem)) ?? 999) || a.index - b.index);
    const notes = await DeliveryNote.find({ project: project._id }).select("number status date deliveredAt transport lines").sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: {
        project: { _id: project._id, number: project.number, name: project.name, company: project.company, status: project.status },
        units: withAvail,
        summary: tracking.summarize(withAvail),
        deliveryNotes: notes.map(({ lines, ...n }) => ({ ...n, pieces: (lines || []).reduce((a, l) => a + l.quantity, 0), refs: [...new Set((lines || []).map((l) => l.ref))] })),
        requireReady: await tracking.deliverRequiresReady(project.company),
        canUpdate: canUpdateTracking(req.user),
        canCancel: has(req.user, "production.tracking.cancel"),
        can: {
          production: has(req.user, "production.tracking.update"),
          logistics: has(req.user, "logistics.tracking.update"),
          parts: has(req.user, "production.tracking.parts"),
          cancel: has(req.user, "production.tracking.cancel"),
          deliver: has(req.user, "logistics.notes.create"),
        },
      },
    });
  } catch (error) { fail(res, error, "Error loading the chassis tracking"); }
});

router.post("/projects/:projectId/sync", async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    res.json({ success: true, data: await tracking.syncProjectUnits(project, req.user.id) });
  } catch (error) { fail(res, error, "Error rebuilding the tracking"); }
});

router.post("/projects/:projectId/actions", async (req, res) => {
  try {
    if (!has(req.user, actionPermission(req.body.action))) {
      return res.status(403).json({ success: false, message: "You don't have the permission for this action", permission: actionPermission(req.body.action) });
    }
    const project = await loadProject(req, res);
    if (!project) return;
    const targets = (Array.isArray(req.body.targets) ? req.body.targets : []).filter((t) => isId(t?.unit) && (!t.part || isId(t.part)));
    if (!targets.length) return bad(res, "Select at least one chassis");
    for (const t of targets) if (t.quantity !== undefined && t.quantity !== null && t.quantity !== "" && !(Number(t.quantity) > 0)) return bad(res, "Invalid quantity");
    const { units, newlyReady } = await tracking.applyAction(project._id, req.body.action, targets, req.user.id, String(req.body.note || "").slice(0, 300));
    await notifications.onTrackingChanged(project, req.body.action, { units, newlyReady }, req.user.id);
    res.json({ success: true, data: { updated: units.length } });
  } catch (error) { fail(res, error, "Error updating the tracking"); }
});

async function loadUnit(req, res) {
  if (!isId(req.params.unitId)) { bad(res, "Invalid ID"); return null; }
  const unit = await TrackingUnit.findById(req.params.unitId);
  if (!unit) { bad(res, "Chassis not found", 404); return null; }
  return unit;
}

/** Custom breakdown of one chassis: rename, add, split, remove parts. */
router.put("/units/:unitId/parts", async (req, res) => {
  try {
    const unit = await loadUnit(req, res);
    if (!unit) return;
    if (unit.cancelled) return bad(res, "This chassis is cancelled");
    const input = Array.isArray(req.body.parts) ? req.body.parts : [];
    if (!input.length) return bad(res, "A chassis needs at least one part");
    const next = [];
    for (const [i, p] of input.entries()) {
      const label = String(p?.label || "").trim();
      const quantity = Number(p?.quantity);
      if (!label) return bad(res, `Part ${i + 1}: enter a label`);
      if (!(quantity > 0)) return bad(res, `Part ${i + 1}: the quantity must be positive`);
      const old = p._id ? unit.parts.id(p._id) : null;
      if (p._id && !old) return bad(res, `Part ${i + 1}: not found`);
      if (old && quantity < Math.max(old.deliveredQty, old.madeQty)) return bad(res, `${label} : ${Math.max(old.deliveredQty, old.madeQty)} déjà fabriqué(s) / livré(s)`);
      next.push({
        ...(old ? old.toObject() : { madeQty: 0, readyQty: 0, deliveredQty: 0, installedQty: 0 }),
        key: old?.key || String(p.key || label).toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 40),
        label: label.slice(0, 150),
        kind: TrackingUnit.PART_KINDS.includes(p.kind) ? p.kind : old?.kind || "other",
        quantity,
        cancelled: false,
        notes: String(p.notes ?? old?.notes ?? "").slice(0, 300),
      });
    }
    // Parts removed: only if nothing happened to them (else cancel them).
    for (const old of unit.parts) {
      if (next.some((n) => String(n._id) === String(old._id))) continue;
      if (old.madeQty > 0 || old.deliveredQty > 0) next.push({ ...old.toObject(), cancelled: true });
      const reserved = await DeliveryNote.exists({ status: { $in: tracking.OPEN_NOTE_STATUSES }, lines: { $elemMatch: { unit: unit._id, part: old._id } } });
      if (reserved) return bad(res, `${old.label} est sur un bon de livraison en cours`);
    }
    unit.parts = next;
    unit.history.push({ by: req.user.id, action: "parts_edited", note: next.filter((p) => !p.cancelled).map((p) => `${p.label} × ${p.quantity}`).join(", ") });
    await unit.save();
    res.json({ success: true, data: unit });
  } catch (error) { fail(res, error, "Error saving the breakdown"); }
});

/** Cancel one chassis: the ouvrage's quantity goes down by one. */
router.post("/units/:unitId/cancel", async (req, res) => {
  try {
    const unit = await loadUnit(req, res);
    if (!unit) return;
    if (unit.cancelled) return bad(res, "Already cancelled");
    if (await DeliveryNote.exists({ status: { $in: tracking.OPEN_NOTE_STATUSES }, "lines.unit": unit._id })) return bad(res, "This chassis is on a delivery note in progress: remove it from the note first");
    const project = await Project.findById(unit.project);
    const item = project?.items.id(unit.projectItem);
    const reason = String(req.body.reason || "").slice(0, 300);
    unit.cancelled = true;
    unit.cancelledAt = new Date();
    unit.cancelReason = reason || "Annulé";
    unit.history.push({ by: req.user.id, action: "cancelled", note: reason });
    await unit.save();
    if (item) {
      if (item.quantity > 1) item.quantity -= 1; else item.deleteOne();
      project.updatedBy = req.user.id;
      await project.save();
      await tracking.syncProjectUnits(project, req.user.id);
    }
    await logAudit(req, { company: unit.company, action: "update", resourceType: "TrackingUnit", resourceId: unit._id, resourceLabel: `${unit.ref} annulé${reason ? ` — ${reason}` : ""}` });
    res.json({ success: true, data: unit });
  } catch (error) { fail(res, error, "Error cancelling the chassis"); }
});

module.exports = router;
