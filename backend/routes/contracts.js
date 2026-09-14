const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Contract = require("../models/Contract");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");

router.use(auth, requireHRAccess);

const canManage = (req, company) => canAccessHRForCompany(req.user, company);

// ======================================================
// GET ALL CONTRACTS
// GET /api/contracts?companyId=&employeeId=&status=&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId, employeeId, status, page = 1, limit = 20 } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (!canManage(req, company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view contracts for this company",
      });
    }

    const filter = { company: companyId };
    if (employeeId) filter.employee = employeeId;
    if (status) filter.status = status;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const [contracts, total] = await Promise.all([
      Contract.find(filter)
        .populate("employee", "firstName lastName employeeNumber jobTitle photo")
        .sort({ startDate: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      Contract.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: contracts,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET contracts error:", error);
    res.status(500).json({ success: false, message: "Error fetching contracts", error: error.message });
  }
});

// ======================================================
// GET CONTRACTS EXPIRING SOON
// GET /api/contracts/expiring?companyId=&withinDays=30
// ======================================================

router.get("/expiring", async (req, res) => {
  try {
    const { companyId, withinDays = 30 } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (!canManage(req, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + Number(withinDays));

    const contracts = await Contract.find({
      company: companyId,
      status: "active",
      endDate: { $ne: null, $gte: now, $lte: horizon },
    })
      .populate("employee", "firstName lastName employeeNumber jobTitle photo")
      .sort({ endDate: 1 });

    res.json({ success: true, data: contracts });
  } catch (error) {
    console.error("GET expiring contracts error:", error);
    res.status(500).json({ success: false, message: "Error fetching expiring contracts", error: error.message });
  }
});

// ======================================================
// CREATE CONTRACT
// POST /api/contracts
// ======================================================

router.post("/", async (req, res) => {
  try {
    const { company, employee, type, startDate, endDate, jobTitle, department, document, notes } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!employee || !mongoose.Types.ObjectId.isValid(employee)) {
      return res.status(400).json({ success: false, message: "A valid employee is required" });
    }
    if (!type || !startDate) {
      return res.status(400).json({ success: false, message: "Type and start date are required" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, companyDoc)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const employeeDoc = await Employee.findOne({ _id: employee, company });
    if (!employeeDoc) {
      return res.status(404).json({ success: false, message: "Employee not found in this company" });
    }

    const contract = await Contract.create({
      company,
      employee,
      type,
      startDate,
      endDate: endDate || null,
      jobTitle,
      department,
      document,
      notes,
      status: "active",
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const populated = await contract.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "Contract",
      resourceId: contract._id,
      resourceLabel: `${type} — ${startDate}`,
      after: contract.toObject(),
    });

    res.status(201).json({ success: true, data: populated, message: "Contract created successfully" });
  } catch (error) {
    console.error("POST contract error:", error);
    res.status(500).json({ success: false, message: "Error creating contract", error: error.message });
  }
});

// ======================================================
// UPDATE CONTRACT
// PUT /api/contracts/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid contract ID" });
    }

    const contract = await Contract.findById(req.params.id).populate("company");
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }
    if (!canManage(req, contract.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const before = contract.toObject();

    const { type, startDate, endDate, jobTitle, department, document, notes, status } = req.body;
    if (type !== undefined) contract.type = type;
    if (startDate !== undefined) contract.startDate = startDate;
    if (endDate !== undefined) contract.endDate = endDate;
    if (jobTitle !== undefined) contract.jobTitle = jobTitle;
    if (department !== undefined) contract.department = department;
    if (document !== undefined) contract.document = document;
    if (notes !== undefined) contract.notes = notes;
    if (status !== undefined) contract.status = status;

    contract.updatedBy = req.user.id;
    await contract.save();

    const populated = await contract.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    await logAudit(req, {
      company: contract.company._id,
      action: "update",
      resourceType: "Contract",
      resourceId: contract._id,
      before,
      after: contract.toObject(),
    });

    res.json({ success: true, data: populated, message: "Contract updated successfully" });
  } catch (error) {
    console.error("PUT contract error:", error);
    res.status(500).json({ success: false, message: "Error updating contract", error: error.message });
  }
});

// ======================================================
// RENEW CONTRACT
// POST /api/contracts/:id/renew
// body: { startDate, endDate }
// Closes the current contract (status -> "renewed") and creates a
// new one referencing it, incrementing renewalCount.
// ======================================================

router.post("/:id/renew", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid contract ID" });
    }

    const { startDate, endDate, type } = req.body;
    if (!startDate) {
      return res.status(400).json({ success: false, message: "New start date is required" });
    }

    const previous = await Contract.findById(req.params.id).populate("company");
    if (!previous) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }
    if (!canManage(req, previous.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    previous.status = "renewed";
    previous.updatedBy = req.user.id;
    await previous.save();

    const renewed = await Contract.create({
      company: previous.company._id,
      employee: previous.employee,
      type: type || previous.type,
      startDate,
      endDate: endDate || null,
      jobTitle: previous.jobTitle,
      department: previous.department,
      status: "active",
      renewalCount: (previous.renewalCount || 0) + 1,
      previousContract: previous._id,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const populated = await renewed.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    await logAudit(req, {
      company: previous.company._id,
      action: "create",
      resourceType: "Contract",
      resourceId: renewed._id,
      resourceLabel: `Renewal of ${previous._id}`,
      after: renewed.toObject(),
    });

    res.status(201).json({ success: true, data: populated, message: "Contract renewed successfully" });
  } catch (error) {
    console.error("POST renew contract error:", error);
    res.status(500).json({ success: false, message: "Error renewing contract", error: error.message });
  }
});

// ======================================================
// DELETE CONTRACT
// DELETE /api/contracts/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid contract ID" });
    }

    const contract = await Contract.findById(req.params.id).populate("company");
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }
    if (!canManage(req, contract.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await Contract.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: contract.company._id,
      action: "delete",
      resourceType: "Contract",
      resourceId: contract._id,
      before: contract.toObject(),
    });

    res.json({ success: true, message: "Contract deleted successfully", contractId: contract._id });
  } catch (error) {
    console.error("DELETE contract error:", error);
    res.status(500).json({ success: false, message: "Error deleting contract", error: error.message });
  }
});

module.exports = router;
