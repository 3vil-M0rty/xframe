const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const PurchaseRequest = require("../models/PurchaseRequest");
const Product = require("../models/Product");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireProductionAccess, requireAdmin } = require("../middleware/permissionMiddleware");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");

router.use(auth, requireProductionAccess);

// ======================================================
// GET ALL PURCHASE REQUESTS
// GET /api/purchase-requests?companyId=&status=&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId, status, page = 1, limit = 20 } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const filter = { company: companyId };
    if (status) filter.status = status;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const [requests, total] = await Promise.all([
      PurchaseRequest.find(filter)
        .populate("product", "name internalReference image unit translations")
        .populate("requestedBy", "firstName lastName")
        .populate("reviewedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      PurchaseRequest.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET purchase requests error:", error);
    res.status(500).json({ success: false, message: "Error fetching purchase requests", error: error.message });
  }
});

// ======================================================
// CREATE PURCHASE REQUEST
// POST /api/purchase-requests
// Admin-only — "un admin peut lancer une demande d'achat".
// ======================================================

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { company, product, requestedQuantity, notes } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!product || !mongoose.Types.ObjectId.isValid(product)) {
      return res.status(400).json({ success: false, message: "A valid product is required" });
    }
    if (!requestedQuantity || Number(requestedQuantity) <= 0) {
      return res.status(400).json({ success: false, message: "A valid requested quantity is required" });
    }

    const [companyDoc, productDoc] = await Promise.all([
      Company.findById(company),
      Product.findOne({ _id: product, company }),
    ]);

    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!productDoc) {
      return res.status(404).json({ success: false, message: "Product not found in this company" });
    }

    const request = await PurchaseRequest.create({
      company,
      product,
      requestedQuantity,
      notes,
      status: "pending",
      requestedBy: req.user.id,
    });

    const populated = await request.populate("product", "name internalReference image unit translations");

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "PurchaseRequest",
      resourceId: request._id,
      resourceLabel: `${requestedQuantity} × ${productDoc.name}`,
      after: request.toObject(),
    });

    res.status(201).json({ success: true, data: populated, message: "Purchase request submitted" });
  } catch (error) {
    console.error("POST purchase request error:", error);
    res.status(500).json({ success: false, message: "Error creating purchase request", error: error.message });
  }
});

// ======================================================
// REVIEW PURCHASE REQUEST
// PATCH /api/purchase-requests/:id/review
// body: { status: "approved" | "rejected" | "received" }
// ======================================================

router.patch("/:id/review", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase request ID" });
    }

    const { status } = req.body;
    if (!["approved", "rejected", "received"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Purchase request not found" });
    }

    request.status = status;
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    const populated = await request.populate("product", "name internalReference image unit translations");

    res.json({ success: true, data: populated, message: `Purchase request ${status}` });
  } catch (error) {
    console.error("PATCH purchase request review error:", error);
    res.status(500).json({ success: false, message: "Error reviewing purchase request", error: error.message });
  }
});

// ======================================================
// DELETE PURCHASE REQUEST
// DELETE /api/purchase-requests/:id
// ======================================================

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase request ID" });
    }

    const request = await PurchaseRequest.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Purchase request not found" });
    }

    res.json({ success: true, message: "Purchase request deleted", requestId: request._id });
  } catch (error) {
    console.error("DELETE purchase request error:", error);
    res.status(500).json({ success: false, message: "Error deleting purchase request", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (notes) — see config/i18nContent.js
// ======================================================

attachTranslationRoutes(router, PurchaseRequest, { resourceType: "PurchaseRequest" });

module.exports = router;
