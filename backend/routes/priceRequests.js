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
const { sendMail, pdfToBuffer, isEmail } = require("../services/mailService");
const crypto = require("crypto");
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

// COMPARE  GET /api/price-requests/compare/:group
// The same request sent to several suppliers, side by side: per line,
// each supplier's quoted price, the cheapest flagged; totals per supplier.
router.get("/compare/:group", async (req, res) => {
  try {
    const docs = await PriceRequest.find({ comparisonGroup: req.params.group }).populate(POPULATE).sort({ number: 1 });
    if (!docs.length) return bad(res, "Comparison not found", 404);
    const lineCount = Math.max(...docs.map((d) => d.lines.length));
    const lines = [];
    for (let i = 0; i < lineCount; i += 1) {
      const ref = docs[0].lines[i];
      const quotes = docs.map((d) => ({ priceRequestId: d._id, supplier: d.supplier?.name, unitPrice: d.lines[i]?.quotedUnitPrice ?? null }));
      const priced = quotes.filter((q) => q.unitPrice !== null);
      const best = priced.length ? Math.min(...priced.map((q) => q.unitPrice)) : null;
      lines.push({ description: ref?.description, quantity: ref?.quantity, unit: ref?.unit,
        quotes: quotes.map((q) => ({ ...q, best: best !== null && q.unitPrice === best })) });
    }
    const totals = docs.map((d) => {
      const complete = d.lines.every((l) => l.quotedUnitPrice !== null && l.quotedUnitPrice !== undefined);
      const ht = d.lines.reduce((s, l) => s + (l.quotedUnitPrice || 0) * l.quantity, 0);
      const ttc = d.lines.reduce((s, l) => s + (l.quotedUnitPrice || 0) * l.quantity * (1 + (l.vatRate || 0) / 100), 0);
      return { priceRequestId: d._id, number: d.number, supplier: d.supplier?.name, status: d.status, complete,
        totalHT: Math.round(ht * 100) / 100, totalTTC: Math.round(ttc * 100) / 100 };
    });
    const completeTotals = totals.filter((t) => t.complete);
    const cheapest = completeTotals.length ? completeTotals.reduce((a, b) => (b.totalTTC < a.totalTTC ? b : a)) : null;
    res.json({ success: true, data: { group: req.params.group, lines, totals, cheapestId: cheapest?.priceRequestId || null } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error building the comparison", error: error.message });
  }
});

// EMAIL  POST /api/price-requests/:id/email  { to, cc?, message? } — PDF attached
router.post("/:id/email", async (req, res) => {
  try {
    const doc = isId(req.params.id) ? await PriceRequest.findById(req.params.id).populate("supplier").populate("lines.product", "name internalReference unit prices") : null;
    if (!doc) return bad(res, "Price request not found", 404);
    if (["accepted", "rejected"].includes(doc.status)) return bad(res, "This price request is closed");
    const to = String(req.body?.to || "").trim();
    const cc = String(req.body?.cc || "").trim();
    if (!isEmail(to)) return bad(res, "Enter a valid recipient email");
    if (cc && !cc.split(",").every((x) => isEmail(x))) return bad(res, "Invalid CC email");

    const company = await Company.findById(doc.company);
    const logoBuffer = await fetchLogoBuffer(company);
    const pdf = await pdfToBuffer(generatePriceRequestPdf({ priceRequest: doc, company, supplier: doc.supplier, logoBuffer }));
    const subject = `Demande de prix ${doc.number} — ${company.name}`;
    const text = String(req.body?.message || "").trim()
      || `Bonjour,\n\nVeuillez trouver ci-joint notre demande de prix ${doc.number}.\nMerci de nous faire parvenir votre meilleure offre, avec vos délais et conditions de paiement.\n\nCordialement,\n${company.name}`;
    const result = await sendMail({ to, cc, subject, text, attachments: [{ filename: `${doc.number}.pdf`, content: pdf, contentType: "application/pdf" }] },
      { company: company._id, relatedType: "PriceRequest", relatedId: doc._id, sentBy: req.user.id });
    doc.emails.push({ to, cc, subject, by: req.user.id, simulated: result.status === "simulated" });
    if (doc.status === "draft") doc.status = "sent";
    await doc.save();
    res.json({ success: true, simulated: result.status === "simulated", data: await PriceRequest.findById(doc._id).populate(POPULATE) });
  } catch (error) {
    console.error("POST price request email error:", error);
    res.status(502).json({ success: false, message: `The email could not be sent: ${error.message}` });
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
    const { company, date, responseDeadline, notes } = req.body;
    if (!company || !isId(company)) return bad(res, "A valid company is required");
    // One supplier (`supplier`) or several (`suppliers`): the same request
    // goes to each, as separate demandes sharing a comparison group so
    // the answers can be compared side by side.
    const supplierIds = [...new Set((Array.isArray(req.body.suppliers) ? req.body.suppliers : [req.body.supplier]).filter(Boolean).map(String))];
    if (supplierIds.length === 0) return bad(res, "Choose at least one supplier");
    if (supplierIds.some((id) => !isId(id)) || (await Supplier.countDocuments({ _id: { $in: supplierIds }, company })) !== supplierIds.length) {
      return bad(res, "Choose suppliers of this company");
    }
    const { lines, error } = await normalizeLines(req.body.lines, company);
    if (error) return bad(res, error);
    const comparisonGroup = supplierIds.length > 1 ? `CMP-${crypto.randomBytes(5).toString("hex")}` : null;

    const created = [];
    for (const supplier of supplierIds) {
      // eslint-disable-next-line no-await-in-loop
      created.push(await createWithNumber(PriceRequest, {
        company, supplier, date: date || new Date(), responseDeadline: responseDeadline || null, lines, notes, comparisonGroup,
        purchaseRequests: (req.body.purchaseRequestIds || []).filter(isId),
        createdBy: req.user.id, updatedBy: req.user.id,
      }, "DP"));
    }
    const docs = await PriceRequest.find({ _id: { $in: created.map((d) => d._id) } }).populate(POPULATE).sort({ number: 1 });
    // single supplier: keep returning the document itself (unchanged API)
    res.status(201).json({ success: true, data: docs.length === 1 ? docs[0] : docs, comparisonGroup });
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
    // choosing one supplier closes the competing quotes of the comparison
    if (doc.comparisonGroup) {
      await PriceRequest.updateMany(
        { comparisonGroup: doc.comparisonGroup, _id: { $ne: doc._id }, status: { $nin: ["accepted", "rejected"] } },
        { $set: { status: "rejected", updatedBy: req.user.id } }
      );
    }
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
