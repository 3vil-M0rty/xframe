const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Department = require("../models/Department");
const JobPosition = require("../models/JobPosition");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { canManageCompany } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");

router.use(auth);

const canManage = (req, company) => canManageCompany(req.user, company);

// ======================================================
// GET ALL DEPARTMENTS
// GET /api/departments?companyId=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId } = req.query;

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

    const departments = await Department.find({ company: companyId }).sort({ name: 1 });

    res.json({ success: true, data: departments });
  } catch (error) {
    console.error("GET departments error:", error);
    res.status(500).json({ success: false, message: "Error fetching departments", error: error.message });
  }
});

// ======================================================
// CREATE DEPARTMENT
// POST /api/departments
// ======================================================

router.post("/", async (req, res) => {
  try {
    const { company, name, description, permissionKey } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, companyDoc)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const department = await Department.create({
      company,
      name,
      description,
      permissionKey: permissionKey || null,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "Department",
      resourceId: department._id,
      resourceLabel: name,
      after: department.toObject(),
    });

    res.status(201).json({ success: true, data: department, message: "Department created successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A department with this name already exists, or another department already has this permission key",
      });
    }
    console.error("POST department error:", error);
    res.status(500).json({ success: false, message: "Error creating department", error: error.message });
  }
});

// ======================================================
// UPDATE DEPARTMENT
// PUT /api/departments/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findById(req.params.id).populate("company");
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }
    if (!canManage(req, department.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const before = department.toObject();

    const { name, description, permissionKey } = req.body;
    if (name !== undefined) department.name = name;
    if (description !== undefined) department.description = description;
    if (permissionKey !== undefined) department.permissionKey = permissionKey || null;
    department.updatedBy = req.user.id;

    await department.save();

    await logAudit(req, {
      company: department.company._id,
      action: "update",
      resourceType: "Department",
      resourceId: department._id,
      before,
      after: department.toObject(),
    });

    res.json({ success: true, data: department, message: "Department updated successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A department with this name already exists, or another department already has this permission key",
      });
    }
    console.error("PUT department error:", error);
    res.status(500).json({ success: false, message: "Error updating department", error: error.message });
  }
});

// ======================================================
// DELETE DEPARTMENT
// DELETE /api/departments/:id
// Refuses if any employee or job position still references it.
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findById(req.params.id).populate("company");
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }
    if (!canManage(req, department.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const [employeeCount, positionCount] = await Promise.all([
      Employee.countDocuments({ department: department._id }),
      JobPosition.countDocuments({ department: department._id }),
    ]);

    if (employeeCount > 0 || positionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This department still has ${employeeCount} employee(s) and ${positionCount} position(s) — reassign or remove them first.`,
      });
    }

    await Department.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: department.company._id,
      action: "delete",
      resourceType: "Department",
      resourceId: department._id,
      resourceLabel: department.name,
      before: department.toObject(),
    });

    res.json({ success: true, message: "Department deleted successfully", departmentId: department._id });
  } catch (error) {
    console.error("DELETE department error:", error);
    res.status(500).json({ success: false, message: "Error deleting department", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (name, description) — fr/en/ar
// ======================================================

attachTranslationRoutes(router, Department, {
  resourceType: "Department",
  authorize: async (req, doc) => {
    const company = await Company.findById(doc.company);
    return canManage(req, company);
  },
});

module.exports = router;
