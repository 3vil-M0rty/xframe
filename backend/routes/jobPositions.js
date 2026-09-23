const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const JobPosition = require("../models/JobPosition");
const { resyncUsersForPosition } = require("../services/employeeAccountService");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { canManageCompany } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");

router.use(auth);

const canManage = (req, company) => canManageCompany(req.user, company);

// ======================================================
// GET ALL JOB POSITIONS
// GET /api/job-positions?companyId=&department=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId, department } = req.query;

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

    const filter = { company: companyId };
    if (department) filter.department = department;

    const positions = await JobPosition.find(filter)
      .populate("department", "name translations")
      .populate("reportsTo", "title")
      .sort({ title: 1 });

    res.json({ success: true, data: positions });
  } catch (error) {
    console.error("GET job positions error:", error);
    res.status(500).json({ success: false, message: "Error fetching job positions", error: error.message });
  }
});

// ======================================================
// CREATE JOB POSITION
// POST /api/job-positions
// ======================================================

router.post("/", async (req, res) => {
  try {
    const {
      company, department, title, description,
      salaryBandMin, salaryBandMax, currency, requiredSkills, reportsTo,
      grantsModuleAccess,
    } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!department || !mongoose.Types.ObjectId.isValid(department)) {
      return res.status(400).json({ success: false, message: "A valid department is required" });
    }
    if (!title) {
      return res.status(400).json({ success: false, message: "Position title is required" });
    }
    if (
      salaryBandMin != null && salaryBandMax != null &&
      Number(salaryBandMin) > Number(salaryBandMax)
    ) {
      return res.status(400).json({ success: false, message: "The minimum salary band cannot exceed the maximum" });
    }

    const [companyDoc, departmentDoc] = await Promise.all([
      Company.findById(company),
      Department.findOne({ _id: department, company }),
    ]);

    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!departmentDoc) {
      return res.status(404).json({ success: false, message: "Department not found in this company" });
    }
    if (!canManage(req, companyDoc)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (reportsTo) {
      const reportsToDoc = await JobPosition.findOne({ _id: reportsTo, company });
      if (!reportsToDoc) {
        return res.status(404).json({ success: false, message: "The selected reporting position was not found" });
      }
    }

    const position = await JobPosition.create({
      company,
      department,
      title,
      description,
      salaryBandMin: salaryBandMin === "" ? null : salaryBandMin,
      salaryBandMax: salaryBandMax === "" ? null : salaryBandMax,
      currency: currency || "MAD",
      requiredSkills: requiredSkills || [],
      reportsTo: reportsTo || null,
      grantsModuleAccess: !!grantsModuleAccess,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const populated = await position.populate([
      { path: "department", select: "name" },
      { path: "reportsTo", select: "title" },
    ]);

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "JobPosition",
      resourceId: position._id,
      resourceLabel: title,
      after: position.toObject(),
    });

    res.status(201).json({ success: true, data: populated, message: "Job position created successfully" });
  } catch (error) {
    console.error("POST job position error:", error);
    res.status(500).json({ success: false, message: "Error creating job position", error: error.message });
  }
});

// ======================================================
// UPDATE JOB POSITION
// PUT /api/job-positions/:id
// ======================================================

// ======================================================
// SET A POSITION'S MODULE ACCESS
// PATCH /api/job-positions/:id/access   body: { grantsModuleAccess }
// ======================================================
// The one thing a department manager may change here: which of their
// department's positions unlock the module. Admin/owner can too.
// Everyone currently holding the position is re-synced immediately.

router.patch("/:id/access", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid position ID" });
    }
    if (typeof req.body.grantsModuleAccess !== "boolean") {
      return res.status(400).json({ success: false, message: "grantsModuleAccess must be true or false" });
    }

    const position = await JobPosition.findById(req.params.id).populate("company");
    if (!position) return res.status(404).json({ success: false, message: "Position not found" });

    const managesDepartment = (req.user.managedDepartments || []).some((id) => String(id) === String(position.department));
    if (!canManage(req, position.company) && !managesDepartment) {
      return res.status(403).json({ success: false, message: "Only the department's manager (or an admin/owner) can change this" });
    }

    const changed = position.grantsModuleAccess !== req.body.grantsModuleAccess;
    position.grantsModuleAccess = req.body.grantsModuleAccess;
    position.updatedBy = req.user.id;
    await position.save();

    let usersUpdated = 0;
    if (changed) {
      try {
        usersUpdated = await resyncUsersForPosition(position.department, [position.title]);
      } catch (syncError) {
        console.error("Failed to re-sync users for position:", syncError);
      }
    }

    res.json({ success: true, data: { _id: position._id, grantsModuleAccess: position.grantsModuleAccess }, usersUpdated });
  } catch (error) {
    console.error("PATCH position access error:", error);
    res.status(500).json({ success: false, message: "Error updating position access", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid job position ID" });
    }

    const position = await JobPosition.findById(req.params.id).populate("company");
    if (!position) {
      return res.status(404).json({ success: false, message: "Job position not found" });
    }
    if (!canManage(req, position.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // A position can't (transitively) report to itself.
    const { reportsTo } = req.body;
    if (reportsTo && String(reportsTo) === String(position._id)) {
      return res.status(400).json({ success: false, message: "A position cannot report to itself" });
    }

    const before = position.toObject();

    const {
      department, title, description,
      salaryBandMin, salaryBandMax, currency, requiredSkills, isActive,
      grantsModuleAccess,
    } = req.body;

    if (department !== undefined) position.department = department;
    if (title !== undefined) position.title = title;
    if (description !== undefined) position.description = description;
    if (salaryBandMin !== undefined) position.salaryBandMin = salaryBandMin === "" ? null : salaryBandMin;
    if (salaryBandMax !== undefined) position.salaryBandMax = salaryBandMax === "" ? null : salaryBandMax;
    if (currency !== undefined) position.currency = currency;
    if (requiredSkills !== undefined) position.requiredSkills = requiredSkills;
    if (reportsTo !== undefined) position.reportsTo = reportsTo || null;
    if (isActive !== undefined) position.isActive = isActive;
    if (grantsModuleAccess !== undefined) position.grantsModuleAccess = !!grantsModuleAccess;

    if (
      position.salaryBandMin != null && position.salaryBandMax != null &&
      position.salaryBandMin > position.salaryBandMax
    ) {
      return res.status(400).json({ success: false, message: "The minimum salary band cannot exceed the maximum" });
    }

    position.updatedBy = req.user.id;
    await position.save();

    // Flipping grantsModuleAccess (or renaming the position) changes
    // what everyone currently holding it may do — re-sync their
    // logins now so it takes effect immediately.
    if (before.grantsModuleAccess !== position.grantsModuleAccess || before.title !== position.title) {
      try {
        await resyncUsersForPosition(position.department, [before.title, position.title]);
      } catch (syncError) {
        console.error("Failed to re-sync users for position:", syncError);
      }
    }

    const populated = await position.populate([
      { path: "department", select: "name" },
      { path: "reportsTo", select: "title" },
    ]);

    await logAudit(req, {
      company: position.company._id,
      action: "update",
      resourceType: "JobPosition",
      resourceId: position._id,
      before,
      after: position.toObject(),
    });

    res.json({ success: true, data: populated, message: "Job position updated successfully" });
  } catch (error) {
    console.error("PUT job position error:", error);
    res.status(500).json({ success: false, message: "Error updating job position", error: error.message });
  }
});

// ======================================================
// DELETE JOB POSITION
// DELETE /api/job-positions/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid job position ID" });
    }

    const position = await JobPosition.findById(req.params.id).populate("company");
    if (!position) {
      return res.status(404).json({ success: false, message: "Job position not found" });
    }
    if (!canManage(req, position.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const [employeeCount, reportCount] = await Promise.all([
      Employee.countDocuments({ jobPosition: position._id }),
      JobPosition.countDocuments({ reportsTo: position._id }),
    ]);

    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `${employeeCount} employee(s) currently hold this position — reassign them first.`,
      });
    }
    if (reportCount > 0) {
      return res.status(400).json({
        success: false,
        message: `${reportCount} other position(s) report to this one — reassign them first.`,
      });
    }

    await JobPosition.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: position.company._id,
      action: "delete",
      resourceType: "JobPosition",
      resourceId: position._id,
      resourceLabel: position.title,
      before: position.toObject(),
    });

    res.json({ success: true, message: "Job position deleted successfully", positionId: position._id });
  } catch (error) {
    console.error("DELETE job position error:", error);
    res.status(500).json({ success: false, message: "Error deleting job position", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (title, description) — fr/en/ar
// ======================================================
// Mirrors every other :id route in this file: only whoever can
// manage the position's company (admin, or the owning owner) may
// read/edit its translations.

attachTranslationRoutes(router, JobPosition, {
  resourceType: "JobPosition",
  authorize: async (req, doc) => {
    const company = await Company.findById(doc.company);
    return canManage(req, company);
  },
});

module.exports = router;
