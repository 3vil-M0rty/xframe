const express = require("express");
const notifications = require("../services/businessNotifications");
const Quote = require("../models/Quote");
const Customer = require("../models/Customer");
const Company = require("../models/Company");
const Project = require("../models/Project");
const SalesInvoice = require("../models/SalesInvoice");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { has: hasPerm } = require("../services/permissionService");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireSalesAccess } = require("../middleware/permissionMiddleware");
const { isId, bad, normalizeSalesLines, addDays, validationMessage } = require("../utils/salesHelpers");
const { createWithNumber } = require("../services/documentNumberService");
const { depositLines, sumDeposits } = require("../services/salesCalc");
const { generateQuotePdf } = require("../services/salesPdfService");
const { chassisLinesInfo, fetchChassisImages } = require("../services/chassisLineInfo");
const { fetchLogoBuffer } = require("../services/pdfHelpers");
const { sendMail, pdfToBuffer, isEmail } = require("../services/mailService");
const { logAudit } = require("../services/auditLogger");

/**
 * ============================================================
 * DEVIS — /api/quotes
 * ============================================================
 * GET    /?companyId=&status=&customer=&search=&page=
 * GET    /:id
 * POST   /                     { company, customer, date, validUntil, subject, lines, paymentTerms, notes }
 * PUT    /:id                  draft or sent only
 * DELETE /:id                  draft only
 * POST   /:id/duplicate        new draft (e.g. a revised version)
 * PATCH  /:id/status           { status: sent|accepted|refused|cancelled, reason }
 * GET    /:id/pdf
 * POST   /:id/email            { to, cc, message } — PDF attached; a draft becomes "sent"
 * POST   /:id/project          accepted devis → project (budget revenue = devis HT)
 * POST   /:id/deposit          { percent, date } → draft deposit invoice (facture d'acompte)
 * POST   /:id/invoice          → draft final invoice, issued deposits deducted
 * ============================================================
 */
const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.quotes));
router.use(auth, requireSalesAccess);

const DETAIL_POPULATE = [
  { path: "customer" },
  { path: "project", select: "number name status" },
  { path: "lines.product", select: "name internalReference unit sellingPrice" },
  { path: "createdBy", select: "firstName lastName" },
];

async function expireOld(companyId) {
  await Quote.updateMany(
    { company: companyId, status: "sent", validUntil: { $ne: null, $lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
    { $set: { status: "expired" } }
  );
}

router.get("/", async (req, res) => {
  try {
    const { companyId, status, customer, search } = req.query;
    if (!isId(companyId)) return bad(res, "A valid companyId is required");
    await expireOld(companyId);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const filter = { company: companyId };
    if (status) filter.status = status;
    if (customer && isId(customer)) filter.customer = customer;
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const customers = await Customer.find({ company: companyId, name: rx }).select("_id").lean();
      filter.$or = [{ number: rx }, { subject: rx }, { customer: { $in: customers.map((c) => c._id) } }];
    }
    const [quotes, total] = await Promise.all([
      Quote.find(filter).populate("customer", "name").populate("project", "number").sort({ date: -1, number: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Quote.countDocuments(filter),
    ]);
    res.json({ success: true, data: quotes, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    console.error("GET quotes error:", error);
    res.status(500).json({ success: false, message: "Error loading devis", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id).populate(DETAIL_POPULATE);
    if (!quote) return bad(res, "Devis not found", 404);
    const invoices = await SalesInvoice.find({ quote: quote._id, status: { $ne: "cancelled" } })
      .select("number type status date totalHT totalTTC amountPaid").sort({ createdAt: 1 }).lean();
    const chassisInfo = await chassisLinesInfo(quote.company, quote.lines);
    res.json({ success: true, data: { ...quote.toObject(), invoices, chassisInfo } });
  } catch (error) {
    console.error("GET quote error:", error);
    res.status(500).json({ success: false, message: "Error loading the devis", error: error.message });
  }
});

async function customerOf(companyId, customerId) {
  if (!isId(customerId)) return null;
  return Customer.findOne({ _id: customerId, company: companyId });
}

router.post("/", async (req, res) => {
  try {
    const { company } = req.body;
    if (!isId(company) || !(await Company.exists({ _id: company }))) return bad(res, "A valid company is required");
    const customer = await customerOf(company, req.body.customer);
    if (!customer) return bad(res, "Choose a customer");
    const { lines, error } = await normalizeSalesLines(req.body.lines, company);
    if (error) return bad(res, error);
    const date = req.body.date ? new Date(req.body.date) : new Date();
    const quote = await createWithNumber(Quote, {
      company,
      customer: customer._id,
      date,
      validUntil: req.body.validUntil ? new Date(req.body.validUntil) : addDays(date, 30),
      subject: req.body.subject,
      lines,
      paymentTerms: req.body.paymentTerms,
      notes: req.body.notes,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }, "DV");
    await logAudit(req, { company, action: "create", resourceType: "Quote", resourceId: quote._id, resourceLabel: `${quote.number} — ${customer.name}` });
    res.status(201).json({ success: true, data: await Quote.findById(quote._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST quote error:", error);
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: validationMessage(error, "Error creating the devis") });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id);
    if (!quote) return bad(res, "Devis not found", 404);
    if (!["draft", "sent"].includes(quote.status)) return bad(res, "Only a draft or sent devis can be edited — duplicate it to make a new version");
    if (req.body.customer !== undefined) {
      const customer = await customerOf(quote.company, req.body.customer);
      if (!customer) return bad(res, "Choose a customer");
      quote.customer = customer._id;
    }
    if (req.body.lines !== undefined) {
      const { lines, error } = await normalizeSalesLines(req.body.lines, quote.company);
      if (error) return bad(res, error);
      quote.lines = lines;
    }
    for (const f of ["subject", "paymentTerms", "notes"]) if (req.body[f] !== undefined) quote[f] = req.body[f];
    if (req.body.date !== undefined) quote.date = req.body.date;
    if (req.body.validUntil !== undefined) { quote.validUntil = req.body.validUntil || null; quote.expiryNotifiedAt = null; }
    quote.updatedBy = req.user.id;
    await quote.save();
    res.json({ success: true, data: await Quote.findById(quote._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("PUT quote error:", error);
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: validationMessage(error, "Error updating the devis") });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id);
    if (!quote) return bad(res, "Devis not found", 404);
    if (quote.status !== "draft") return bad(res, "Only a draft can be deleted — cancel the devis instead");
    await quote.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE quote error:", error);
    res.status(500).json({ success: false, message: "Error deleting the devis", error: error.message });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const src = await Quote.findById(req.params.id).lean();
    if (!src) return bad(res, "Devis not found", 404);
    const date = new Date();
    const copy = await createWithNumber(Quote, {
      company: src.company,
      customer: src.customer,
      date,
      validUntil: addDays(date, 30),
      subject: src.subject,
      lines: src.lines.map(({ _id, ...l }) => l),
      paymentTerms: src.paymentTerms,
      notes: src.notes,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }, "DV");
    res.status(201).json({ success: true, data: await Quote.findById(copy._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST duplicate quote error:", error);
    res.status(500).json({ success: false, message: "Error duplicating the devis", error: error.message });
  }
});

const TRANSITIONS = {
  sent: ["draft", "expired"],
  accepted: ["draft", "sent", "expired"],
  refused: ["draft", "sent", "expired"],
  cancelled: ["draft", "sent", "expired", "refused"],
  draft: ["refused", "cancelled", "expired"],
};

router.patch("/:id/status", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id);
    if (!quote) return bad(res, "Devis not found", 404);
    const next = req.body.status;
    if (!TRANSITIONS[next]) return bad(res, "Invalid status");
    // Sending vs deciding are two permissions (config/permissionCatalog.js).
    const needed = ["accepted", "refused"].includes(next) ? "sales.quotes.decide" : next === "sent" ? "sales.quotes.send" : "sales.quotes.edit";
    if (!hasPerm(req.user, needed)) return res.status(403).json({ success: false, message: "You don't have the permission for this action", permission: needed });
    if (!TRANSITIONS[next].includes(quote.status)) return bad(res, `A ${quote.status} devis can't become ${next}`);
    if (next === "cancelled" && (await SalesInvoice.exists({ quote: quote._id, status: { $nin: ["draft", "cancelled"] } }))) {
      return bad(res, "This devis has issued invoices: it can't be cancelled");
    }
    quote.status = next;
    if (next === "sent" && !quote.sentAt) quote.sentAt = new Date();
    if (["accepted", "refused"].includes(next)) quote.decidedAt = new Date();
    if (next === "refused") quote.refusalReason = String(req.body.reason || "").slice(0, 500);
    quote.updatedBy = req.user.id;
    await quote.save();
    await logAudit(req, { company: quote.company, action: "update", resourceType: "Quote", resourceId: quote._id, resourceLabel: `${quote.number} → ${next}` });
    if (["accepted", "refused"].includes(next)) await notifications.onQuoteDecided(quote, req.user.id);
    res.json({ success: true, data: await Quote.findById(quote._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("PATCH quote status error:", error);
    res.status(500).json({ success: false, message: "Error updating the devis", error: error.message });
  }
});

async function renderPdf(quote) {
  const company = await Company.findById(quote.company);
  const logoBuffer = await fetchLogoBuffer(company);
  const infos = await chassisLinesInfo(quote.company, quote.lines);
  const chassis = { chassis: infos, images: await fetchChassisImages(infos) };
  return { company, doc: generateQuotePdf({ quote, company, customer: quote.customer, logoBuffer, chassis }) };
}

router.get("/:id/pdf", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id).populate("customer");
    if (!quote) return bad(res, "Devis not found", 404);
    const { doc } = await renderPdf(quote);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${quote.number}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("GET quote pdf error:", error);
    res.status(500).json({ success: false, message: "Error generating the PDF", error: error.message });
  }
});

router.post("/:id/email", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id).populate("customer");
    if (!quote) return bad(res, "Devis not found", 404);
    if (["cancelled", "refused"].includes(quote.status)) return bad(res, "This devis is closed");
    const to = String(req.body?.to || "").trim();
    const cc = String(req.body?.cc || "").trim();
    if (!isEmail(to)) return bad(res, "Enter a valid recipient email");
    if (cc && !cc.split(",").every((x) => isEmail(x.trim()))) return bad(res, "Invalid CC email");
    // Sending it is what makes it "sent" — the PDF must not say BROUILLON.
    if (quote.status === "draft") {
      quote.status = "sent";
      quote.sentAt = new Date();
    }
    const { company, doc } = await renderPdf(quote);
    const pdf = await pdfToBuffer(doc);
    const subject = `Devis ${quote.number} — ${company.name}`;
    const text = String(req.body?.message || "").trim()
      || `Bonjour,\n\nVeuillez trouver ci-joint notre devis ${quote.number}${quote.subject ? ` (${quote.subject})` : ""}.\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${company.name}`;
    const result = await sendMail(
      { to, cc, subject, text, attachments: [{ filename: `${quote.number}.pdf`, content: pdf, contentType: "application/pdf" }] },
      { company: company._id, relatedType: "Quote", relatedId: quote._id, sentBy: req.user.id }
    );
    quote.updatedBy = req.user.id;
    await quote.save();
    res.json({ success: true, simulated: result.status === "simulated", data: await Quote.findById(quote._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST quote email error:", error);
    res.status(502).json({ success: false, message: `The email could not be sent: ${error.message}` });
  }
});

router.post("/:id/project", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id).populate("customer", "name");
    if (!quote) return bad(res, "Devis not found", 404);
    if (quote.status !== "accepted") return bad(res, "Mark the devis as accepted first");
    if (quote.project) return bad(res, "This devis already has a project");
    let manager = null;
    if (req.body.manager) {
      if (!isId(req.body.manager) || !(await Employee.exists({ _id: req.body.manager, company: quote.company }))) {
        return bad(res, "Project manager not found in this company");
      }
      manager = req.body.manager;
    }
    const project = await createWithNumber(Project, {
      company: quote.company,
      name: String(req.body.name || quote.subject || `${quote.customer?.name || ""} — ${quote.number}`).trim().slice(0, 200),
      customer: quote.customer?._id || quote.customer,
      quote: quote._id,
      date: new Date(),
      startDate: req.body.startDate || null,
      dueDate: req.body.dueDate || null,
      manager,
      budget: { revenue: quote.totalHT },
      // Chassis lines of the devis become the project's ouvrages.
      items: (quote.lines || []).filter((l) => l.chassis?.model).map((l, i) => ({
        ref: l.chassis.ref || `R${i + 1}`,
        model: l.chassis.model,
        label: l.description,
        L: l.chassis.L,
        H: l.chassis.H,
        quantity: Math.max(1, Math.round(l.quantity)),
        finish: l.chassis.finish || null,
        params: l.chassis.params || {},
      })),
      finish: (quote.lines || []).find((l) => l.chassis?.finish)?.chassis.finish || null,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }, "PRJ");
    quote.project = project._id;
    await quote.save();
    if ((project.items || []).length) await require("../services/trackingService").syncProjectUnits(project, req.user.id);
    await logAudit(req, { company: quote.company, action: "create", resourceType: "Project", resourceId: project._id, resourceLabel: `${project.number} (devis ${quote.number})` });
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error("POST quote → project error:", error);
    res.status(500).json({ success: false, message: "Error creating the project", error: error.message });
  }
});

async function invoiceBase(quote) {
  const customer = await Customer.findById(quote.customer).select("paymentDays");
  return {
    company: quote.company,
    customer: quote.customer,
    quote: quote._id,
    project: quote.project || null,
    date: new Date(),
    subject: quote.subject,
    paymentTerms: quote.paymentTerms,
    paymentDays: customer?.paymentDays,
  };
}

router.post("/:id/deposit", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id);
    if (!quote) return bad(res, "Devis not found", 404);
    if (quote.status !== "accepted") return bad(res, "Mark the devis as accepted first");
    if (await SalesInvoice.exists({ quote: quote._id, type: "invoice", status: { $ne: "cancelled" } })) {
      return bad(res, "The final invoice of this devis already exists");
    }
    const lines = depositLines(quote, req.body.percent);
    const { paymentDays, ...base } = await invoiceBase(quote);
    const invoice = await SalesInvoice.create({
      ...base,
      type: "deposit",
      date: req.body.date ? new Date(req.body.date) : base.date,
      lines,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("POST quote deposit error:", error);
    res.status(500).json({ success: false, message: "Error creating the deposit invoice", error: error.message });
  }
});

router.post("/:id/invoice", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid devis ID");
    const quote = await Quote.findById(req.params.id);
    if (!quote) return bad(res, "Devis not found", 404);
    if (quote.status !== "accepted") return bad(res, "Mark the devis as accepted first");
    if (await SalesInvoice.exists({ quote: quote._id, type: "invoice", status: { $ne: "cancelled" } })) {
      return bad(res, "The final invoice of this devis already exists");
    }
    if (await SalesInvoice.exists({ quote: quote._id, type: "deposit", status: "draft" })) {
      return bad(res, "Issue or delete the draft deposit invoice first");
    }
    const deposits = await SalesInvoice.find({ quote: quote._id, type: "deposit", status: { $in: ["issued", "partially_paid", "paid"] } });
    const { paymentDays, ...base } = await invoiceBase(quote);
    const invoice = await SalesInvoice.create({
      ...base,
      type: "invoice",
      lines: quote.lines.map((l) => {
        const { _id, ...rest } = l.toObject();
        return rest;
      }),
      depositBreakdown: sumDeposits(deposits),
      depositInvoices: deposits.map((d) => d._id),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    console.error("POST quote invoice error:", error);
    res.status(500).json({ success: false, message: "Error creating the invoice", error: error.message });
  }
});

module.exports = router;
