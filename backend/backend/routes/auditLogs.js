const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const AuditLog = require("../models/AuditLog");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const {
  requireHRAccess,
  requireAdmin,
} = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");

router.use(auth, requireHRAccess);

// ======================================================
// LIST AUDIT LOG ENTRIES
// GET /api/audit-logs?companyId=&resourceType=&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId, resourceType, from, to, page = 1, limit = 30 } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canAccessHRForCompany(req.user, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const filter = { company: companyId };
    if (resourceType) filter.resourceType = resourceType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        // Include the whole "to" day, not just up to midnight.
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actor", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET audit logs error:", error);
    res.status(500).json({ success: false, message: "Error fetching audit logs", error: error.message });
  }
});

// ======================================================
// DELETE AN AUDIT LOG ENTRY
// DELETE /api/audit-logs/:id
// Admin-only — the audit log is meant to be an append-only trail;
// this exists as an explicit escape hatch (e.g. to remove a test/
// junk entry), not a normal part of HR workflows.
// ======================================================

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid audit log ID" });
    }

    const entry = await AuditLog.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Audit log entry not found" });
    }

    await AuditLog.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Audit log entry deleted", entryId: entry._id });
  } catch (error) {
    console.error("DELETE audit log error:", error);
    res.status(500).json({ success: false, message: "Error deleting audit log entry", error: error.message });
  }
});

module.exports = router;
