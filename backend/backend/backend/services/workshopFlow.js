/**
 * ============================================================
 * WORKSHOP FLOW — who hands what to whom, on the platform
 * ============================================================
 *   A  chargé des barres      issues the exact bars (+ offcuts) of a
 *                             project: raw bars → Laquage ; bars already
 *                             in the right colour → Aluminium directly ;
 *                             lacquered bars / offcuts can be sent to
 *                             Laquage again (re-lacquering)
 *   B  Laquage                receives them (the order starts), finishes:
 *                             "how many kg of powder" — the lacquered
 *                             bars go back to Aluminium automatically
 *   C  Aluminium              receives the lacquered bars, launches,
 *                             declares the chassis made WITHOUT glass,
 *                             receives the glass units from Vitrage,
 *                             finishes (glazed)
 *      Vitrage                can be launched at any time; when it is
 *                             finished the glass units go to Aluminium
 *      Magasinier             issues accessories, gaskets, glass sheets…
 *   Any step can be sub-contracted (a draft purchase order to a supplier).
 *
 * Stock: what is issued from stock goes out when it is SENT (booked on
 * the receiving order — cost on the project, or on the lacquered bars for
 * Laquage). Offcuts (models/Offcut) are tracked apart from the bar stock.
 * ============================================================
 */
const Product = require("../models/Product");
const ProductionOrder = require("../models/ProductionOrder");
const Transfer = require("../models/Transfer");
const Offcut = require("../models/Offcut");
const PurchaseOrder = require("../models/PurchaseOrder");
const Supplier = require("../models/Supplier");
const { createWithNumber } = require("./documentNumberService");
const { bookConsumption, completeOrder, ensureProductionDefaults, httpError } = require("./productionPlanning");
const { stockUnitLabel, round } = require("./chassisBom");
const tracking = require("./trackingService");

const ACTIVE = ["draft", "planned", "in_progress"];
const isProfile = (n) => n.kind === "profile" || n.materialType === "profile" || n.product?.materialType === "profile";
const isPowder = (n) => n.kind === "powder" || n.materialType === "powder";

// ------------------------------------------------------------------
// What is left to issue, per project
// ------------------------------------------------------------------
/**
 * Returns the project's orders, transfers and the lines the two
 * "issue" screens propose:
 *   bars         raw bars to Laquage + bars to issue straight to the
 *                other workshops (not covered by Laquage)
 *   accessories  everything else but powder (accessories, gaskets,
 *                consumables, panels, glass sheets…)
 */
async function projectFlow(projectId) {
  const orders = await ProductionOrder.find({ project: projectId, status: { $ne: "cancelled" } })
    .populate("workshop", "code name kind color manager members")
    .populate("needs.product", "name internalReference quantity unit stockMode materialType barLength baseProduct finish")
    .populate("needs.finish", "code name color")
    .populate("outputs.product", "name internalReference")
    .populate("outputs.variant", "name internalReference quantity")
    .populate("outputs.finish", "code name color")
    .populate("subcontract.supplier", "name")
    .populate("subcontract.purchaseOrder", "number status")
    .sort({ createdAt: 1 })
    .lean();
  const transfers = await Transfer.find({ project: projectId })
    .populate("toWorkshop", "code name color")
    .populate("fromWorkshop", "code name color")
    .populate("sentBy", "firstName lastName email")
    .populate("receivedBy", "firstName lastName email")
    .sort({ createdAt: 1 })
    .lean();

  const sentFor = (orderId, needId, fromStockOnly) => transfers
    .filter((t) => String(t.toOrder) === String(orderId) && (!fromStockOnly || !t.fromOrder))
    .reduce((s, t) => s + t.lines.filter((l) => String(l.need) === String(needId)).reduce((a, l) => a + (l.quantity || 0), 0), 0);

  // Bars each lacquered colour variant will get from Laquage (still to come or delivered).
  const fromLaquage = new Map();
  for (const o of orders.filter((x) => x.kind === "laquage")) {
    for (const out of o.outputs || []) {
      const key = String(out.variant?._id || out.variant || "");
      if (key) fromLaquage.set(key, (fromLaquage.get(key) || 0) + (o.status === "done" ? out.produced || 0 : out.quantity || 0));
    }
  }

  const bars = [];
  const accessories = [];
  for (const o of orders) {
    if (!ACTIVE.includes(o.status) || o.subcontract?.purchaseOrder) continue;
    for (const n of o.needs || []) {
      if (!n.product || isPowder(n)) continue;
      const product = n.product;
      const base = {
        order: String(o._id), orderNumber: o.number, workshop: o.workshop?.name || "", workshopKind: o.kind, workshopColor: o.workshop?.color,
        need: String(n._id), product: String(product._id), name: product.name, ref: product.internalReference || "",
        finish: n.finish ? { code: n.finish.code, name: n.finish.name, color: n.finish.color } : null,
        unit: n.unit || stockUnitLabel(product), stock: product.quantity || 0, barLength: product.barLength || null,
      };
      if (o.kind === "laquage" ? true : isProfile(n)) {
        // Laquage: the raw bars to lacquer. Others: what Laquage won't bring.
        const planned = n.theoretical || 0;
        const comingFromLaq = o.kind === "laquage" ? 0 : Math.min(planned, fromLaquage.get(String(product._id)) || 0);
        const direct = round(Math.max(0, planned - comingFromLaq), 3);
        const issued = round(sentFor(o._id, n._id, true), 3);
        bars.push({ ...base, planned, comingFromLaq: round(comingFromLaq, 3), direct, issued, toIssue: round(Math.max(0, direct - issued), 3), destination: o.kind === "laquage" ? "laquage" : "workshop" });
      } else {
        const issued = round(sentFor(o._id, n._id, true), 3);
        const planned = n.theoretical || 0;
        accessories.push({ ...base, kind: n.kind, materialType: n.materialType || product.materialType || "", planned, issued, toIssue: round(Math.max(0, planned - issued), 3) });
      }
    }
  }

  const steps = orders.map((o) => ({
    _id: o._id, number: o.number, kind: o.kind, status: o.status, workshop: o.workshop,
    dependsOn: o.dependsOn, startedAt: o.startedAt, completedAt: o.completedAt,
    materialsReceivedAt: o.materialsReceivedAt, framesDoneAt: o.framesDoneAt, glassReceivedAt: o.glassReceivedAt,
    subcontract: o.subcontract?.purchaseOrder ? o.subcontract : null,
    outputs: o.outputs, powder: (o.needs || []).filter(isPowder).map((n) => ({ _id: n._id, label: n.label, product: n.product?.name || null, theoretical: n.theoretical, consumed: n.consumed })),
    items: (o.items || []).map((i) => ({ _id: i._id, ref: i.ref, label: i.label, L: i.L, H: i.H, quantity: i.quantity, done: i.done })),
    pendingIn: transfers.filter((t) => String(t.toOrder) === String(o._id) && t.status === "sent").length,
  }));

  return { orders: steps, transfers, bars, accessories };
}

// ------------------------------------------------------------------
// Issue from stock (A: bars / magasinier: accessories)
// ------------------------------------------------------------------
/**
 * lines = [{ order, need?, product?, quantity, offcuts: [{ offcut?, length, quantity }] }]
 * One transfer per receiving order. Offcuts are taken out of the offcut stock.
 */
async function issue(project, { category = "bars", lines = [], note = "" }, actorId, canWork) {
  const byOrder = new Map();
  for (const l of lines) {
    const q = Math.max(0, Number(l.quantity) || 0);
    const offcuts = (Array.isArray(l.offcuts) ? l.offcuts : []).map((x) => ({ offcut: x.offcut || null, length: Number(x.length) || 0, quantity: Math.round(Number(x.quantity) || 0) })).filter((x) => x.length > 0 && x.quantity > 0);
    if (!q && !offcuts.length) continue;
    if (!byOrder.has(String(l.order))) byOrder.set(String(l.order), []);
    byOrder.get(String(l.order)).push({ ...l, quantity: q, offcuts });
  }
  if (!byOrder.size) throw httpError("Indiquez au moins une quantité à sortir");

  // Check everything first, so nothing is half-issued.
  const orders = new Map();
  const needStock = new Map();
  for (const [orderId, ls] of byOrder) {
    const order = await ProductionOrder.findOne({ _id: orderId, project: project._id });
    if (!order) throw httpError("Ordre de fabrication introuvable pour ce projet");
    if (!ACTIVE.includes(order.status)) throw httpError(`${order.number} est terminé ou annulé`);
    if (canWork && !canWork(order)) throw httpError(`Vous ne pouvez pas sortir pour ${order.number}`, 403);
    orders.set(orderId, order);
    for (const l of ls) {
      const need = l.need ? order.needs.id(l.need) : null;
      const productId = String(need?.product || l.product || "");
      if (!productId) throw httpError("Article manquant");
      if (l.quantity > 0) needStock.set(productId, (needStock.get(productId) || 0) + l.quantity);
      for (const x of l.offcuts) {
        if (!x.offcut) continue;
        const off = await Offcut.findOne({ _id: x.offcut, company: project.company }).lean();
        if (!off || off.quantity < x.quantity) throw httpError(`Chute de ${x.length} mm : plus assez en stock`);
      }
    }
  }
  for (const [productId, qty] of needStock) {
    const p = await Product.findById(productId).select("name quantity").lean();
    if (!p) throw httpError("Article introuvable");
    if ((p.quantity || 0) + 1e-9 < qty) throw httpError(`Stock insuffisant pour « ${p.name} » : ${p.quantity || 0} en stock, ${qty} demandé(s)`, 409);
  }

  const created = [];
  for (const [orderId, ls] of byOrder) {
    const order = orders.get(orderId);
    const tLines = [];
    for (const l of ls) {
      let need = l.need ? order.needs.id(l.need) : null;
      if (!need) {
        // Not planned on this order (e.g. lacquered bars sent to be re-lacquered): an extra line.
        const p = await Product.findOne({ _id: l.product, company: order.company }).lean();
        if (!p) throw httpError("Article introuvable");
        need = order.needs.find((n) => n.extra && String(n.product) === String(p._id));
        if (!need) {
          order.needs.push({ product: p._id, baseProduct: p.baseProduct || p._id, kind: p.materialType || "other", materialType: p.materialType || "", label: p.name, measure: "count", theoretical: 0, consumed: 0, unit: stockUnitLabel(p), extra: true });
          need = order.needs[order.needs.length - 1];
        }
      }
      if (l.quantity > 0) await bookConsumption(order, need, l.quantity, actorId, `sortie ${category === "bars" ? "barres" : "magasin"}`);
      for (const x of l.offcuts) {
        if (x.offcut) await Offcut.updateOne({ _id: x.offcut }, { $inc: { quantity: -x.quantity } });
      }
      const product = await Product.findById(need.product).select("name").lean();
      tLines.push({ need: need._id, product: need.product, label: product?.name || need.label, unit: need.unit, quantity: l.quantity, offcuts: l.offcuts });
    }
    order.updatedBy = actorId;
    await order.save();
    created.push(await createWithNumber(Transfer, {
      company: order.company, project: project._id, category, fromOrder: null, fromWorkshop: null,
      toOrder: order._id, toWorkshop: order.workshop, lines: tLines, status: "sent", note: String(note || "").slice(0, 500), sentBy: actorId,
    }, "BT"));
  }
  await Offcut.deleteMany({ company: project.company, quantity: { $lte: 0 } });
  return created;
}

// ------------------------------------------------------------------
// Reception (B, C…)
// ------------------------------------------------------------------
async function receive(transfer, { lines = [], note = "" }, actorId) {
  if (transfer.status === "received") throw httpError("Ce bon est déjà réceptionné");
  const byId = new Map((lines || []).map((l) => [String(l.line), l]));
  for (const l of transfer.lines) {
    const r = byId.get(String(l._id));
    l.receivedQty = r && r.receivedQty !== undefined && r.receivedQty !== "" ? Math.max(0, Number(r.receivedQty) || 0) : l.quantity;
  }
  transfer.status = "received";
  transfer.receivedBy = actorId;
  transfer.receivedAt = new Date();
  transfer.receptionNote = String(note || "").slice(0, 500);
  await transfer.save();

  const order = await ProductionOrder.findById(transfer.toOrder);
  if (order) {
    order.materialsReceivedAt = new Date();
    if (transfer.category === "glass") order.glassReceivedAt = new Date();
    const missing = transfer.lines.filter((l) => (l.receivedQty ?? l.quantity) < l.quantity);
    order.history.push({ status: order.status, note: `${transfer.number} réceptionné${missing.length ? ` (écart sur ${missing.length} ligne(s))` : ""}${transfer.receptionNote ? ` — ${transfer.receptionNote}` : ""}`, by: actorId });
    // Laquage starts as soon as its bars are received.
    if (order.kind === "laquage" && ["planned", "draft"].includes(order.status)) {
      order.status = "in_progress";
      order.startedAt = order.startedAt || new Date();
      order.history.push({ status: "in_progress", note: "Barres réceptionnées", by: actorId });
    }
    order.updatedBy = actorId;
    await order.save();
  }
  return { transfer, order };
}

// ------------------------------------------------------------------
// Laquage done: kg of powder, lacquered bars back to Aluminium
// ------------------------------------------------------------------
async function finishLaquage(order, { powderKg, powder = [], outputs, note = "" }, actorId) {
  if (order.kind !== "laquage") throw httpError("Ce n'est pas un ordre de laquage");
  if (!ACTIVE.includes(order.status)) throw httpError("Cet ordre est déjà terminé ou annulé");
  // Powder: just the kg really used (one number per colour; one field when there is one).
  const powderNeeds = order.needs.filter((n) => n.kind === "powder" || n.materialType === "powder");
  const kgFor = new Map((powder || []).map((p) => [String(p.need), Number(p.kg)]));
  if (powderKg !== undefined && powderKg !== null && powderKg !== "" && powderNeeds.length === 1) kgFor.set(String(powderNeeds[0]._id), Number(powderKg));
  for (const n of powderNeeds) {
    if (!kgFor.has(String(n._id))) continue;
    const kg = kgFor.get(String(n._id));
    if (!(kg >= 0)) throw httpError("Quantité de poudre invalide");
    const delta = round(kg - (n.consumed || 0), 4);
    if (Math.abs(delta) > 1e-9) {
      if (!n.product) throw httpError(`Aucun article poudre pour « ${n.label} » (Production → Configuration → Couleurs)`);
      await bookConsumption(order, n, delta, actorId, "poudre consommée");
    }
  }
  const settings = await ensureProductionDefaults(order.company);
  // Bars already went out of stock when they were issued: nothing more is booked at closing.
  await completeOrder(order, { consumeRemaining: false, outputs, note }, actorId, settings);

  // Lacquered bars → the Aluminium order of the project (sent, to be received there).
  let transfer = null;
  if (order.project && !order.customerMaterial) {
    const target = await ProductionOrder.findOne({ project: order.project, kind: "aluminium", status: { $in: ACTIVE } }).sort({ createdAt: 1 });
    if (target) {
      const incoming = await Transfer.find({ toOrder: order._id }).lean();
      const offcutsIn = incoming.flatMap((t) => t.lines.flatMap((l) => (l.offcuts || []).map((x) => ({ ...x, base: String(l.product) }))));
      const lines = [];
      for (const o of order.outputs) {
        if (!(o.produced > 0) || !o.variant) continue;
        let need = target.needs.find((n) => String(n.product) === String(o.variant));
        if (!need) {
          const v = await Product.findById(o.variant).lean();
          target.needs.push({ product: v._id, baseProduct: v.baseProduct || v._id, kind: "profile", materialType: "profile", label: v.name, measure: "count", theoretical: 0, consumed: 0, unit: stockUnitLabel(v), extra: true });
          need = target.needs[target.needs.length - 1];
        }
        await bookConsumption(target, need, o.produced, actorId, `barres laquées ${order.number}`);
        const v = await Product.findById(o.variant).select("name").lean();
        lines.push({
          need: need._id, product: o.variant, label: v?.name || "", unit: need.unit, quantity: o.produced,
          offcuts: offcutsIn.filter((x) => x.base === String(o.product)).map(({ base, ...x }) => x),
        });
      }
      if (lines.length) {
        target.updatedBy = actorId;
        await target.save();
        transfer = await createWithNumber(Transfer, {
          company: order.company, project: order.project, category: "lacquered", fromOrder: order._id, fromWorkshop: order.workshop,
          toOrder: target._id, toWorkshop: target.workshop, lines, status: "sent", sentBy: actorId,
          note: `Barres laquées — ${order.number}`,
        }, "BT");
      }
    }
  }
  return { order, transfer };
}

// ------------------------------------------------------------------
// Vitrage done: glass units to Aluminium
// ------------------------------------------------------------------
async function finishVitrage(order, { note = "", consumeRemaining } = {}, actorId) {
  if (order.kind !== "vitrage") throw httpError("Ce n'est pas un ordre de vitrage");
  if (!ACTIVE.includes(order.status)) throw httpError("Cet ordre est déjà terminé ou annulé");
  const settings = await ensureProductionDefaults(order.company);
  await completeOrder(order, { consumeRemaining: consumeRemaining ?? settings.consumeOnComplete, note, force: true }, actorId, settings);
  let transfer = null;
  if (order.project) {
    const target = await ProductionOrder.findOne({ project: order.project, kind: "aluminium", status: { $ne: "cancelled" } }).sort({ createdAt: 1 });
    if (target) {
      transfer = await createWithNumber(Transfer, {
        company: order.company, project: order.project, category: "glass", fromOrder: order._id, fromWorkshop: order.workshop,
        toOrder: target._id, toWorkshop: target.workshop,
        lines: order.items.map((i) => ({ label: i.label, ref: i.ref, L: i.L, H: i.H, quantity: i.done || i.quantity, unit: "u" })),
        status: "sent", sentBy: actorId, note: `Vitrages — ${order.number}`,
      }, "BT");
    }
  }
  return { order, transfer };
}

// ------------------------------------------------------------------
// Aluminium: chassis made, waiting for their glass
// ------------------------------------------------------------------
async function framesDone(order, actorId) {
  if (order.kind !== "aluminium") throw httpError("Ce n'est pas un ordre aluminium");
  if (!ACTIVE.includes(order.status)) throw httpError("Cet ordre est déjà terminé ou annulé");
  if (order.status !== "in_progress") {
    order.status = "in_progress";
    order.startedAt = order.startedAt || new Date();
  }
  order.framesDoneAt = new Date();
  order.history.push({ status: order.status, note: "Châssis fabriqués — en attente du vitrage", by: actorId });
  order.updatedBy = actorId;
  await order.save();
  await tracking.onOrderCompleted(order, actorId); // frames & sashes made, glass parts not yet
  return order;
}

// ------------------------------------------------------------------
// Sub-contracting: a draft purchase order for the step
// ------------------------------------------------------------------
async function subcontract(order, { supplier, note = "" }, actorId) {
  if (!ACTIVE.includes(order.status)) throw httpError("Cet ordre est déjà terminé ou annulé");
  if (order.subcontract?.purchaseOrder) throw httpError("Cette étape est déjà sous-traitée");
  const sup = await Supplier.findOne({ _id: supplier, company: order.company }).lean();
  if (!sup) throw httpError("Choisissez un fournisseur");
  const populated = await ProductionOrder.findById(order._id).populate("outputs.product", "name").populate("outputs.finish", "code name").lean();
  let lines;
  if (order.kind === "laquage") {
    lines = populated.outputs.map((o) => ({ product: null, description: `Laquage ${o.product?.name || ""} — ${o.finish?.code || ""}${o.finish?.name ? ` ${o.finish.name}` : ""}`.slice(0, 300), quantity: Math.max(0.001, o.quantity), unit: "barre", unitPrice: 0, vatRate: 20 }));
  } else {
    lines = populated.items.map((i) => ({ product: null, description: `${order.kind === "vitrage" ? "Vitrage " : ""}${i.label || ""}${i.L && i.H ? ` — ${Math.round(i.L)} × ${Math.round(i.H)} mm` : ""}`.slice(0, 300), quantity: Math.max(0.001, i.quantity), unit: "u", unitPrice: 0, vatRate: 20 }));
  }
  if (!lines.length) throw httpError("Rien à sous-traiter sur cet ordre");
  const po = await createWithNumber(PurchaseOrder, {
    company: order.company, supplier: sup._id, project: order.project || null, date: new Date(), lines, status: "draft",
    notes: `Sous-traitance de ${order.number}${note ? ` — ${note}` : ""}. Prix à compléter.`.slice(0, 1000),
    createdBy: actorId, updatedBy: actorId,
  }, "BC");
  order.subcontract = { supplier: sup._id, purchaseOrder: po._id, note: String(note || "").slice(0, 300), at: new Date(), by: actorId };
  order.history.push({ status: order.status, note: `Sous-traité à ${sup.name} (${po.number})`, by: actorId });
  await order.save();
  return { order, purchaseOrder: po };
}

async function cancelSubcontract(order, actorId) {
  if (!order.subcontract?.purchaseOrder) throw httpError("Cette étape n'est pas sous-traitée");
  const po = await PurchaseOrder.findById(order.subcontract.purchaseOrder);
  if (po && po.status === "draft") { po.status = "cancelled"; await po.save(); }
  order.history.push({ status: order.status, note: `Sous-traitance annulée${po ? ` (${po.number})` : ""}`, by: actorId });
  order.subcontract = { supplier: null, purchaseOrder: null, note: "", at: null, by: null };
  await order.save();
  return order;
}

module.exports = { projectFlow, issue, receive, finishLaquage, finishVitrage, framesDone, subcontract, cancelSubcontract };
