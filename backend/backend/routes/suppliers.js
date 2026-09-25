const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");
const auth = require("../middleware/auth");
const { requirePurchasingAccess } = require("../middleware/permissionMiddleware");

// Suppliers (fournisseurs) — purchasing module.
router.use(auth, requirePurchasingAccess);

const FIELDS = ["name", "contactName", "email", "phone", "address", "city", "ice", "identifiantFiscal", "rc", "paymentTerms", "notes", "isActive"];
const pick = (body) => Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/suppliers?companyId=&search=&active=true
router.get("/", async (req, res) => {
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

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching supplier", error: error.message });
  }
});

router.post("/", async (req, res) => {
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

router.put("/:id", async (req, res) => {
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

// A supplier with orders is deactivated, never deleted — the order
// history must keep pointing at a real supplier.
router.delete("/:id", async (req, res) => {
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
