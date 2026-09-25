const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");
const Company = require("../models/Company");
const multer = require("multer");
const { uploadFile, deleteFile } = require("../services/cloudinaryService");
const { supplierStatement } = require("../services/purchasingReports");
const { statementXlsx } = require("../services/purchasingExports");
const auth = require("../middleware/auth");
const { requirePurchasingAccess, requireInventoryViewAccess } = require("../middleware/permissionMiddleware");

// Suppliers (fournisseurs) — purchasing module. Production may READ the
// list (to pick a supplier for an article's prices in the inventory);
// creating/editing suppliers stays with purchasing.
router.use(auth);

const FIELDS = ["name", "contactName", "email", "phone", "address", "city", "ice", "identifiantFiscal", "rc", "paymentTerms", "paymentDays", "notes", "isActive"];
const pick = (body) => Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/suppliers?companyId=&search=&active=true
router.get("/", requireInventoryViewAccess, async (req, res) => {
  try {
    const { companyId, search, active } = req.query;
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "A valid companyId is required" });
    }
    const filter = { company: companyId };
    if (active === "true") filter.isActive = true;
    if (search) {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ name: rx }, { contactName: rx }, { email: rx }, { phone: rx }, { city: rx }, { ice: rx }];
    }
    const suppliers = await Supplier.find(filter).sort({ name: 1 }).limit(500);
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching suppliers", error: error.message });
  }
});

router.get("/:id", requirePurchasingAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching supplier", error: error.message });
  }
});

router.post("/", requirePurchasingAccess, async (req, res) => {
  try {
    const { company } = req.body;
    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    const supplier = await Supplier.create({ ...pick(req.body), company, createdBy: req.user.id, updatedBy: req.user.id });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: error.name === "ValidationError" ? Object.values(error.errors)[0].message : "Error creating supplier", error: error.message });
  }
});

router.put("/:id", requirePurchasingAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    Object.assign(supplier, pick(req.body), { updatedBy: req.user.id });
    await supplier.save();
    res.json({ success: true, data: supplier });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: error.name === "ValidationError" ? Object.values(error.errors)[0].message : "Error updating supplier", error: error.message });
  }
});

// ======================================================
// STATEMENT (relevé fournisseur)  GET /api/suppliers/:id/statement?from=&to=&format=xlsx|json
// Invoices, credit notes and payments with a running balance.
// ======================================================
router.get("/:id/statement", requirePurchasingAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    const { from, to, format } = req.query;
    const orders = await PurchaseOrder.find({ supplier: supplier._id, status: { $ne: "cancelled" } })
      .select("number status invoices payments").lean();
    const statement = supplierStatement(orders, { from, to });
    if (format !== "xlsx") return res.json({ success: true, data: statement });
    const company = await Company.findById(supplier.company).select("name");
    const buffer = await statementXlsx(statement, { company, supplier, from, to });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="releve-fournisseur.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error("GET supplier statement error:", error);
    res.status(500).json({ success: false, message: "Error building the supplier statement", error: error.message });
  }
});

// ======================================================
// SUPPLIER DOCUMENTS (attestation fiscale, RC, CNSS, RIB...)
// POST   /api/suppliers/:id/documents  (multipart: file?, type, label?, number?, issueDate?, expiryDate?)
// DELETE /api/suppliers/:id/documents/:docId
// ======================================================
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Upload a PDF or an image (JPG, PNG, WEBP)"), ok);
  },
});
const DOC_TYPES = ["attestation_fiscale", "rc", "cnss", "rib", "patente", "other"];

router.post("/:id/documents", requirePurchasingAccess, (req, res, next) =>
  uploadDoc.single("file")(req, res, (err) => (err ? res.status(400).json({ success: false, message: err.message }) : next())), async (req, res) => {
  try {
    const supplier = mongoose.Types.ObjectId.isValid(req.params.id) ? await Supplier.findById(req.params.id) : null;
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    const { type, label, number, issueDate, expiryDate } = req.body;
    if (!DOC_TYPES.includes(type)) return res.status(400).json({ success: false, message: "Choose a document type" });
    let file;
    if (req.file) {
      const up = await uploadFile(req.file.buffer, `purchasing/${supplier.company}/suppliers`, req.file.originalname, req.file.mimetype);
      file = { url: up.secure_url, publicId: up.public_id, originalName: req.file.originalname };
    }
    supplier.documents.push({ type, label, number, issueDate: issueDate || null, expiryDate: expiryDate || null, file, uploadedBy: req.user.id });
    supplier.updatedBy = req.user.id;
    await supplier.save();
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    console.error("POST supplier document error:", error);
    res.status(500).json({ success: false, message: "Error adding the document", error: error.message });
  }
});

router.delete("/:id/documents/:docId", requirePurchasingAccess, async (req, res) => {
  try {
    const supplier = mongoose.Types.ObjectId.isValid(req.params.id) ? await Supplier.findById(req.params.id) : null;
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    const doc = supplier.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });
    if (doc.file?.publicId) await deleteFile(doc.file.publicId).catch(() => {});
    doc.deleteOne();
    await supplier.save();
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting the document", error: error.message });
  }
});

// A supplier with orders is deactivated, never deleted — the order
// history must keep pointing at a real supplier.
router.delete("/:id", requirePurchasingAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    const orderCount = await PurchaseOrder.countDocuments({ supplier: supplier._id });
    if (orderCount > 0) {
      supplier.isActive = false;
      supplier.updatedBy = req.user.id;
      await supplier.save();
      return res.json({ success: true, deactivated: true, message: `This supplier has ${orderCount} order(s), so it was deactivated instead of deleted.` });
    }
    await supplier.deleteOne();
    res.json({ success: true, message: "Supplier deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting supplier", error: error.message });
  }
});

module.exports = router;
