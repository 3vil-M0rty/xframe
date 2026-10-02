/**
 * Collects what the cutting report needs (services/cuttingReport.js) for
 * a project — from its work orders when manufacturing has been started,
 * otherwise from the live plan — or for a single work order.
 */
const ProductionOrder = require("../models/ProductionOrder");
const Product = require("../models/Product");
const { loadContext, computeProjectPlan, ensureProductionDefaults } = require("./productionPlanning");
const { buildCuttingReport } = require("./cuttingReport");
const { missingGlass } = require("./glassCheck");

const PRODUCT_FIELDS = "name internalReference stockMode barLength profileDepth profileChamber profileOuterFin profileInnerFin profileHeight profileWidth sheetWidth sheetHeight quantity materialType unit";
const OVERRIDE_KEYS = ["kerf", "trim", "endTrim", "spacing", "minReusableOffcut", "nest", "edgeTrim", "gap", "allowRotation"];

function overridesFrom(query = {}) {
  const out = {};
  for (const k of OVERRIDE_KEYS) {
    const v = query[k];
    if (v === undefined || v === null || v === "") continue;
    if (k === "allowRotation" || k === "nest") out[k] = !(v === false || v === "false" || v === "0");
    else if (Number.isFinite(Number(v)) && Number(v) >= 0) out[k] = Number(v);
  }
  return out;
}

async function attachCandidateNames(needs) {
  const ids = [...new Set(needs.flatMap((n) => n.candidates || []).map(String))].filter((id) => /^[a-f0-9]{24}$/i.test(id));
  if (!ids.length) return;
  const rows = await Product.find({ _id: { $in: ids } }).select("name sheetWidth sheetHeight quantity").lean();
  const byId = new Map(rows.map((p) => [String(p._id), p]));
  for (const n of needs) n.candidateNames = (n.candidates || []).map((id) => byId.get(String(id))).filter(Boolean).map((p) => `${p.name}${p.sheetWidth ? ` (${p.sheetWidth}×${p.sheetHeight}, stock ${p.quantity ?? 0})` : ""}`);
}

function fromOrders(orders) {
  const needs = [];
  const outputs = [];
  const panes = [];
  for (const o of orders) {
    const kind = o.workshop?.kind || o.kind;
    for (const n of o.needs || []) needs.push({ ...n, workshopName: o.workshop?.name || "", workshopKind: kind, orderNumber: o.number });
    for (const x of o.outputs || []) outputs.push({ ...x, orderNumber: o.number });
    if (kind === "vitrage") for (const i of o.items || []) panes.push({ ...i, orderNumber: o.number });
  }
  return { needs, outputs, panes };
}

function populateOrders(query) {
  return query
    .populate("workshop", "code name kind color")
    .populate("needs.product", PRODUCT_FIELDS)
    .populate("needs.finish", "code name color")
    .populate("outputs.product", "name internalReference")
    .populate("outputs.finish", "code name color")
    .lean();
}

async function projectCutting(project, query = {}) {
  const overrides = overridesFrom(query);
  const orders = await populateOrders(ProductionOrder.find({ project: project._id, status: { $ne: "cancelled" } }).sort({ createdAt: 1 }));
  let data;
  let settings;
  let source;
  if (orders.length) {
    settings = (await ensureProductionDefaults(project.company)).toObject();
    data = fromOrders(orders);
    source = "orders";
  } else {
    const ctx = await loadContext(project.company);
    settings = ctx.settings;
    const plan = await computeProjectPlan(project, ctx);
    data = { needs: [], outputs: [], panes: [] };
    for (const w of plan.workshops) {
      for (const n of w.needs) {
        data.needs.push({
          ...n,
          product: n.product ? ctx.products.get(String(n.product)) || null : null,
          finish: n.finish ? ctx.finishes.get(String(n.finish)) || null : null,
          workshopName: w.workshop.name, workshopKind: w.workshop.kind,
        });
      }
      for (const o of w.outputs || []) data.outputs.push({ ...o, product: ctx.products.get(String(o.product)) || null, finish: ctx.finishes.get(String(o.finish)) || null });
      if (w.workshop.kind === "vitrage") data.panes.push(...w.items);
    }
    source = "plan";
  }
  await attachCandidateNames(data.needs);
  const report = buildCuttingReport(data.needs, { settings, overrides, outputs: data.outputs, panes: data.panes });
  const glassCtx = await loadContext(project.company);
  return { source, report, missingGlass: missingGlass(project, glassCtx), orders: orders.map((o) => ({ _id: o._id, number: o.number, status: o.status, workshop: o.workshop })) };
}

async function orderCutting(orderId, query = {}) {
  const overrides = overridesFrom(query);
  const order = await populateOrders(ProductionOrder.findById(orderId));
  const settings = (await ensureProductionDefaults(order.company)).toObject();
  const data = fromOrders([order]);
  await attachCandidateNames(data.needs);
  return { source: "order", order, report: buildCuttingReport(data.needs, { settings, overrides, outputs: data.outputs, panes: data.panes }) };
}

module.exports = { projectCutting, orderCutting, overridesFrom };
