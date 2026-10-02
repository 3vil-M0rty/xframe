/**
 * ============================================================
 * CHASSIS TRACKING (suivi) — units, parts, stages
 * ============================================================
 *   syncProjectUnits(project)    one unit per chassis of every ouvrage;
 *                                quantity down / ouvrage removed →
 *                                units cancelled; size / model / options
 *                                changed after production started →
 *                                unit flagged "modified" (to remake)
 *   applyAction(units, action)   made / ready / installed / received /
 *                                undo… on units or single parts
 *   availability(units)          what can go on a new delivery note
 *   summarize(units)             counts per stage (project & overview)
 *   onOrderStarted / onOrderProgress / onOrderCompleted
 *                                work orders move the chassis along
 * ============================================================
 */
const crypto = require("crypto");
const TrackingUnit = require("../models/TrackingUnit");
const ChassisModel = require("../models/ChassisModel");
const ProfileSeries = require("../models/ProfileSeries");
const DeliveryNote = require("../models/DeliveryNote");
const Project = require("../models/Project");
const ProductionSettings = require("../models/ProductionSettings");
const { evaluate } = require("./formulaEngine");
const { buildVariables, round } = require("./chassisBom");

const httpError = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const OPEN_NOTE_STATUSES = ["draft", "planned", "shipped"];
const GLASS_KINDS = new Set(["glass", "module"]);

function specHash(item, finish) {
  const payload = JSON.stringify([String(item.model?._id || item.model), item.L, item.H, String(finish || ""), item.params || {}]);
  return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 16);
}

/** The deliverable parts of one chassis, from its model's breakdown. */
function partsFor(model, series, item) {
  const defs = model?.deliveryParts?.length ? model.deliveryParts : [{ key: "complet", label: "Châssis complet", kind: "complete", qty: "1", condition: "" }];
  let vars = {};
  try { vars = model ? buildVariables(model, series, item.L, item.H, item.params || {}).vars : {}; } catch { vars = {}; }
  const out = [];
  for (const d of defs) {
    try {
      if (d.condition && !evaluate(d.condition, vars, 1)) continue;
      const q = Math.round(evaluate(d.qty || "1", vars, 1) * 1000) / 1000;
      if (!(q > 0)) continue;
      const size = {};
      try {
        if (d.width) size.width = Math.round(evaluate(d.width, vars, 0));
        if (d.height) size.height = Math.round(evaluate(d.height, vars, 0));
      } catch { /* keep the chassis size */ }
      if (!(size.width > 0)) delete size.width;
      if (!(size.height > 0)) delete size.height;
      // One element per piece (Vantail 1, Vantail 2…) for whole quantities up to 60.
      if (d.perPiece && q > 1 && Number.isInteger(q) && q <= 60) {
        const base = d.pieceLabel || d.label;
        for (let i = 1; i <= q; i += 1) out.push({ key: `${d.key}_${i}`, label: `${base} ${i}`, kind: d.kind || "other", quantity: 1, ...size });
        continue;
      }
      out.push({ key: d.key, label: d.label, kind: d.kind || "other", quantity: q, ...size });
    } catch {
      out.push({ key: d.key, label: d.label, kind: d.kind || "other", quantity: 1 });
    }
  }
  return out.length ? out : [{ key: "complet", label: "Châssis complet", kind: "complete", quantity: 1 }];
}

const unitRef = (item, index) => (item.quantity > 1 ? `${item.ref || "R"}-${index}` : item.ref || "R");
const progressOf = (u) => u.parts.some((p) => p.startedQty > 0 || p.madeQty > 0 || p.deliveredQty > 0) || !!u.productionStartedAt;

/**
 * Brings the tracking units of a project in line with its ouvrages.
 * Returns { created, cancelled, modified, reactivated }.
 */
async function syncProjectUnits(project, actorId = null) {
  const p = project.toObject ? project.toObject() : project;
  const items = p.items || [];
  const modelIds = [...new Set(items.map((i) => String(i.model?._id || i.model)))];
  const models = new Map((await ChassisModel.find({ _id: { $in: modelIds } }).lean()).map((m) => [String(m._id), m]));
  const seriesIds = [...new Set([...models.values()].map((m) => m.series).filter(Boolean).map(String))];
  const series = new Map((await ProfileSeries.find({ _id: { $in: seriesIds } }).lean()).map((s) => [String(s._id), s]));
  const units = await TrackingUnit.find({ project: p._id });
  const stats = { created: 0, cancelled: 0, modified: 0, reactivated: 0 };
  const now = new Date();
  const itemIds = new Set(items.map((i) => String(i._id)));

  // Ouvrages removed → their units are cancelled.
  for (const u of units) {
    if (!itemIds.has(String(u.projectItem)) && !u.cancelled) {
      u.cancelled = true;
      u.cancelledAt = now;
      u.cancelReason = "Ouvrage retiré du projet";
      u.history.push({ by: actorId, action: "cancelled", note: progressOf(u) ? "Ouvrage retiré — déjà en fabrication / livré : à traiter" : "Ouvrage retiré du projet" });
      await u.save();
      stats.cancelled += 1;
    }
  }

  for (const item of items) {
    const model = models.get(String(item.model?._id || item.model));
    const finish = item.finish || p.finish || null;
    const hash = specHash(item, finish);
    const mine = units.filter((u) => String(u.projectItem) === String(item._id)).sort((a, b) => a.index - b.index);
    const label = item.label || model?.name || "";
    const wanted = Math.max(0, Math.round(item.quantity || 0));

    // Active units beyond the quantity (highest indexes first) → cancelled.
    let active = mine.filter((u) => !u.cancelled);
    while (active.length > wanted) {
      const u = active.pop();
      u.cancelled = true;
      u.cancelledAt = now;
      u.cancelReason = "Quantité réduite";
      u.history.push({ by: actorId, action: "cancelled", note: progressOf(u) ? "Quantité réduite — chassis déjà en fabrication / livré : à traiter" : "Quantité réduite" });
      await u.save();
      stats.cancelled += 1;
    }
    // Missing units → reactivate cancelled ones, then create.
    for (let index = 1; active.length < wanted; index += 1) {
      const existing = mine.find((u) => u.index === index);
      if (existing && !existing.cancelled) continue;
      if (existing) {
        existing.cancelled = false;
        existing.cancelledAt = null;
        existing.cancelReason = "";
        existing.history.push({ by: actorId, action: "reactivated", note: "Quantité augmentée" });
        existing.markModified("history");
        await existing.save();
        active.push(existing);
        stats.reactivated += 1;
        continue;
      }
      const u = await TrackingUnit.create({
        company: p.company, project: p._id, projectItem: item._id, index, ref: unitRef(item, index), model: model?._id || null,
        label, L: item.L, H: item.H, finish, specHash: hash,
        parts: partsFor(model, model?.series ? series.get(String(model.series)) : null, item),
        history: [{ by: actorId, action: "created", note: "" }],
      });
      active.push(u);
      mine.push(u);
      stats.created += 1;
    }

    // Ref / label / spec changes on the active units.
    const freshParts = partsFor(model, model?.series ? series.get(String(model.series)) : null, item);
    const signature = (parts) => parts.filter((x) => !x.cancelled).map((x) => `${x.key}:${x.quantity}:${x.kind}`).join("|");
    for (const u of active) {
      let dirty = false;
      // Breakdown changed in the model (e.g. "one element per piece") →
      // units nobody touched yet follow it; others keep theirs.
      const untouched = !progressOf(u) && !u.parts.some((x) => x.startedQty > 0) && !(u.history || []).some((h) => h.action === "parts_edited");
      if (untouched && u.specHash === hash && signature(u.parts) !== signature(freshParts)) {
        const reserved = await DeliveryNote.exists({ status: { $in: OPEN_NOTE_STATUSES }, "lines.unit": u._id });
        if (!reserved) {
          u.parts = freshParts.map((f) => ({ ...f }));
          u.history.push({ by: actorId, action: "parts_edited", note: "Découpage du modèle appliqué" });
          dirty = true;
        }
      }
      // Refs stay stable once printed on a delivery note: only follow a renamed ouvrage.
      if (!u.ref.startsWith(item.ref || "R")) { u.ref = unitRef(item, u.index); dirty = true; }
      if (u.label !== label) { u.label = label; dirty = true; }
      if (u.specHash !== hash) {
        const before = `${u.L} × ${u.H}`;
        const started = progressOf(u);
        const fresh = partsFor(model, model?.series ? series.get(String(model.series)) : null, item);
        // Keep what was already delivered / installed on parts that still exist;
        // made / ready go back to zero when the chassis must be remade.
        u.parts = fresh.map((f) => {
          const old = u.parts.find((x) => x.key === f.key);
          if (!old) return f;
          return { ...f, _id: old._id, startedQty: started ? 0 : old.startedQty, madeQty: started ? 0 : old.madeQty, readyQty: started ? 0 : old.readyQty, deliveredQty: old.deliveredQty, installedQty: old.installedQty, notes: old.notes };
        });
        u.model = model?._id || null;
        u.L = item.L;
        u.H = item.H;
        u.finish = finish;
        u.specHash = hash;
        if (started) {
          u.modified = true;
          u.modifiedAt = now;
          stats.modified += 1;
        }
        u.history.push({ by: actorId, action: "modified", note: `${before} → ${item.L} × ${item.H}${started ? " — déjà en fabrication : à refaire / vérifier" : ""}` });
        dirty = true;
      }
      // Element sizes follow the model's formulas (they only label the parts).
      for (const p of u.parts) {
        const f = freshParts.find((x) => x.key === p.key);
        const w = f?.width ?? null;
        const h = f?.height ?? null;
        if ((p.width ?? null) !== w || (p.height ?? null) !== h) { p.width = w; p.height = h; dirty = true; }
      }
      if (dirty) { u.markModified("parts"); await u.save(); }
    }
  }
  return stats;
}

/** Pieces of each part reserved on open (not yet delivered) delivery notes. */
async function reservations(unitIds, excludeNoteId = null) {
  const filter = { "lines.unit": { $in: unitIds }, status: { $in: OPEN_NOTE_STATUSES } };
  const notes = await DeliveryNote.find(filter).select("lines status number").lean();
  const map = new Map();
  for (const n of notes) {
    if (excludeNoteId && String(n._id) === String(excludeNoteId)) continue;
    for (const l of n.lines) {
      const k = `${l.unit}|${l.part}`;
      const r = map.get(k) || { qty: 0, notes: [] };
      r.qty += l.quantity;
      if (!r.notes.includes(n.number)) r.notes.push(n.number);
      map.set(k, r);
    }
  }
  return map;
}

async function deliverRequiresReady(companyId) {
  const s = await ProductionSettings.findOne({ company: companyId }).select("deliverRequiresReady").lean();
  return s ? s.deliverRequiresReady !== false : true;
}

/** Adds `available` (can go on a new delivery note) and `reserved` to every part. */
async function withAvailability(units, companyId, excludeNoteId = null) {
  const res = await reservations(units.map((u) => u._id), excludeNoteId);
  const requireReady = await deliverRequiresReady(companyId);
  return units.map((u) => {
    const obj = u.toObject ? u.toObject() : u;
    obj.parts = obj.parts.map((p) => {
      const r = res.get(`${obj._id}|${p._id}`) || { qty: 0, notes: [] };
      const base = requireReady ? p.readyQty : p.madeQty;
      const available = obj.cancelled || p.cancelled ? 0 : round(Math.max(0, base - p.deliveredQty - r.qty), 3);
      return { ...p, reserved: round(r.qty, 3), reservedOn: r.notes, available };
    });
    obj.available = obj.parts.reduce((a, p) => a + p.available, 0);
    return obj;
  });
}

const ACTIONS = ["started", "made", "ready", "installed", "received", "unstarted", "unmade", "unready", "uninstalled", "unreceived", "production_started", "clear_modified"];

/**
 * targets = [{ unit, part?, quantity? }] — no part = every part of the unit;
 * no quantity = the whole part.
 */
async function applyAction(projectId, action, targets, actorId, note = "") {
  if (!ACTIONS.includes(action)) throw httpError("Unknown action");
  const ids = [...new Set(targets.map((t) => String(t.unit)))];
  const units = await TrackingUnit.find({ _id: { $in: ids }, project: projectId });
  if (units.length !== ids.length) throw httpError("Chassis not found in this project", 404);
  const byId = new Map(units.map((u) => [String(u._id), u]));
  const changed = new Set();
  const newlyReady = [];
  const now = new Date();
  for (const t of targets) {
    const u = byId.get(String(t.unit));
    if (u.cancelled) continue;
    if (action === "production_started") { if (!u.productionStartedAt) { u.productionStartedAt = now; changed.add(u); } continue; }
    if (action === "clear_modified") { if (u.modified) { u.modified = false; u.history.push({ by: actorId, action: "modification_checked", note }); changed.add(u); } continue; }
    if (action === "received" || action === "unreceived") {
      if (action === "received" && u.parts.some((p) => !p.cancelled && p.installedQty < p.quantity)) throw httpError(`${u.ref} : tout doit être posé avant la réception`);
      u.receivedAt = action === "received" ? now : null;
      u.history.push({ by: actorId, action, note });
      changed.add(u);
      continue;
    }
    const parts = t.part ? u.parts.filter((p) => String(p._id) === String(t.part)) : u.parts.filter((p) => !p.cancelled);
    if (t.part && !parts.length) throw httpError("Part not found", 404);
    for (const p of parts) {
      const q = t.quantity !== undefined && t.quantity !== null && t.quantity !== "" ? Number(t.quantity) : null;
      const before = { started: p.startedQty, made: p.madeQty, ready: p.readyQty, installed: p.installedQty };
      if (action === "started") p.startedQty = Math.min(p.quantity, q === null ? p.quantity : Math.max(p.startedQty, p.madeQty) + q);
      if (action === "unstarted") p.startedQty = Math.max(p.madeQty, q === null ? p.madeQty : p.startedQty - q);
      if (action === "made") p.madeQty = Math.min(p.quantity, q === null ? p.quantity : p.madeQty + q);
      if (action === "ready") {
        p.madeQty = Math.min(p.quantity, q === null ? p.quantity : Math.max(p.madeQty, p.readyQty + q));
        p.readyQty = Math.min(p.madeQty, q === null ? p.quantity : p.readyQty + q);
      }
      if (action === "installed") {
        const next = q === null ? p.deliveredQty : p.installedQty + q;
        if (next > p.deliveredQty + 1e-9) throw httpError(`${u.ref} — ${p.label} : on ne peut poser que ce qui a été livré (${p.deliveredQty})`);
        p.installedQty = next;
      }
      if (action === "unmade") {
        const floor = Math.max(p.deliveredQty, 0);
        p.madeQty = Math.max(floor, q === null ? floor : p.madeQty - q);
        p.readyQty = Math.min(p.readyQty, p.madeQty);
        p.startedQty = Math.max(p.madeQty, Math.min(p.startedQty, p.madeQty + (q === null ? 0 : q)));
      }
      if (action === "unready") p.readyQty = Math.max(p.deliveredQty, q === null ? p.deliveredQty : p.readyQty - q);
      if (action === "uninstalled") p.installedQty = Math.max(0, q === null ? 0 : p.installedQty - q);
      if (action === "made") p.startedQty = Math.max(p.startedQty, p.madeQty);
      if (before.started !== p.startedQty || before.made !== p.madeQty || before.ready !== p.readyQty || before.installed !== p.installedQty) {
        changed.add(u);
        if (action === "ready" && p.readyQty > before.ready) newlyReady.push({ unit: u, part: p, qty: p.readyQty - before.ready });
      }
    }
    if (changed.has(u)) u.history.push({ by: actorId, action, note: t.part ? `${parts[0]?.label || ""}${t.quantity ? ` × ${t.quantity}` : ""}${note ? ` — ${note}` : ""}` : note });
  }
  if (!changed.size && ["installed", "made", "ready", "started"].includes(action)) {
    throw httpError(action === "installed" ? "Rien à poser : les éléments sélectionnés ne sont pas livrés (ou déjà posés)" : "Rien à changer : les éléments sélectionnés sont déjà à cette étape");
  }
  for (const u of changed) {
    u.markModified("parts");
    await u.save();
  }
  return { units: [...changed], newlyReady };
}

/** Counts per stage — for a project's tab and the overview page. */
function summarize(units) {
  const s = { units: 0, cancelled: 0, modified: 0, to_make: 0, in_production: 0, made: 0, ready: 0, partially_delivered: 0, delivered: 0, installed: 0, received: 0, piecesToDeliver: 0 };
  for (const u of units) {
    if (u.cancelled) { s.cancelled += 1; continue; }
    s.units += 1;
    if (u.modified) s.modified += 1;
    s[u.status] = (s[u.status] || 0) + 1;
  }
  const done = (from) => units.filter((u) => !u.cancelled && TrackingUnit.ORDER.indexOf(u.status) >= TrackingUnit.ORDER.indexOf(from)).length;
  const pct = (n) => (s.units ? Math.round((n / s.units) * 100) : 0);
  s.percent = { made: pct(done("made")), ready: pct(done("ready")), delivered: pct(done("delivered")), installed: pct(done("installed")), received: pct(done("received")) };
  s.counts = { made: done("made"), ready: done("ready"), delivered: done("delivered"), installed: done("installed"), received: done("received") };
  return s;
}

// ------------------------------------------------------------------
// Work orders move the chassis
// ------------------------------------------------------------------
/**
 * A work order starts → the parts that workshop makes are "in progress":
 * aluminium → frames, sashes, screens…; vitrage → glass. Adjustable by hand.
 */
async function onOrderStarted(order) {
  if (!order.project || !["aluminium", "vitrage", "other"].includes(order.kind)) return;
  const units = await TrackingUnit.find({ project: order.project, cancelled: false });
  for (const u of units) {
    let dirty = false;
    for (const p of u.parts) {
      if (p.cancelled) continue;
      const isGlass = GLASS_KINDS.has(p.kind);
      if (order.kind === "vitrage" ? !isGlass : isGlass) continue;
      if (p.startedQty < p.quantity) { p.startedQty = p.quantity; dirty = true; }
    }
    if (order.kind !== "vitrage" && !u.productionStartedAt) { u.productionStartedAt = new Date(); dirty = true; }
    if (dirty) {
      u.history.push({ action: "production_started", note: order.number });
      u.markModified("parts");
      await u.save();
    }
  }
}

/** Aluminium: "done" per ouvrage line → the first N chassis of that line are made (except glass). */
async function onOrderProgress(order, actorId = null) {
  if (!order.project || order.kind !== "aluminium") return;
  for (const item of order.items || []) {
    if (!item.projectItem) continue;
    const units = await TrackingUnit.find({ project: order.project, projectItem: item.projectItem, cancelled: false }).sort({ index: 1 });
    const done = Math.floor(item.done || 0);
    for (const [i, u] of units.entries()) {
      if (i >= done) break;
      let dirty = false;
      for (const p of u.parts) {
        if (p.cancelled || GLASS_KINDS.has(p.kind)) continue;
        if (p.madeQty < p.quantity) { p.madeQty = p.quantity; dirty = true; }
      }
      if (!u.productionStartedAt) { u.productionStartedAt = new Date(); dirty = true; }
      if (dirty) {
        u.history.push({ by: actorId, action: "made", note: `Fabriqué (${order.number})` });
        u.markModified("parts");
        await u.save();
      }
    }
  }
}

/** Completed: aluminium → frames / sashes made ; vitrage → glass made. */
async function onOrderCompleted(order, actorId = null) {
  if (!order.project) return;
  if (!["aluminium", "vitrage"].includes(order.kind)) return;
  const units = await TrackingUnit.find({ project: order.project, cancelled: false });
  for (const u of units) {
    let dirty = false;
    for (const p of u.parts) {
      if (p.cancelled) continue;
      const isGlass = GLASS_KINDS.has(p.kind);
      // A complete chassis (glass included) is made when aluminium is done.
      if (order.kind === "vitrage" ? !isGlass : isGlass) continue;
      if (p.madeQty < p.quantity) { p.madeQty = p.quantity; dirty = true; }
    }
    if (!u.productionStartedAt) { u.productionStartedAt = new Date(); dirty = true; }
    if (dirty) {
      u.history.push({ by: actorId, action: "made", note: `Fabriqué (${order.number})` });
      u.markModified("parts");
      await u.save();
    }
  }
}

module.exports = {
  syncProjectUnits, partsFor, withAvailability, reservations, applyAction, summarize, deliverRequiresReady,
  onOrderStarted, onOrderProgress, onOrderCompleted, httpError, OPEN_NOTE_STATUSES, ACTIONS,
};
