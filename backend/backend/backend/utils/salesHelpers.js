const mongoose = require("mongoose");

/** Shared bits for the sales routes (customers, quotes, invoices). */

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));
const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });
const VAT_RATES = [0, 7, 10, 14, 20];

/**
 * Cleans devis/invoice lines. Returns { lines } or { error }.
 * A line's product (if any) must be an article of the same company.
 */
async function normalizeSalesLines(input, companyId) {
  if (!Array.isArray(input) || input.length === 0) return { error: "Add at least one line" };
  const Product = require("../models/Product");
  const lines = [];
  for (const [i, raw] of input.entries()) {
    const n = i + 1;
    const description = String(raw?.description || "").trim();
    const quantity = Number(raw?.quantity);
    const unitPrice = Number(raw?.unitPrice);
    const discount = raw?.discount === undefined || raw?.discount === "" ? 0 : Number(raw.discount);
    const vatRate = raw?.vatRate === undefined || raw?.vatRate === "" ? 20 : Number(raw.vatRate);
    if (!description) return { error: `Line ${n}: enter a description` };
    if (!(quantity > 0)) return { error: `Line ${n}: the quantity must be positive` };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: `Line ${n}: invalid unit price` };
    if (!(discount >= 0 && discount <= 100)) return { error: `Line ${n}: the discount must be between 0 and 100%` };
    if (!VAT_RATES.includes(vatRate)) return { error: `Line ${n}: VAT must be one of ${VAT_RATES.join(", ")}%` };
    let product = null;
    if (raw?.product) {
      if (!isId(raw.product) || !(await Product.exists({ _id: raw.product, company: companyId }))) {
        return { error: `Line ${n}: article not found in this company` };
      }
      product = raw.product;
    }
    let chassis;
    if (raw?.chassis && raw.chassis.model) {
      const ChassisModel = require("../models/ChassisModel");
      const Finish = require("../models/Finish");
      const c = raw.chassis;
      if (!isId(c.model) || !(await ChassisModel.exists({ _id: c.model, company: companyId }))) return { error: `Line ${n}: chassis model not found` };
      const L = Number(c.L);
      const H = Number(c.H);
      if (!(L > 0 && H > 0)) return { error: `Line ${n}: enter the chassis width and height` };
      if (c.finish && (!isId(c.finish) || !(await Finish.exists({ _id: c.finish, company: companyId })))) return { error: `Line ${n}: colour not found` };
      const params = {};
      for (const [k, v] of Object.entries(c.params && typeof c.params === "object" ? c.params : {})) {
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,30}$/.test(k)) continue;
        params[k] = typeof v === "string" && isId(v) ? v : Number(v) || 0;
      }
      chassis = { model: c.model, ref: String(c.ref || "").trim().slice(0, 30), L, H, finish: c.finish || null, params };
    }
    lines.push({ product, description, quantity, unit: String(raw?.unit || "").trim().slice(0, 30), unitPrice, discount, vatRate, ...(chassis ? { chassis } : {}) });
  }
  return { lines };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + (Number(days) || 0));
  return d;
}

function validationMessage(error, fallback) {
  if (error?.name === "ValidationError") return Object.values(error.errors)[0].message;
  return error?.message || fallback;
}

module.exports = { isId, bad, VAT_RATES, normalizeSalesLines, addDays, validationMessage };
