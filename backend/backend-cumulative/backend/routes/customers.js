const express = require("express");
const Customer = require("../models/Customer");
const Quote = require("../models/Quote");
const SalesInvoice = require("../models/SalesInvoice");
const Company = require("../models/Company");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireSalesAccess } = require("../middleware/permissionMiddleware");
const { isId, bad, validationMessage } = require("../utils/salesHelpers");
const { amountDue, round2 } = require("../services/salesCalc");
const { logAudit } = require("../services/auditLogger");

/**
 * CUSTOMERS (clients) — /api/customers
 *   GET  /?companyId=&search=&active=   list (with what each owes)
 *   GET  /:id                           file + devis/invoices summary
 *   POST /  · PUT /:id  · DELETE /:id (only if no devis/invoice, else deactivate)
 */
const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.customers));
router.use(auth, requireSalesAccess);

const FIELDS = ["name", "kind", "ice", "identifiantFiscal", "rc", "email", "phone", "address", "city", "paymentDays", "notes", "isActive"];
function pick(body) {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (Array.isArray(body.contacts)) {
    out.contacts = body.contacts
      .filter((c) => c && (c.name || c.phone || c.email))
      .map((c) => ({ name: c.name, role: c.role, phone: c.phone, email: c.email }));
  }
  return out;
}

router.get("/", async (req, res) => {
  try {
    const { companyId, search, active } = req.query;
    if (!isId(companyId)) return bad(res, "A valid companyId is required");
    const filter = { company: companyId };
    if (active === "true") filter.isActive = true;
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { ice: rx }, { city: rx }, { email: rx }];
    }
    const customers = await Customer.find(filter).sort({ name: 1 }).lean();
    const invoices = await SalesInvoice.find({ company: companyId, status: { $in: ["issued", "partially_paid"] }, type: { $ne: "credit_note" } })
      .select("customer status type totalTTC amountPaid dueDate").lean();
    const now = new Date();
    const due = new Map();
    for (const inv of invoices) {
      const k = String(inv.customer);
      const cur = due.get(k) || { due: 0, overdue: 0 };
      const d = amountDue(inv);
      cur.due = round2(cur.due + d);
      if (inv.dueDate && new Date(inv.dueDate) < now) cur.overdue = round2(cur.overdue + d);
      due.set(k, cur);
    }
    res.json({ success: true, data: customers.map((c) => ({ ...c, ...(due.get(String(c._id)) || { due: 0, overdue: 0 }) })) });
  } catch (error) {
    console.error("GET customers error:", error);
    res.status(500).json({ success: false, message: "Error loading customers", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid customer ID");
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return bad(res, "Customer not found", 404);
    const [quotes, invoices] = await Promise.all([
      Quote.find({ customer: customer._id }).select("number date status totalTTC subject").sort({ date: -1 }).limit(50).lean(),
      SalesInvoice.find({ customer: customer._id, status: { $ne: "cancelled" } })
        .select("number type date dueDate status totalTTC amountPaid").sort({ date: -1 }).limit(100).lean(),
    ]);
    const due = round2(invoices.reduce((s, i) => s + amountDue(i), 0));
    const invoiced = round2(invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + (i.type === "credit_note" ? -1 : 1) * i.totalTTC, 0));
    res.json({ success: true, data: { ...customer, quotes, invoices, stats: { due, invoiced } } });
  } catch (error) {
    console.error("GET customer error:", error);
    res.status(500).json({ success: false, message: "Error loading the customer", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { company } = req.body;
    if (!isId(company) || !(await Company.exists({ _id: company }))) return bad(res, "A valid company is required");
    const customer = await Customer.create({ ...pick(req.body), company, createdBy: req.user.id, updatedBy: req.user.id });
    await logAudit(req, { company, action: "create", resourceType: "Customer", resourceId: customer._id, resourceLabel: customer.name });
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: validationMessage(error, "Error creating the customer") });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid customer ID");
    const customer = await Customer.findById(req.params.id);
    if (!customer) return bad(res, "Customer not found", 404);
    Object.assign(customer, pick(req.body), { updatedBy: req.user.id });
    await customer.save();
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: validationMessage(error, "Error updating the customer") });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid customer ID");
    const customer = await Customer.findById(req.params.id);
    if (!customer) return bad(res, "Customer not found", 404);
    const used = (await Quote.exists({ customer: customer._id })) || (await SalesInvoice.exists({ customer: customer._id }));
    if (used) {
      customer.isActive = false;
      customer.updatedBy = req.user.id;
      await customer.save();
      return res.json({ success: true, deactivated: true, message: "This customer has devis or invoices: deactivated instead of deleted" });
    }
    await customer.deleteOne();
    await logAudit(req, { company: customer.company, action: "delete", resourceType: "Customer", resourceId: customer._id, resourceLabel: customer.name });
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE customer error:", error);
    res.status(500).json({ success: false, message: "Error deleting the customer", error: error.message });
  }
});

module.exports = router;
