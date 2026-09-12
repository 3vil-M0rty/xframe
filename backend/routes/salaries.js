const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Salary = require("../models/Salary");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");

// Every route below the module-wide requireHRAccess check applies
// to the whole HR module. Company-level scoping for owners (an
// owner may only touch companies they own) is still checked
// per-record via canAccessHRForCompany.
router.use(auth, requireHRAccess);

const canManage = (req, company) => canAccessHRForCompany(req.user, company);

// ======================================================
// GET ALL SALARY RECORDS
// GET /api/salaries?companyId=&employeeId=&current=true&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const {
      companyId,
      employeeId,
      current,
      page = 1,
      limit = 20,
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyId",
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (!canManage(req, company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view salaries of this company",
      });
    }

    const filter = { company: companyId };

    if (employeeId) {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employeeId",
        });
      }

      filter.employee = employeeId;
    }

    // "current" = only the active salary record per employee
    // (the one with no endDate yet).
    if (current === "true") {
      filter.endDate = null;
    }

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);
    const skip = (currentPage - 1) * currentLimit;

    const [salaries, total] = await Promise.all([
      Salary.find(filter)
        .populate("employee", "firstName lastName employeeNumber jobTitle photo")
        .sort({ effectiveDate: -1 })
        .skip(skip)
        .limit(currentLimit),

      Salary.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: salaries,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET salaries error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching salaries",
      error: error.message,
    });
  }
});

// ======================================================
// GET SINGLE SALARY RECORD
// GET /api/salaries/:id
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findById(req.params.id)
      .populate("company", "name")
      .populate("employee", "firstName lastName employeeNumber jobTitle photo");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    if (!canManage(req, salary.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this salary record",
      });
    }

    res.json({ success: true, data: salary });
  } catch (error) {
    console.error("GET salary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching salary record",
      error: error.message,
    });
  }
});

// ======================================================
// CREATE SALARY RECORD (a raise / new salary period)
// POST /api/salaries
//
// Automatically closes off whichever salary record was
// previously "current" (endDate: null) for this employee, by
// setting its endDate to the new record's effectiveDate — so
// callers never manage that by hand and history is never lost.
// ======================================================

router.post("/", async (req, res) => {
  try {
    const {
      company,
      employee,
      baseSalary,
      allowances,
      deductions,
      currency,
      effectiveDate,
      notes,
    } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({
        success: false,
        message: "A valid company is required",
      });
    }

    if (!employee || !mongoose.Types.ObjectId.isValid(employee)) {
      return res.status(400).json({
        success: false,
        message: "A valid employee is required",
      });
    }

    if (baseSalary === undefined || baseSalary === null || Number(baseSalary) < 0) {
      return res.status(400).json({
        success: false,
        message: "A valid base salary is required",
      });
    }

    if (!effectiveDate) {
      return res.status(400).json({
        success: false,
        message: "Effective date is required",
      });
    }

    const companyDoc = await Company.findById(company);

    if (!companyDoc) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (!canManage(req, companyDoc)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to create a salary record for this company",
      });
    }

    const employeeDoc = await Employee.findOne({ _id: employee, company });

    if (!employeeDoc) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in this company",
      });
    }

    const newEffectiveDate = new Date(effectiveDate);

    // Close off the previously-current record, if any.
    await Salary.updateMany(
      { employee, endDate: null },
      { $set: { endDate: newEffectiveDate, updatedBy: req.user.id } }
    );

    const salary = await Salary.create({
      company,
      employee,
      baseSalary,
      allowances: allowances || [],
      deductions: deductions || [],
      currency: currency || "MAD",
      effectiveDate: newEffectiveDate,
      endDate: null,
      notes,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const populated = await salary.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    res.status(201).json({
      success: true,
      data: populated,
      message: "Salary record created successfully",
    });
  } catch (error) {
    console.error("POST salary error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating salary record",
      error: error.message,
    });
  }
});

// ======================================================
// UPDATE SALARY RECORD
// PUT /api/salaries/:id
// (Corrections to an existing record — NOT how you give a raise;
// use POST / for that so history stays intact.)
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findById(req.params.id).populate("company");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    if (!canManage(req, salary.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this salary record",
      });
    }

    const {
      baseSalary,
      allowances,
      deductions,
      currency,
      effectiveDate,
      endDate,
      notes,
    } = req.body;

    if (baseSalary !== undefined) salary.baseSalary = baseSalary;
    if (allowances !== undefined) salary.allowances = allowances;
    if (deductions !== undefined) salary.deductions = deductions;
    if (currency !== undefined) salary.currency = currency;
    if (effectiveDate !== undefined) salary.effectiveDate = effectiveDate;
    if (endDate !== undefined) salary.endDate = endDate;
    if (notes !== undefined) salary.notes = notes;

    salary.updatedBy = req.user.id;

    await salary.save();

    const populated = await salary.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    res.json({
      success: true,
      data: populated,
      message: "Salary record updated successfully",
    });
  } catch (error) {
    console.error("PUT salary error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating salary record",
      error: error.message,
    });
  }
});

// ======================================================
// DELETE SALARY RECORD
// DELETE /api/salaries/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findById(req.params.id).populate("company");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    if (!canManage(req, salary.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this salary record",
      });
    }

    await Salary.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Salary record deleted successfully",
      salaryId: salary._id,
    });
  } catch (error) {
    console.error("DELETE salary error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting salary record",
      error: error.message,
    });
  }
});

module.exports = router;
