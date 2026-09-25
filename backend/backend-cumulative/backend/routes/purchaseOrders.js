const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const router = express.Router();

const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseRequest = require("../models/PurchaseRequest");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const Company = require("../models/Company");
const { fetchLogoBuffer } = require("../services/pdfHelpers");
const { generatePurchaseOrderPdf } = require("../services/purchasingPdfService");
const InventoryCategory = require("../models/InventoryCategory");
const auth = require("../middleware/auth");
const { requirePurchasingAccess } = require("../middleware/permissionMiddleware");
const { logAudit } = require("../services/auditLogger");
const { applyMovement } = require("../services/inventoryService");
const { uploadFile, deleteFile } = require("../services/cloudinaryService");
const { createWithNumber } = require("../services/documentNumberService");
const { notify, notifyMany, getProductionRecipientIds } = require("../services/notificationService");
const Department = require("../models/Department");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { sendMail, pdfToBuffer, isEmail } = require("../services/mailService");
const reports = require("../services/purchasingReports");
const exportsXlsx = require("../services/purchasingExports");
const PurchaseRequestModel = require("../models/PurchaseRequest");
const { OPEN } = require("../services/purchaseRequestWorkflow");
const {
  round2, lineOutstanding, validateReception, applyReceptionToLines, deriveReceptionStatus,
  derivePaymentStatus, allocateInvoices, computeTotals,
} = require("../services/purchaseOrderCalc");

/**
 * ============================================================
 * PURCHASE ORDERS (bons de commande) — purchasing module
 * ============================================================
 * draft -> sent -> partially_received -> received   (or cancelled)
 * Receptions (with the supplier's BL number) and returns move stock
 * for lines linked to an inventory article. Invoices and BL scans can
 * be uploaded; payments are recorded with their method.
 * ============================================================
 */

router.use(auth, requirePurchasingAccess);

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Upload a PDF or an image (JPG, PNG, WEBP)"), ok);
  },
});
const withUpload = (req, res, next) =>
  uploadDoc.single("file")(req, res, (err) => (err ? res.status(400).json({ success: false, message: err.message }) : next()));

const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- purchase order approval ----------
// Orders at or above Company.settings.purchaseApprovalThreshold (TTC)
// need an approver before they can be marked as ordered.
const approvalThreshold = (company) => Number(company?.settings?.purchaseApprovalThreshold) || 0;
// Always computed from the lines — never trust a stored total that may
// not have been recalculated yet.
const orderTotalTTC = (order) => computeTotals(order.lines || []).totalTTC;
function needsApproval(order, company) {
  const threshold = approvalThreshold(company);
  const total = orderTotalTTC(order);
  if (threshold <= 0 || total < threshold) return false;
  const approved = order.approval?.approvedAt && order.approval.approvedAmount !== null
    && order.approval.approvedAmount >= total - 0.005;
  return !approved;
}

/** Departments with the purchasing module whose manager is `employeeId`. */
async function managesPurchasing(user, companyId) {
  const ids = user.managedDepartments || [];
  if (!ids.length) return false;
  return !!(await Department.exists({ _id: { $in: ids }, company: companyId, permissionKey: "purchasing" }));
}

/** Admins, the company owner, and the purchasing department's manager. */
async function canApprove(user, company) {
  if (user.role === "admin") return true;
  if (user.role === "owner" && String(company.owner) === String(user.id)) return true;
  return managesPurchasing(user, company._id);
}

async function approverIds(company, excludeUserId) {
  const ids = new Set();
  (await User.find({ role: "admin" }).select("_id").lean()).forEach((u) => ids.add(String(u._id)));
  if (company.owner) ids.add(String(company.owner));
  const depts = await Department.find({ company: company._id, permissionKey: "purchasing", manager: { $ne: null } }).select("manager").lean();
  if (depts.length) {
    const users = await User.find({ employee: { $in: depts.map((d) => d.manager) } }).select("_id").lean();
    users.forEach((u) => ids.add(String(u._id)));
  }
  ids.delete(String(excludeUserId || ""));
  return [...ids];
}

async function requestApproval(order, company, userId) {
  order.status = "pending_approval";
  order.approval = { ...(order.approval?.toObject?.() || order.approval || {}), requestedAt: new Date(), requestedBy: userId,
    approvedAt: null, approvedBy: null, approvedAmount: null, rejectedAt: null, rejectedBy: null, rejectReason: undefined };
  await notifyMany(await approverIds(company, userId), {
    type: "purchase_request_pending",
    title: "Purchase order awaiting approval",
    message: `${order.number} — ${round2(order.totalTTC)} MAD TTC`,
    link: `/purchasing/orders/${order._id}`,
  });
}

async function storeFile(file, companyId) {
  if (!file) return undefined;
  const result = await uploadFile(file.buffer, `purchasing/${companyId}`, file.originalname, file.mimetype);
  return { url: result.secure_url, publicId: result.public_id, originalName: file.originalname };
}

const DETAIL_POPULATE = [
  { path: "supplier", select: "name contactName phone email paymentTerms" },
  { path: "lines.product", select: "name internalReference unit quantity" },
  { path: "purchaseRequests", select: "requestedQuantity status product", populate: { path: "product", select: "name" } },
  { path: "receptions.by", select: "firstName lastName" },
  { path: "payments.by", select: "firstName lastName" },
  { path: "invoices.by", select: "firstName lastName" },
  { path: "createdBy", select: "firstName lastName" },
];

/** Cleans incoming lines and checks linked articles belong to the company. */
async function normalizeLines(rawLines, companyId) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return { error: "Add at least one line" };
  const lines = [];
  for (const raw of rawLines) {
    const quantity = Number(raw.quantity);
    const unitPrice = Number(raw.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Every line needs a quantity greater than zero" };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Every line needs a valid unit price" };
    let description = String(raw.description || "").trim();
    let unit = raw.unit;
    let product = null;
    if (raw.product) {
      if (!isId(raw.product)) return { error: "Invalid article on a line" };
      // eslint-disable-next-line no-await-in-loop
      const doc = await Product.findOne({ _id: raw.product, company: companyId }).select("name unit");
      if (!doc) return { error: "An article on this order doesn't belong to this company" };
      product = doc._id;
      description = description || doc.name;
      unit = unit || doc.unit;
    }
    if (!description) return { error: "Every line needs a description or an article" };
    lines.push({
      product,
      description,
      quantity,
      unit,
      unitPrice,
      vatRate: raw.vatRate === undefined || raw.vatRate === "" ? 20 : Number(raw.vatRate),
    });
  }
  return { lines };
}

/** Moves linked purchase requests to `status`, with a note, and tells production. */
async function updateLinkedRequests(order, requestIds, status, note, actorId, onlyOpen = false) {
  if (!requestIds?.length) return;
  const filter = { _id: { $in: requestIds }, company: order.company };
  if (onlyOpen) filter.status = { $in: OPEN };
  const requests = await PurchaseRequest.find(filter).populate("product", "name");
  for (const request of requests) {
    request.status = status;
    request.purchaseOrder = order._id;
    if (status === "pending") request.purchaseOrder = null;
    request.history.push({ status, note, by: actorId });
    // eslint-disable-next-line no-await-in-loop
    await request.save();
  }
  if (requests.length) {
    const recipients = new Set(await getProductionRecipientIds(order.company, actorId));
    requests.forEach((r) => r.requestedBy && String(r.requestedBy) !== String(actorId) && recipients.add(String(r.requestedBy)));
    const titles = { ordered: "Purchase request ordered", received: "Purchased item received", pending: "Purchase order cancelled" };
    await notifyMany([...recipients], {
      type: "purchase_request_reviewed",
      title: titles[status] || "Update on a purchase request",
      message: `${order.number}: ${requests.map((r) => `${r.requestedQuantity} × ${r.product?.name || "article"}`).join(", ")}${note ? ` — ${note}` : ""}`,
      link: "/production/purchase-requests",
    });
  }
  return requests;
}

// ======================================================
// LIST (the recap table)
// GET /api/purchase-orders?companyId=&status=&paymentStatus=&supplier=&search=&from=&to=&page=&limit=
// ======================================================
router.get("/", async (req, res) => {
  try {
    const { companyId, status, paymentStatus, supplier, search, from, to, late, page = 1, limit = 20 } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");

    const filter = { company: companyId };
    if (status) filter.status = { $in: String(status).split(",") };
    // late = ordered, not fully received, expected delivery date passed
    if (late === "true") {
      filter.status = { $in: ["sent", "partially_received"] };
      filter.expectedDate = { $ne: null, $lt: new Date() };
    }
    if (paymentStatus) filter.paymentStatus = { $in: String(paymentStatus).split(",") };
    if (supplier && isId(supplier)) filter.supplier = supplier;
    if (search) filter.number = new RegExp(escapeRegex(search.trim()), "i");
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(`${to}T23:59:59`);
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .select("number supplier date expectedDate status totalHT totalTTC amountPaid paymentStatus lines.quantity lines.receivedQuantity lines.returnedQuantity invoices.number")
        .populate("supplier", "name")
        .sort({ date: -1, number: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      PurchaseOrder.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: orders,
      pagination: { total, page: currentPage, limit: currentLimit, pages: Math.ceil(total / currentLimit) || 1 },
    });
  } catch (error) {
    console.error("GET purchase orders error:", error);
    res.status(500).json({ success: false, message: "Error fetching purchase orders", error: error.message });
  }
});

// ======================================================
// SUMMARY (recap figures)  GET /api/purchase-orders/summary?companyId=
// ======================================================
router.get("/summary", async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");
    const orders = await PurchaseOrder.find({ company: companyId, status: { $ne: "cancelled" } })
      .select("status totalTTC amountPaid amountDue paymentStatus invoices payments").lean();
    const now = new Date();
    const byStatus = {};
    let totalOrdered = 0;
    let totalPaid = 0;
    let overdueOrders = 0;
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      if (o.status !== "draft") totalOrdered += o.totalTTC || 0;
      totalPaid += o.amountPaid || 0;
      if (allocateInvoices(o, now).some((r) => r.overdue)) overdueOrders += 1;
    }
    res.json({
      success: true,
      data: {
        byStatus,
        totalOrdered: round2(totalOrdered),
        totalPaid: round2(totalPaid),
        remainingToPay: round2(totalOrdered - totalPaid),
        overdueOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error building the summary", error: error.message });
  }
});

// ======================================================
// REPORTS — files for the accountant and the tax return
// GET /api/purchase-orders/reports/vat-deductions?companyId=&from=&to=&format=xlsx|json
// GET /api/purchase-orders/reports/accounting?companyId=&from=&to=
// GET /api/purchase-orders/reports/aged-balance?companyId=&format=xlsx|json
// GET /api/purchase-orders/reports/restock?companyId=
// ======================================================
const sendXlsx = (res, buffer, filename) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
};
async function loadReportOrders(companyId) {
  return PurchaseOrder.find({ company: companyId, status: { $ne: "cancelled" } })
    .select("number status supplier lines totalHT totalVAT totalTTC invoices payments")
    .populate("supplier", "name identifiantFiscal ice")
    .lean();
}

router.get("/reports/vat-deductions", async (req, res) => {
  try {
    const { companyId, from, to, format } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");
    const orders = await loadReportOrders(companyId);
    const rows = reports.vatDeductionRows(orders, { from, to });
    // payments with no invoice to deduct from — shown so the report
    // never looks mysteriously empty
    const withoutInvoice = reports.paymentsWithoutInvoice(orders, { from, to });
    if (format !== "xlsx") return res.json({ success: true, data: rows, withoutInvoice });
    const company = await Company.findById(companyId).select("name ice taxId");
    sendXlsx(res, await exportsXlsx.vatDeductionXlsx(rows, { company, from, to, withoutInvoice }), `releve-deductions-tva${from ? `-${from}` : ""}.xlsx`);
  } catch (error) {
    console.error("GET vat deductions error:", error);
    res.status(500).json({ success: false, message: "Error building the VAT deduction listing", error: error.message });
  }
});

router.get("/reports/accounting", async (req, res) => {
  try {
    const { companyId, from, to } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");
    const entries = reports.accountingEntries(await loadReportOrders(companyId), { from, to });
    const company = await Company.findById(companyId).select("name");
    sendXlsx(res, await exportsXlsx.accountingXlsx(entries, { company, from, to }), `journal-achats${from ? `-${from}` : ""}.xlsx`);
  } catch (error) {
    console.error("GET accounting export error:", error);
    res.status(500).json({ success: false, message: "Error building the accounting export", error: error.message });
  }
});

router.get("/reports/aged-balance", async (req, res) => {
  try {
    const { companyId, format } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");
    const rows = reports.agedBalance(await loadReportOrders(companyId));
    if (format !== "xlsx") return res.json({ success: true, data: rows });
    const company = await Company.findById(companyId).select("name");
    sendXlsx(res, await exportsXlsx.agedBalanceXlsx(rows, { company }), "balance-agee-fournisseurs.xlsx");
  } catch (error) {
    res.status(500).json({ success: false, message: "Error building the aged balance", error: error.message });
  }
});

router.get("/reports/restock", async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");
    const [products, openOrders, openRequests] = await Promise.all([
      Product.find({ company: companyId }).select("name internalReference unit quantity threshold prices").lean(),
      PurchaseOrder.find({ company: companyId, status: { $in: ["draft", "pending_approval", "sent", "partially_received"] } }).select("status lines").lean(),
      PurchaseRequestModel.find({ company: companyId, status: { $in: ["pending", "delayed"] } }).select("product requestedQuantity").lean(),
    ]);
    res.json({ success: true, data: reports.restockSuggestions(products, openOrders, openRequests) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error building restocking suggestions", error: error.message });
  }
});

// ======================================================
// SUPPLIER INVOICES — the échéancier (every invoice, every order)
// GET /api/purchase-orders/invoices?companyId=&filter=unpaid|overdue|all&supplier=
// ======================================================
router.get("/invoices", async (req, res) => {
  try {
    const { companyId, filter = "unpaid", supplier } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");
    const query = { company: companyId, status: { $ne: "cancelled" }, "invoices.0": { $exists: true } };
    if (supplier && isId(supplier)) query.supplier = supplier;
    const orders = await PurchaseOrder.find(query)
      .select("number supplier invoices payments")
      .populate("supplier", "name")
      .lean();

    const now = new Date();
    let rows = [];
    for (const order of orders) {
      for (const r of allocateInvoices(order, now)) {
        rows.push({
          orderId: order._id,
          orderNumber: order.number,
          supplier: order.supplier,
          invoiceId: r.invoice._id,
          number: r.invoice.number,
          date: r.invoice.date,
          dueDate: r.invoice.dueDate,
          file: r.invoice.file,
          amount: r.amount,
          paid: r.paid,
          remaining: r.remaining,
          status: r.status,
          overdue: r.overdue,
          daysOverdue: r.daysOverdue,
          termDays: r.termDays,
          legal: r.legal,
        });
      }
    }
    if (filter === "unpaid") rows = rows.filter((r) => r.status !== "paid");
    if (filter === "overdue") rows = rows.filter((r) => r.overdue);
    rows.sort((a, b) => (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity));

    const open = rows.filter((r) => r.status !== "paid");
    res.json({
      success: true,
      data: rows,
      totals: {
        remaining: round2(open.reduce((s, r) => s + r.remaining, 0)),
        overdue: round2(open.filter((r) => r.overdue).reduce((s, r) => s + r.remaining, 0)),
        overdueCount: open.filter((r) => r.overdue).length,
        dueIn30: round2(open.filter((r) => !r.overdue && r.dueDate && new Date(r.dueDate) - now <= 30 * 864e5).reduce((s, r) => s + r.remaining, 0)),
      },
    });
  } catch (error) {
    console.error("GET supplier invoices error:", error);
    res.status(500).json({ success: false, message: "Error fetching supplier invoices", error: error.message });
  }
});

// ======================================================
// ARTICLE HISTORY — every order containing an article
// GET /api/purchase-orders/by-product/:productId
// ======================================================
router.get("/by-product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isId(productId)) return bad(res, "Invalid article");
    const orders = await PurchaseOrder.find({ "lines.product": productId })
      .select("number date status supplier paymentStatus lines")
      .populate("supplier", "name")
      .sort({ date: -1 })
      .lean();
    const rows = [];
    for (const order of orders) {
      for (const line of order.lines) {
        if (String(line.product) !== String(productId)) continue;
        rows.push({
          orderId: order._id,
          number: order.number,
          date: order.date,
          status: order.status,
          paymentStatus: order.paymentStatus,
          supplier: order.supplier,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          receivedQuantity: line.receivedQuantity || 0,
          returnedQuantity: line.returnedQuantity || 0,
          outstanding: order.status === "cancelled" ? 0 : lineOutstanding(line),
        });
      }
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching the article's orders", error: error.message });
  }
});

// ======================================================
// PDF  GET /api/purchase-orders/:id/pdf — the bon de commande to send
// ======================================================
// Streams the document inline. The browser-side filename is set by the
// frontend (downloadBlob); this header name is only an ASCII fallback.
router.get("/:id/pdf", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id)
      .populate("supplier")
      .populate("lines.product", "name internalReference unit prices");
    if (!order) return bad(res, "Purchase order not found", 404);
    const company = await Company.findById(order.company);
    if (!company) return bad(res, "Company not found", 404);

    const logoBuffer = await fetchLogoBuffer(company);
    const doc = generatePurchaseOrderPdf({ order, company, supplier: order.supplier, logoBuffer });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${order.number}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("GET purchase order PDF error:", error);
    res.status(500).json({ success: false, message: "Error generating the purchase order PDF", error: error.message });
  }
});

// ======================================================
// DETAIL  GET /api/purchase-orders/:id
// ======================================================
router.get("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id).populate(DETAIL_POPULATE);
    if (!order) return bad(res, "Purchase order not found", 404);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching purchase order", error: error.message });
  }
});

// ======================================================
// CREATE  POST /api/purchase-orders
// { company, supplier, date?, expectedDate?, lines, notes?, send?, purchaseRequestIds? }
// ======================================================
router.post("/", async (req, res) => {
  try {
    const { company, supplier, date, expectedDate, notes, send, purchaseRequestIds } = req.body;
    if (!company || !isId(company)) return bad(res, "A valid company is required");
    if (!supplier || !isId(supplier)) return bad(res, "Choose a supplier");
    const supplierDoc = await Supplier.findOne({ _id: supplier, company });
    if (!supplierDoc) return bad(res, "Supplier not found in this company");

    const { lines, error } = await normalizeLines(req.body.lines, company);
    if (error) return bad(res, error);

    const order = await createWithNumber(PurchaseOrder, {
      company,
      supplier,
      date: date || new Date(),
      expectedDate: expectedDate || null,
      lines,
      notes,
      status: send ? "sent" : "draft",
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }, "BC");

    const requestIds = (Array.isArray(purchaseRequestIds) ? purchaseRequestIds : []).filter(isId);
    const linked = await updateLinkedRequests(order, requestIds, "ordered", null, req.user.id, true);
    if (linked?.length) {
      order.purchaseRequests = linked.map((r) => r._id);
      await order.save();
    }

    await logAudit(req, { company, action: "create", resourceType: "PurchaseOrder", resourceId: order._id, resourceLabel: `${order.number} — ${supplierDoc.name}` });
    res.status(201).json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST purchase order error:", error);
    res.status(500).json({ success: false, message: "Error creating purchase order", error: error.message });
  }
});

// ======================================================
// EDIT  PUT /api/purchase-orders/:id — header + lines, only before any reception
// ======================================================
router.put("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);
    if (!["draft", "sent"].includes(order.status) || order.receptions.length) {
      return bad(res, "An order can only be edited before anything has been received");
    }

    const { supplier, date, expectedDate, notes } = req.body;
    if (supplier !== undefined) {
      if (!isId(supplier) || !(await Supplier.exists({ _id: supplier, company: order.company }))) return bad(res, "Supplier not found in this company");
      order.supplier = supplier;
    }
    if (req.body.lines !== undefined) {
      const { lines, error } = await normalizeLines(req.body.lines, order.company);
      if (error) return bad(res, error);
      order.lines = lines;
    }
    if (date !== undefined) order.date = date;
    if (expectedDate !== undefined) order.expectedDate = expectedDate || null;
    if (notes !== undefined) order.notes = notes;
    order.updatedBy = req.user.id;
    await order.validate(); // recompute totals before the approval check
    // Loophole guard: an order approved at 10 000 then edited up to
    // 100 000 must be approved again.
    let message;
    if (order.status === "sent") {
      const company = await Company.findById(order.company).select("owner settings");
      if (needsApproval(order, company)) {
        await requestApproval(order, company, req.user.id);
        message = "approval_requested";
      }
    }
    await order.save();
    res.json({ success: true, message, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("PUT purchase order error:", error);
    res.status(500).json({ success: false, message: "Error updating purchase order", error: error.message });
  }
});

// ======================================================
// STATUS  PATCH /api/purchase-orders/:id/status  { status: "sent"|"cancelled", reason? }
// ======================================================
router.patch("/:id/status", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);
    const { status, reason } = req.body;

    let message;
    if (status === "sent") {
      if (order.status !== "draft") return bad(res, "Only a draft can be marked as sent");
      const company = await Company.findById(order.company).select("owner settings");
      if (needsApproval(order, company)) {
        await requestApproval(order, company, req.user.id);
        message = "approval_requested";
      } else {
        order.status = "sent";
      }
    } else if (status === "cancelled") {
      if (!["draft", "pending_approval", "sent"].includes(order.status) || order.receptions.length) {
        return bad(res, "An order that has already been (partly) received can't be cancelled — record a return instead");
      }
      if (!reason || !String(reason).trim()) return bad(res, "Please give the reason for cancelling");
      order.status = "cancelled";
      order.cancelReason = String(reason).trim();
      // The requests it covered go back to the purchasing queue.
      await updateLinkedRequests(order, order.purchaseRequests, "pending", `Commande ${order.number} annulée : ${order.cancelReason}`, req.user.id);
    } else {
      return bad(res, 'status must be "sent" or "cancelled"');
    }
    order.updatedBy = req.user.id;
    await order.save();
    res.json({ success: true, message, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("PATCH purchase order status error:", error);
    res.status(500).json({ success: false, message: "Error updating the order status", error: error.message });
  }
});

// ======================================================
// APPROVAL  PATCH /api/purchase-orders/:id/approve
//           PATCH /api/purchase-orders/:id/reject-approval  { reason }
// ======================================================
async function decideApproval(req, res, approve) {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);
    if (order.status !== "pending_approval") return bad(res, "This order isn't waiting for approval");
    const company = await Company.findById(order.company).select("owner settings name");
    if (!(await canApprove(req.user, company))) {
      return bad(res, "Only an admin, the company owner or the purchasing manager can approve purchase orders", 403);
    }
    const isOwnRequest = String(order.approval?.requestedBy) === String(req.user.id);
    if (isOwnRequest && req.user.role !== "admin" && req.user.role !== "owner") {
      return bad(res, "You can't approve or refuse your own purchase order", 403);
    }

    const reason = String(req.body?.reason || "").trim();
    if (!approve && !reason) return bad(res, "Please give the reason for refusing");

    if (approve) {
      order.status = "sent";
      order.approval.approvedAt = new Date();
      order.approval.approvedBy = req.user.id;
      order.approval.approvedAmount = orderTotalTTC(order);
    } else {
      order.status = "draft";
      order.approval.rejectedAt = new Date();
      order.approval.rejectedBy = req.user.id;
      order.approval.rejectReason = reason.slice(0, 500);
    }
    order.updatedBy = req.user.id;
    await order.save();

    if (order.approval.requestedBy && !isOwnRequest) {
      await notify(order.approval.requestedBy, {
        type: "purchase_request_reviewed",
        title: approve ? "Purchase order approved" : "Purchase order refused",
        message: approve ? `${order.number} can be sent to the supplier` : `${order.number} — ${reason}`,
        link: `/purchasing/orders/${order._id}`,
      });
    }
    await logAudit(req, { company: order.company, action: "review", resourceType: "PurchaseOrder", resourceId: order._id,
      resourceLabel: `${order.number} — ${approve ? "approuvé" : `refusé : ${reason}`}` });
    res.json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("PATCH purchase order approval error:", error);
    res.status(500).json({ success: false, message: "Error recording the approval", error: error.message });
  }
}
router.patch("/:id/approve", (req, res) => decideApproval(req, res, true));
router.patch("/:id/reject-approval", (req, res) => decideApproval(req, res, false));

// ======================================================
// EMAIL THE BON DE COMMANDE  POST /api/purchase-orders/:id/email
// body: { to, cc?, message? } — the PDF is attached
// ======================================================
router.post("/:id/email", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id)
      .populate("supplier")
      .populate("lines.product", "name internalReference unit prices");
    if (!order) return bad(res, "Purchase order not found", 404);
    if (["draft", "pending_approval", "cancelled"].includes(order.status)) {
      return bad(res, "Only an order marked as ordered can be sent to the supplier");
    }
    const to = String(req.body?.to || "").trim();
    const cc = String(req.body?.cc || "").trim();
    if (!isEmail(to)) return bad(res, "Enter a valid recipient email");
    if (cc && !cc.split(",").every((x) => isEmail(x))) return bad(res, "Invalid CC email");

    const company = await Company.findById(order.company);
    const logoBuffer = await fetchLogoBuffer(company);
    const pdf = await pdfToBuffer(generatePurchaseOrderPdf({ order, company, supplier: order.supplier, logoBuffer }));
    const subject = `Bon de commande ${order.number} — ${company.name}`;
    const text = String(req.body?.message || "").trim()
      || `Bonjour,\n\nVeuillez trouver ci-joint notre bon de commande ${order.number}.\nMerci de nous confirmer sa bonne réception et le délai de livraison.\n\nCordialement,\n${company.name}`;

    const result = await sendMail({ to, cc, subject, text, attachments: [{ filename: `${order.number}.pdf`, content: pdf, contentType: "application/pdf" }] },
      { company: company._id, relatedType: "PurchaseOrder", relatedId: order._id, sentBy: req.user.id });
    order.emails.push({ to, cc, subject, by: req.user.id, simulated: result.status === "simulated" });
    await order.save();
    res.json({ success: true, simulated: result.status === "simulated", data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST purchase order email error:", error);
    res.status(502).json({ success: false, message: `The email could not be sent: ${error.message}` });
  }
});

// ======================================================
// RECEPTION / RETURN  POST /api/purchase-orders/:id/receptions  (multipart)
// fields: type ("reception"|"return"), reference (BL number — required),
//         date, notes, lines (JSON: [{ lineId, quantity }]); file: optional scan
// ======================================================
router.post("/:id/receptions", withUpload, async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);

    const type = req.body.type === "return" ? "return" : "reception";
    const reference = String(req.body.reference || "").trim();
    if (!reference) {
      return bad(res, type === "reception" ? "Enter the BL (delivery note) number" : "Enter the return reference");
    }
    let entries;
    try {
      entries = typeof req.body.lines === "string" ? JSON.parse(req.body.lines) : req.body.lines;
    } catch {
      return bad(res, "Invalid lines");
    }
    entries = (entries || []).filter((e) => Number(e.quantity) > 0);

    const problem = validateReception(order, type, entries);
    if (problem) return bad(res, problem);

    // Returns take stock OUT — check every article has enough before
    // touching anything, so a return can't half-apply.
    const byLineId = new Map(order.lines.map((l) => [String(l._id), l]));
    const stockOps = [];
    for (const entry of entries) {
      const line = byLineId.get(String(entry.lineId));
      if (!line.product) continue; // free-text line (service...) — no stock
      // eslint-disable-next-line no-await-in-loop
      const product = await Product.findById(line.product);
      if (!product) continue;
      if (type === "return" && product.quantity < Number(entry.quantity)) {
        return bad(res, `"${product.name}": only ${product.quantity} in stock, can't return ${entry.quantity}`);
      }
      stockOps.push({ product, quantity: Number(entry.quantity) });
    }

    const file = await storeFile(req.file, order.company);
    for (const op of stockOps) {
      // eslint-disable-next-line no-await-in-loop
      await applyMovement({
        product: op.product,
        type: type === "reception" ? "in" : "out",
        quantity: op.quantity,
        reason: `${type === "reception" ? "Réception" : "Retour fournisseur"} ${order.number} (${reference})`,
        actorId: req.user.id,
      });
    }

    applyReceptionToLines(order, type, entries);
    order.receptions.push({
      type,
      reference,
      date: req.body.date || new Date(),
      lines: entries.map((e) => ({ lineId: e.lineId, quantity: Number(e.quantity) })),
      notes: req.body.notes,
      file,
      by: req.user.id,
    });
    const before = order.status;
    order.status = deriveReceptionStatus(order);
    order.updatedBy = req.user.id;
    await order.save();

    if (order.status === "received" && before !== "received") {
      await updateLinkedRequests(order, order.purchaseRequests, "received", `BL ${reference}`, req.user.id);
    }

    await logAudit(req, {
      company: order.company,
      action: "update",
      resourceType: "PurchaseOrder",
      resourceId: order._id,
      resourceLabel: `${order.number} — ${type === "reception" ? "réception" : "retour"} ${reference}`,
    });
    res.status(201).json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST purchase order reception error:", error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Error recording the reception", error: error.message });
  }
});

// ======================================================
// CLOSE / REOPEN A LINE ("solder la ligne")
// PATCH /api/purchase-orders/:id/lines/:lineId/close   { reason? }
// PATCH /api/purchase-orders/:id/lines/:lineId/reopen
// ======================================================
// Real deliveries are often short: 70 ordered, 69 delivered, and the
// last one isn't coming. Closing the line accepts what was received as
// final — nothing more is expected, and once every line is received or
// closed the order is "received" (its purchase requests close too).
async function setLineClosed(req, res, closed) {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);
    if (!["sent", "partially_received", "received"].includes(order.status)) {
      return bad(res, "Only an order sent to the supplier can have lines closed or reopened");
    }
    const line = order.lines.id(req.params.lineId);
    if (!line) return bad(res, "Order line not found", 404);
    if (closed && line.closed) return bad(res, "This line is already closed");
    if (!closed && !line.closed) return bad(res, "This line isn't closed");

    line.closed = closed;
    line.closedAt = closed ? new Date() : null;
    line.closedBy = closed ? req.user.id : null;
    line.closeReason = closed ? String(req.body?.reason || "").trim().slice(0, 300) : undefined;
    const before = order.status;
    order.status = deriveReceptionStatus(order);
    order.updatedBy = req.user.id;
    await order.save();

    if (order.status === "received" && before !== "received") {
      await updateLinkedRequests(order, order.purchaseRequests, "received", `Ligne soldée : ${line.description}`, req.user.id);
    }
    await logAudit(req, {
      company: order.company, action: "update", resourceType: "PurchaseOrder", resourceId: order._id,
      resourceLabel: `${order.number} — ligne ${closed ? "soldée" : "rouverte"} : ${line.description}`,
    });
    res.json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("PATCH line close/reopen error:", error);
    res.status(500).json({ success: false, message: "Error updating the line", error: error.message });
  }
}
router.patch("/:id/lines/:lineId/close", (req, res) => setLineClosed(req, res, true));
router.patch("/:id/lines/:lineId/reopen", (req, res) => setLineClosed(req, res, false));

// ======================================================
// ADD A TYPED-IN LINE TO THE INVENTORY
// POST /api/purchase-orders/:id/lines/:lineId/create-article
// body: { category (required), internalReference?, unit?, threshold? }
// ======================================================
// For an article bought for the first time (typed in on the price
// request / order, not in the inventory yet). Creates the article —
// already carrying this supplier and price — and links the line, so
// receptions move stock from then on. Anything ALREADY received on
// the line is put into stock right away, so nothing is lost. The
// internal reference may be left empty and added later.

router.post("/:id/lines/:lineId/create-article", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);
    if (order.status === "cancelled") return bad(res, "This order was cancelled");
    const line = order.lines.id(req.params.lineId);
    if (!line) return bad(res, "Order line not found", 404);
    if (line.product) return bad(res, "This line is already an inventory article");

    const { category, internalReference, unit, threshold } = req.body;
    if (!category || !isId(category)) return bad(res, "Choose a category");
    if (!(await InventoryCategory.exists({ _id: category, company: order.company }))) {
      return bad(res, "Category not found in this company");
    }
    const thresholdValue = threshold === undefined || threshold === "" ? 0 : Number(threshold);
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0) return bad(res, "Invalid minimum stock");

    const supplier = await Supplier.findById(order.supplier).select("name");
    const product = await Product.create({
      company: order.company,
      category,
      name: line.description,
      internalReference: String(internalReference || "").trim().toUpperCase() || undefined,
      unit: String(unit || line.unit || "").trim() || undefined,
      quantity: 0,
      threshold: thresholdValue,
      prices: supplier ? [{ supplierName: supplier.name, price: line.unitPrice }] : [],
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    line.product = product._id;
    order.updatedBy = req.user.id;
    await order.save();

    const alreadyKept = (line.receivedQuantity || 0) - (line.returnedQuantity || 0);
    if (alreadyKept > 0) {
      await applyMovement({
        product,
        type: "in",
        quantity: alreadyKept,
        reason: `Mise en stock ${order.number} (article ajouté à l'inventaire)`,
        actorId: req.user.id,
      });
    }

    await logAudit(req, {
      company: order.company,
      action: "create",
      resourceType: "Product",
      resourceId: product._id,
      resourceLabel: `${product.name} (depuis ${order.number})`,
    });
    res.status(201).json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    if (error.code === 11000) return bad(res, "Another article already uses this internal reference", 409);
    console.error("POST create-article error:", error);
    res.status(500).json({ success: false, message: "Error adding the article to the inventory", error: error.message });
  }
});

// ======================================================
// INVOICES  POST /api/purchase-orders/:id/invoices (multipart: file + number, date, dueDate, amountTTC, notes)
//           DELETE /api/purchase-orders/:id/invoices/:invoiceId
// ======================================================
router.post("/:id/invoices", withUpload, async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);
    if (order.status === "cancelled") return bad(res, "This order was cancelled");

    const type = req.body.type === "credit_note" ? "credit_note" : "invoice";
    const number = String(req.body.number || "").trim();
    const amountTTC = Number(req.body.amountTTC);
    if (!number) return bad(res, type === "credit_note" ? "Enter the credit note number" : "Enter the invoice number");
    if (!req.body.date) return bad(res, "Enter the date");
    if (!Number.isFinite(amountTTC) || amountTTC <= 0) return bad(res, "Enter an amount greater than zero");

    // Due date: as entered, else invoice date + the supplier's payment
    // days (60 by default — Loi 69-21). Credit notes have none.
    let dueDate = null;
    if (type === "invoice") {
      if (req.body.dueDate) {
        dueDate = req.body.dueDate;
      } else {
        const supplierDoc = await Supplier.findById(order.supplier).select("paymentDays");
        const days = Number.isFinite(supplierDoc?.paymentDays) ? supplierDoc.paymentDays : 60;
        dueDate = new Date(new Date(req.body.date).getTime() + days * 24 * 60 * 60 * 1000);
      }
    }

    const file = await storeFile(req.file, order.company);
    order.invoices.push({ type, number, date: req.body.date, dueDate, amountTTC, notes: req.body.notes, file, by: req.user.id });
    order.updatedBy = req.user.id;
    await order.save();
    res.status(201).json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST invoice error:", error);
    res.status(500).json({ success: false, message: "Error adding the invoice", error: error.message });
  }
});

router.delete("/:id/invoices/:invoiceId", async (req, res) => {
  try {
    const order = isId(req.params.id) ? await PurchaseOrder.findById(req.params.id) : null;
    if (!order) return bad(res, "Purchase order not found", 404);
    const invoice = order.invoices.id(req.params.invoiceId);
    if (!invoice) return bad(res, "Invoice not found", 404);
    if (invoice.file?.publicId) await deleteFile(invoice.file.publicId).catch(() => {});
    invoice.deleteOne();
    await order.save();
    res.json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting the invoice", error: error.message });
  }
});

// ======================================================
// PAYMENTS  POST /api/purchase-orders/:id/payments { date, amount, method, reference?, notes? }
//           DELETE /api/purchase-orders/:id/payments/:paymentId
// ======================================================
router.post("/:id/payments", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid purchase order ID");
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return bad(res, "Purchase order not found", 404);
    if (order.status === "cancelled") return bad(res, "This order was cancelled");

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return bad(res, "Enter an amount greater than zero");
    if (!PurchaseOrder.PAYMENT_METHODS.includes(req.body.method)) return bad(res, "Choose a payment method");
    if (!req.body.date) return bad(res, "Enter the payment date");
    const { amountDue } = derivePaymentStatus(order);
    if (amount > amountDue + 0.01) return bad(res, `This is more than what's left to pay (${amountDue})`);

    order.payments.push({ date: req.body.date, amount, method: req.body.method, reference: req.body.reference, notes: req.body.notes, by: req.user.id });
    order.updatedBy = req.user.id;
    await order.save();
    res.status(201).json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("POST payment error:", error);
    res.status(500).json({ success: false, message: "Error recording the payment", error: error.message });
  }
});

router.delete("/:id/payments/:paymentId", async (req, res) => {
  try {
    const order = isId(req.params.id) ? await PurchaseOrder.findById(req.params.id) : null;
    if (!order) return bad(res, "Purchase order not found", 404);
    const payment = order.payments.id(req.params.paymentId);
    if (!payment) return bad(res, "Payment not found", 404);
    payment.deleteOne();
    await order.save();
    res.json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting the payment", error: error.message });
  }
});

// ======================================================
// DELETE  DELETE /api/purchase-orders/:id — drafts only (anything
// sent is part of the record; cancel it instead)
// ======================================================
router.delete("/:id", async (req, res) => {
  try {
    const order = isId(req.params.id) ? await PurchaseOrder.findById(req.params.id) : null;
    if (!order) return bad(res, "Purchase order not found", 404);
    if (order.status !== "draft") return bad(res, "Only a draft can be deleted — cancel a sent order instead");
    await updateLinkedRequests(order, order.purchaseRequests, "pending", `Brouillon ${order.number} supprimé`, req.user.id);
    await order.deleteOne();
    res.json({ success: true, message: "Draft deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting the purchase order", error: error.message });
  }
});

module.exports = router;
