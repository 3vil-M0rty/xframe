const express = require("express");

const router = express.Router();

const AuditLog = require("../models/AuditLog");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");

router.use(auth, requireHRAccess);

// ======================================================
// LIST AUDIT LOG ENTRIES
// GET /api/audit-logs?companyId=&resourceType=&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId, resourceType, page = 1, limit = 30 } = req.query;

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

module.exports = router;
