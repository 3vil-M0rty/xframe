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
const { notifyMany, getProductionRecipientIds } = require("../services/notificationService");
const { OPEN } = require("../services/purchaseRequestWorkflow");
const {
  round2, lineOutstanding, validateReception, applyReceptionToLines, deriveReceptionStatus,
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
    const { companyId, status, paymentStatus, supplier, search, from, to, page = 1, limit = 20 } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");

    const filter = { company: companyId };
    if (status) filter.status = { $in: String(status).split(",") };
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
      .select("status totalTTC amountPaid paymentStatus invoices.dueDate").lean();
    const now = new Date();
    const byStatus = {};
    let totalOrdered = 0;
    let totalPaid = 0;
    let overdueOrders = 0;
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      if (o.status !== "draft") totalOrdered += o.totalTTC || 0;
      totalPaid += o.amountPaid || 0;
      if (o.paymentStatus !== "paid" && (o.invoices || []).some((i) => i.dueDate && new Date(i.dueDate) < now)) overdueOrders += 1;
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
    await order.save();
    res.json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
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

    if (status === "sent") {
      if (order.status !== "draft") return bad(res, "Only a draft can be marked as sent");
      order.status = "sent";
    } else if (status === "cancelled") {
      if (!["draft", "sent"].includes(order.status) || order.receptions.length) {
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
    res.json({ success: true, data: await PurchaseOrder.findById(order._id).populate(DETAIL_POPULATE) });
  } catch (error) {
    console.error("PATCH purchase order status error:", error);
    res.status(500).json({ success: false, message: "Error updating the order status", error: error.message });
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

    const number = String(req.body.number || "").trim();
    const amountTTC = Number(req.body.amountTTC);
    if (!number) return bad(res, "Enter the invoice number");
    if (!req.body.date) return bad(res, "Enter the invoice date");
    if (!Number.isFinite(amountTTC) || amountTTC < 0) return bad(res, "Enter the invoice amount");

    const file = await storeFile(req.file, order.company);
    order.invoices.push({ number, date: req.body.date, dueDate: req.body.dueDate || null, amountTTC, notes: req.body.notes, file, by: req.user.id });
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
    const remaining = round2(order.totalTTC - order.amountPaid);
    if (amount > remaining + 0.01) return bad(res, `This is more than what's left to pay (${remaining})`);

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
