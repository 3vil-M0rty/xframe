const express = require("express");
const Company = require("../models/Company");
const Customer = require("../models/Customer");
const Project = require("../models/Project");
const Product = require("../models/Product");
const TrackingUnit = require("../models/TrackingUnit");
const DeliveryNote = require("../models/DeliveryNote");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { has: hasPerm } = require("../services/permissionService");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireLogisticsAccess } = require("../middleware/permissionMiddleware");
const { isId, bad } = require("../utils/salesHelpers");
const { logAudit } = require("../services/auditLogger");
const { createWithNumber } = require("../services/documentNumberService");
const { fetchLogoBuffer } = require("../services/pdfHelpers");
const { generateDeliveryNotePdf } = require("../services/deliveryNotePdfService");
const tracking = require("../services/trackingService");
const notifications = require("../services/businessNotifications");

/**
 * ============================================================
 * LOGISTICS (logistique) — /api/logistics
 * ============================================================
 * GET    /to-deliver?companyId=              projects with chassis parts ready to deliver
 * GET    /delivery-notes?companyId=&status=&project=&from=&to=
 * GET    /delivery-notes/:id
 * POST   /delivery-notes                     { project, lines: [{ unit, part, quantity }], transport, … }
 * PUT    /delivery-notes/:id                 edit (draft / planned only)
 * POST   /delivery-notes/:id/status          { status: planned|shipped|delivered|cancelled, receivedBy, reserves, reason }
 * DELETE /delivery-notes/:id                 drafts only
 * GET    /delivery-notes/:id/pdf
 * ============================================================
 */
const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.logistics));
router.use(auth, requireLogisticsAccess);

const fail = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};
const httpError = (message, status = 400) => Object.assign(new Error(message), { status });
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

// ---------------- to deliver ----------------
router.get("/to-deliver", async (req, res) => {
  try {
    const companyId = req.query.companyId;
    if (!isId(companyId) || !(await Company.exists({ _id: companyId }))) return bad(res, "A valid company is required");
    const requireReady = await tracking.deliverRequiresReady(companyId);
    const units = await TrackingUnit.find({ company: companyId, cancelled: false, status: { $nin: ["delivered", "installed", "received"] } })
      .populate("finish", "code name color").populate("model", "name drawing").lean();
    const avail = await tracking.withAvailability(units, companyId);
    const byProject = new Map();
    for (const u of avail) {
      const pending = u.parts.filter((p) => !p.cancelled && p.deliveredQty < p.quantity);
      if (!pending.length) continue;
      const k = String(u.project);
      if (!byProject.has(k)) byProject.set(k, { units: [], available: 0, notYet: 0, reserved: 0 });
      const b = byProject.get(k);
      b.units.push(u);
      b.available += u.available;
      b.reserved += u.parts.reduce((a, p) => a + p.reserved, 0);
      b.notYet += pending.reduce((a, p) => a + Math.max(0, p.quantity - p.deliveredQty - p.reserved - p.available), 0);
    }
    const projects = await Project.find({ _id: { $in: [...byProject.keys()] } }).select("number name customer location dueDate status").populate("customer", "name").lean();
    const data = projects.map((p) => {
      const b = byProject.get(String(p._id));
      b.units.sort((x, y) => x.ref.localeCompare(y.ref, "fr", { numeric: true }));
      return { project: p, available: b.available, reserved: b.reserved, notYet: b.notYet, units: b.units };
    }).sort((a, b) => (b.available > 0) - (a.available > 0) || new Date(a.project.dueDate || 8e15) - new Date(b.project.dueDate || 8e15));
    res.json({ success: true, data: { projects: data, requireReady } });
  } catch (error) { fail(res, error, "Error loading what's to deliver"); }
});

// ---------------- list / detail ----------------
router.get("/delivery-notes", async (req, res) => {
  try {
    const filter = {};
    if (req.query.companyId) { if (!isId(req.query.companyId)) return bad(res, "Invalid company"); filter.company = req.query.companyId; }
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.project && isId(req.query.project)) filter.project = req.query.project;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) { const to = new Date(req.query.to); to.setHours(23, 59, 59, 999); filter.date.$lte = to; }
    }
    const rows = await DeliveryNote.find(filter)
      .populate("project", "number name").populate("customer", "name")
      .sort({ date: -1, createdAt: -1 }).limit(500).lean();
    res.json({
      success: true,
      data: rows.map(({ lines, extraLines, history, ...n }) => ({ ...n, lineCount: lines.length, pieces: lines.reduce((a, l) => a + l.quantity, 0), refs: [...new Set(lines.map((l) => l.ref))].slice(0, 12) })),
    });
  } catch (error) { fail(res, error, "Error loading the delivery notes"); }
});

async function loadNote(req, res) {
  if (!isId(req.params.id)) { bad(res, "Invalid ID"); return null; }
  const note = await DeliveryNote.findById(req.params.id);
  if (!note) { bad(res, "Delivery note not found", 404); return null; }
  return note;
}

router.get("/delivery-notes/:id", async (req, res) => {
  try {
    const found = await loadNote(req, res);
    if (!found) return;
    const note = await DeliveryNote.findById(found._id)
      .populate("project", "number name location customer company")
      .populate("customer", "name phone address city")
      .populate("history.by", "firstName lastName email")
      .populate("extraLines.product", "name unit")
      .lean();
    // Units of the project with what's available (for editing the lines).
    const units = await TrackingUnit.find({ project: note.project._id }).populate("finish", "code name color").lean();
    const avail = await tracking.withAvailability(units, note.company, note._id);
    res.json({ success: true, data: { ...note, units: avail, requireReady: await tracking.deliverRequiresReady(note.company) } });
  } catch (error) { fail(res, error, "Error loading the delivery note"); }
});

// ---------------- create / edit ----------------
/** Validates lines against what can be delivered; returns denormalised lines. */
async function buildLines(project, input, excludeNoteId) {
  const raw = (Array.isArray(input) ? input : []).filter((l) => isId(l?.unit) && isId(l?.part) && Number(l.quantity) > 0);
  if (!raw.length) throw httpError("Select at least one chassis part to deliver");
  const unitIds = [...new Set(raw.map((l) => String(l.unit)))];
  const units = await TrackingUnit.find({ _id: { $in: unitIds }, project: project._id }).populate("finish", "code name").lean();
  if (units.length !== unitIds.length) throw httpError("A chassis does not belong to this project");
  const avail = new Map((await tracking.withAvailability(units, project.company, excludeNoteId)).map((u) => [String(u._id), u]));
  const merged = new Map();
  for (const l of raw) {
    const k = `${l.unit}|${l.part}`;
    merged.set(k, { ...l, quantity: (merged.get(k)?.quantity || 0) + Number(l.quantity) });
  }
  const lines = [];
  for (const l of merged.values()) {
    const u = avail.get(String(l.unit));
    const p = u.parts.find((x) => String(x._id) === String(l.part));
    if (!p) throw httpError(`${u.ref}: part not found`);
    if (u.cancelled || p.cancelled) throw httpError(`${u.ref} — ${p.label} est annulé`);
    if (l.quantity > p.available + 1e-9) throw httpError(`${u.ref} — ${p.label} : ${p.available} disponible(s) à livrer (${l.quantity} demandé(s))`);
    lines.push({
      unit: u._id, part: p._id, ref: u.ref, label: u.label, partLabel: p.label, partKind: p.kind,
      size: p.width && p.height ? `${p.width} × ${p.height}` : u.L && u.H ? `${Math.round(u.L)} × ${Math.round(u.H)}` : "",
      chassisSize: u.L && u.H ? `${Math.round(u.L)} × ${Math.round(u.H)}` : "", finish: u.finish ? u.finish.code : "",
      quantity: Math.round(l.quantity * 1000) / 1000, notes: str(l.notes, 300),
    });
  }
  lines.sort((a, b) => a.ref.localeCompare(b.ref, "fr", { numeric: true }));
  return lines;
}

async function cleanExtraLines(input, companyId) {
  const out = [];
  for (const e of Array.isArray(input) ? input : []) {
    const label = str(e?.label, 200);
    if (!label) continue;
    let product = null;
    if (e.product && isId(e.product) && (await Product.exists({ _id: e.product, company: companyId }))) product = e.product;
    out.push({ label, quantity: Math.max(0, Number(e.quantity) || 0), unit: str(e.unit, 20), product });
  }
  return out;
}

function applyFields(note, body) {
  if (body.date !== undefined) { note.date = body.date ? new Date(body.date) : new Date(); note.lateNotifiedAt = null; }
  for (const [k, max] of [["timeSlot", 60], ["address", 400], ["siteContact", 120], ["sitePhone", 40], ["notes", 2000], ["internalNotes", 2000]]) {
    if (body[k] !== undefined) note[k] = str(body[k], max);
  }
  if (body.packages !== undefined) note.packages = num(body.packages);
  if (body.weightKg !== undefined) note.weightKg = num(body.weightKg);
  if (body.transport !== undefined) {
    const t = body.transport || {};
    note.transport = {
      mode: ["own", "carrier", "pickup"].includes(t.mode) ? t.mode : "own",
      carrier: str(t.carrier, 120), vehicle: str(t.vehicle, 60), driver: str(t.driver, 120), driverPhone: str(t.driverPhone, 40),
      trackingRef: str(t.trackingRef, 80), cost: Math.max(0, Number(t.cost) || 0),
    };
  }
}

router.post("/delivery-notes", async (req, res) => {
  try {
    if (!isId(req.body.project)) return bad(res, "Choose a project");
    const project = await Project.findById(req.body.project).populate("customer", "name address city phone");
    if (!project) return bad(res, "Project not found", 404);
    const lines = await buildLines(project, req.body.lines, null);
    const note = new DeliveryNote({
      company: project.company,
      project: project._id,
      customer: project.customer?._id || null,
      status: req.body.status === "planned" ? "planned" : "draft",
      address: project.location || [project.customer?.address, project.customer?.city].filter(Boolean).join(", "),
      siteContact: project.customer?.name || "",
      sitePhone: project.customer?.phone || "",
      lines,
      extraLines: await cleanExtraLines(req.body.extraLines, project.company),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    const defaults = { address: note.address, siteContact: note.siteContact, sitePhone: note.sitePhone };
    applyFields(note, req.body);
    // Empty fields on the form → the project's site / customer details.
    for (const [k, v] of Object.entries(defaults)) if (!note[k]) note[k] = v;
    note.history.push({ status: note.status, note: "Créé", by: req.user.id });
    const saved = await createWithNumber(DeliveryNote, note.toObject(), "BL");
    await logAudit(req, { company: project.company, action: "create", resourceType: "DeliveryNote", resourceId: saved._id, resourceLabel: `${saved.number} (${project.number})` });
    if (saved.status === "planned") await notifications.onDeliveryPlanned(saved, req.user.id);
    res.status(201).json({ success: true, data: saved });
  } catch (error) { fail(res, error, "Error creating the delivery note"); }
});

router.put("/delivery-notes/:id", async (req, res) => {
  try {
    const note = await loadNote(req, res);
    if (!note) return;
    if (!["draft", "planned"].includes(note.status)) return bad(res, "Only a draft or planned delivery note can be edited");
    const project = await Project.findById(note.project);
    if (req.body.lines !== undefined) note.lines = await buildLines(project, req.body.lines, note._id);
    if (req.body.extraLines !== undefined) note.extraLines = await cleanExtraLines(req.body.extraLines, note.company);
    applyFields(note, req.body);
    note.updatedBy = req.user.id;
    await note.save();
    res.json({ success: true, data: note });
  } catch (error) { fail(res, error, "Error saving the delivery note"); }
});

router.delete("/delivery-notes/:id", async (req, res) => {
  try {
    const note = await loadNote(req, res);
    if (!note) return;
    if (note.status !== "draft") return bad(res, "Only a draft can be deleted — cancel it instead");
    await note.deleteOne();
    res.json({ success: true, message: "Delivery note deleted" });
  } catch (error) { fail(res, error, "Error deleting the delivery note"); }
});

// ---------------- status ----------------
const NEXT = {
  planned: ["draft"],
  shipped: ["draft", "planned"],
  delivered: ["draft", "planned", "shipped"],
  cancelled: ["draft", "planned", "shipped", "delivered"],
};

/** Adds (sign 1) or removes (sign −1) the note's pieces from the parts' deliveredQty. */
async function moveDelivered(note, sign, actorId) {
  const byUnit = new Map();
  for (const l of note.lines) {
    if (!byUnit.has(String(l.unit))) byUnit.set(String(l.unit), []);
    byUnit.get(String(l.unit)).push(l);
  }
  const units = await TrackingUnit.find({ _id: { $in: [...byUnit.keys()] } });
  // Check first (nothing half-applied).
  for (const u of units) {
    for (const l of byUnit.get(String(u._id))) {
      const p = u.parts.id(l.part);
      if (!p) throw httpError(`${l.ref} — ${l.partLabel} : élément introuvable`);
      if (sign < 0 && p.deliveredQty - l.quantity < p.installedQty - 1e-9) throw httpError(`${l.ref} — ${l.partLabel} est déjà posé : annulez la pose d'abord`);
    }
  }
  for (const u of units) {
    for (const l of byUnit.get(String(u._id))) {
      const p = u.parts.id(l.part);
      p.deliveredQty = Math.max(0, Math.min(p.quantity, p.deliveredQty + sign * l.quantity));
      if (sign > 0) { p.madeQty = Math.max(p.madeQty, p.deliveredQty); p.readyQty = Math.max(p.readyQty, p.deliveredQty); }
    }
    u.history.push({ by: actorId, action: sign > 0 ? "delivered" : "returned", note: `${note.number} : ${byUnit.get(String(u._id)).map((l) => `${l.partLabel} × ${l.quantity}`).join(", ")}` });
    u.markModified("parts");
    await u.save();
  }
}

router.post("/delivery-notes/:id/status", async (req, res) => {
  try {
    const note = await loadNote(req, res);
    if (!note) return;
    const next = req.body.status;
    if (!NEXT[next]) return bad(res, "Invalid status");
    // Planning / shipping, marking delivered and cancelling (returns) are separate permissions.
    const needed = next === "delivered" ? "logistics.notes.deliver" : next === "cancelled" ? "logistics.notes.cancel" : next === "draft" ? "logistics.notes.edit" : "logistics.notes.ship";
    if (!hasPerm(req.user, needed)) return res.status(403).json({ success: false, message: "You don't have the permission for this action", permission: needed });
    if (!NEXT[next].includes(note.status)) return bad(res, `A ${note.status} delivery note can't become ${next}`);
    const now = new Date();
    const project = await Project.findById(note.project);
    if (next === "delivered") {
      // Re-check availability (stock of ready parts may have changed since the draft).
      await buildLines(project, note.lines.map((l) => ({ unit: l.unit, part: l.part, quantity: l.quantity, notes: l.notes })), note._id);
      await moveDelivered(note, 1, req.user.id);
      note.deliveredAt = req.body.deliveredAt ? new Date(req.body.deliveredAt) : now;
      note.shippedAt = note.shippedAt || note.deliveredAt;
      note.receivedBy = str(req.body.receivedBy, 120);
      note.reserves = str(req.body.reserves, 2000);
      // Carrier / transport cost → the project's other costs.
      if (note.transport?.cost > 0 && project) {
        project.expenses.push({ date: note.deliveredAt, label: `Transport ${note.number}${note.transport.carrier ? ` — ${note.transport.carrier}` : ""}`, amount: note.transport.cost, by: req.user.id });
        note.expenseId = project.expenses[project.expenses.length - 1]._id;
        await project.save();
      }
    }
    if (next === "shipped") note.shippedAt = now;
    if (next === "cancelled") {
      if (note.status === "delivered") {
        await moveDelivered(note, -1, req.user.id);
        if (note.expenseId && project) {
          const exp = project.expenses.id(note.expenseId);
          if (exp) { exp.deleteOne(); await project.save(); }
          note.expenseId = null;
        }
      }
      note.cancelReason = str(req.body.reason, 500);
    }
    const previous = note.status;
    note.status = next;
    note.history.push({ status: next, note: str(req.body.reason || req.body.reserves || "", 500), by: req.user.id });
    note.updatedBy = req.user.id;
    await note.save();
    await logAudit(req, { company: note.company, action: "update", resourceType: "DeliveryNote", resourceId: note._id, resourceLabel: `${note.number} ${previous} → ${next}` });
    if (next === "planned") await notifications.onDeliveryPlanned(note, req.user.id);
    if (next === "shipped") await notifications.onDeliveryShipped(note, req.user.id);
    if (next === "delivered") await notifications.onDeliveryDelivered(note, req.user.id);
    res.json({ success: true, data: note });
  } catch (error) { fail(res, error, "Error updating the delivery note"); }
});

router.get("/delivery-notes/:id/pdf", async (req, res) => {
  try {
    const found = await loadNote(req, res);
    if (!found) return;
    const note = await DeliveryNote.findById(found._id).populate("project", "number name location").populate("customer").lean();
    const company = await Company.findById(note.company).lean();
    const logoBuffer = await fetchLogoBuffer(company).catch(() => null);
    const doc = generateDeliveryNotePdf({ note, company, logoBuffer });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${note.number}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) { fail(res, error, "Error generating the PDF"); }
});

// Customers are populated on notes; keep the model registered.
void Customer;

module.exports = router;
