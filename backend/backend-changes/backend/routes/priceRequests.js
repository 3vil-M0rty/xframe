const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const router = express.Router();
const PriceRequest = require("../models/PriceRequest");
const PurchaseOrder = require("../models/PurchaseOrder");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const Company = require("../models/Company");
const { fetchLogoBuffer } = require("../services/pdfHelpers");
const { generatePriceRequestPdf } = require("../services/purchasingPdfService");
const auth = require("../middleware/auth");
const { requirePurchasingAccess } = require("../middleware/permissionMiddleware");
const { uploadFile, deleteFile } = require("../services/cloudinaryService");
const { createWithNumber } = require("../services/documentNumberService");

/**
 * PRICE REQUESTS (demandes de prix) — purchasing module.
 *   draft -> sent -> answered -> accepted (converted to a BC) | rejected
 */
router.use(auth, requirePurchasingAccess);

const uploadQuote = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Upload a PDF or an image (JPG, PNG, WEBP)"), ok);
  },
});

const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const POPULATE = [
  { path: "supplier", select: "name contactName email phone" },
  { path: "lines.product", select: "name internalReference unit" },
  { path: "purchaseOrder", select: "number status" },
];

async function normalizeLines(rawLines, companyId) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return { error: "Add at least one line" };
  const lines = [];
  for (const raw of rawLines) {
    const quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Every line needs a quantity greater than zero" };
    let description = String(raw.description || "").trim();
    let unit = raw.unit;
    let product = null;
    if (raw.product) {
      if (!isId(raw.product)) return { error: "Invalid article on a line" };
      // eslint-disable-next-line no-await-in-loop
      const doc = await Product.findOne({ _id: raw.product, company: companyId }).select("name unit");
      if (!doc) return { error: "An article doesn't belong to this company" };
      product = doc._id;
      description = description || doc.name;
      unit = unit || doc.unit;
    }
    if (!description) return { error: "Every line needs a description or an article" };
    const quoted = raw.quotedUnitPrice === "" || raw.quotedUnitPrice === undefined || raw.quotedUnitPrice === null
      ? null : Number(raw.quotedUnitPrice);
    if (quoted !== null && (!Number.isFinite(quoted) || quoted < 0)) return { error: "Invalid quoted price" };
    lines.push({ product, description, quantity, unit, quotedUnitPrice: quoted, vatRate: raw.vatRate === undefined || raw.vatRate === "" ? 20 : Number(raw.vatRate) });
  }
  return { lines };
}

router.get("/", async (req, res) => {
  try {
    const { companyId, status, supplier } = req.query;
    if (!companyId || !isId(companyId)) return bad(res, "A valid companyId is required");
    const filter = { company: companyId };
    if (status) filter.status = { $in: String(status).split(",") };
    if (supplier && isId(supplier)) filter.supplier = supplier;
    const data = await PriceRequest.find(filter).populate(POPULATE).sort({ date: -1, number: -1 }).limit(300);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching price requests", error: error.message });
  }
});

// PDF  GET /api/price-requests/:id/pdf — the demande de prix to send
// Streams the document inline. The browser-side filename is set by the
// frontend (downloadBlob); this header name is only an ASCII fallback.
router.get("/:id/pdf", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid price request ID");
    const priceRequest = await PriceRequest.findById(req.params.id)
      .populate("supplier")
      .populate("lines.product", "name internalReference unit prices");
    if (!priceRequest) return bad(res, "Price request not found", 404);
    const company = await Company.findById(priceRequest.company);
    if (!company) return bad(res, "Company not found", 404);

    const logoBuffer = await fetchLogoBuffer(company);
    const doc = generatePriceRequestPdf({ priceRequest, company, supplier: priceRequest.supplier, logoBuffer });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${priceRequest.number}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("GET price request PDF error:", error);
    res.status(500).json({ success: false, message: "Error generating the price request PDF", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const doc = isId(req.params.id) ? await PriceRequest.findById(req.params.id).populate(POPULATE) : null;
    if (!doc) return bad(res, "Price request not found", 404);
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching price request", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { company, supplier, date, responseDeadline, notes } = req.body;
    if (!company || !isId(company)) return bad(res, "A valid company is required");
    if (!supplier || !isId(supplier) || !(await Supplier.exists({ _id: supplier, company }))) return bad(res, "Choose a supplier of this company");
    const { lines, error } = await normalizeLines(req.body.lines, company);
    if (error) return bad(res, error);
    const doc = await createWithNumber(PriceRequest, {
      company, supplier, date: date || new Date(), responseDeadline: responseDeadline || null, lines, notes,
      purchaseRequests: (req.body.purchaseRequestIds || []).filter(isId),
      createdBy: req.user.id, updatedBy: req.user.id,
    }, "DP");
    res.status(201).json({ success: true, data: await PriceRequest.findById(doc._id).populate(POPULATE) });
  } catch (error) {
    console.error("POST price request error:", error);
    res.status(500).json({ success: false, message: "Error creating price request", error: error.message });
  }
});

// Edit lines (including the quoted prices once the supplier answers),
// header, and move draft -> sent -> answered, or reject.
router.put("/:id", async (req, res) => {
  try {
    const doc = isId(req.params.id) ? await PriceRequest.findById(req.params.id) : null;
    if (!doc) return bad(res, "Price request not found", 404);
    if (["accepted", "rejected"].includes(doc.status)) return bad(res, "This price request is closed");

    if (req.body.lines !== undefined) {
      const { lines, error } = await normalizeLines(req.body.lines, doc.company);
      if (error) return bad(res, error);
      doc.lines = lines;
    }
    for (const f of ["date", "responseDeadline", "notes"]) if (req.body[f] !== undefined) doc[f] = req.body[f] || (f === "notes" ? "" : null);
    if (req.body.status !== undefined) {
      if (!["draft", "sent", "answered", "rejected"].includes(req.body.status)) return bad(res, "Invalid status");
      doc.status = req.body.status;
    }
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json({ success: true, data: await PriceRequest.findById(doc._id).populate(POPULATE) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating price request", error: error.message });
  }
});

// Attach the supplier's quote (PDF / image).
router.post("/:id/quote-file", (req, res, next) =>
  uploadQuote.single("file")(req, res, (err) => (err ? bad(res, err.message) : next())), async (req, res) => {
  try {
    const doc = isId(req.params.id) ? await PriceRequest.findById(req.params.id) : null;
    if (!doc) return bad(res, "Price request not found", 404);
    if (!req.file) return bad(res, "No file uploaded");
    if (doc.quoteFile?.publicId) await deleteFile(doc.quoteFile.publicId).catch(() => {});
    const result = await uploadFile(req.file.buffer, `purchasing/${doc.company}`, req.file.originalname, req.file.mimetype);
    doc.quoteFile = { url: result.secure_url, publicId: result.public_id, originalName: req.file.originalname };
    if (doc.status === "sent" || doc.status === "draft") doc.status = "answered";
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json({ success: true, data: await PriceRequest.findById(doc._id).populate(POPULATE) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error uploading the quote", error: error.message });
  }
});

// Turn an answered request into a draft purchase order at the quoted prices.
router.post("/:id/convert", async (req, res) => {
  try {
    const doc = isId(req.params.id) ? await PriceRequest.findById(req.params.id) : null;
    if (!doc) return bad(res, "Price request not found", 404);
    if (["accepted", "rejected"].includes(doc.status)) return bad(res, "This price request is closed");
    const unpriced = doc.lines.filter((l) => l.quotedUnitPrice === null || l.quotedUnitPrice === undefined);
    if (unpriced.length) return bad(res, `Enter the quoted price for every line first (${unpriced.map((l) => l.description).join(", ")})`);

    const order = await createWithNumber(PurchaseOrder, {
      company: doc.company,
      supplier: doc.supplier,
      date: new Date(),
      lines: doc.lines.map((l) => ({ product: l.product, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.quotedUnitPrice, vatRate: l.vatRate })),
      notes: `Selon demande de prix ${doc.number}`,
      priceRequest: doc._id,
      status: "draft",
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }, "BC");

    doc.status = "accepted";
    doc.purchaseOrder = order._id;
    doc.updatedBy = req.user.id;
    await doc.save();
    res.status(201).json({ success: true, data: { priceRequest: await PriceRequest.findById(doc._id).populate(POPULATE), purchaseOrderId: order._id, purchaseOrderNumber: order.number } });
  } catch (error) {
    console.error("POST price request convert error:", error);
    res.status(500).json({ success: false, message: "Error converting to a purchase order", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const doc = isId(req.params.id) ? await PriceRequest.findById(req.params.id) : null;
    if (!doc) return bad(res, "Price request not found", 404);
    if (doc.status === "accepted") return bad(res, "This request became a purchase order and is kept for the record");
    if (doc.quoteFile?.publicId) await deleteFile(doc.quoteFile.publicId).catch(() => {});
    await doc.deleteOne();
    res.json({ success: true, message: "Price request deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting price request", error: error.message });
  }
});

module.exports = router;
