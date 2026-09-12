const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Absence = require("../models/Absence");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");

router.use(auth, requireHRAccess);

const canManage = (req, company) => canAccessHRForCompany(req.user, company);

// Inclusive day count between two dates (ignoring time-of-day),
// halved for a half-day absence.
function computeDaysCount(startDate, endDate, halfDay) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffDays =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const days = Math.max(diffDays, halfDay ? 0.5 : 1);

  return halfDay ? Math.min(days, 0.5) : days;
}

// ======================================================
// GET ALL ABSENCES
// GET /api/absences?companyId=&employeeId=&status=&type=&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const {
      companyId,
      employeeId,
      status,
      type,
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
        message: "Not authorized to view absences of this company",
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

    if (status) filter.status = status;
    if (type) filter.type = type;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);
    const skip = (currentPage - 1) * currentLimit;

    const [absences, total] = await Promise.all([
      Absence.find(filter)
        .populate("employee", "firstName lastName employeeNumber jobTitle photo")
        .populate("reviewedBy", "firstName lastName")
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(currentLimit),

      Absence.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: absences,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET absences error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching absences",
      error: error.message,
    });
  }
});

// ======================================================
// GET SINGLE ABSENCE
// GET /api/absences/:id
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid absence ID",
      });
    }

    const absence = await Absence.findById(req.params.id)
      .populate("company", "name")
      .populate("employee", "firstName lastName employeeNumber jobTitle photo")
      .populate("reviewedBy", "firstName lastName");

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: "Absence not found",
      });
    }

    if (!canManage(req, absence.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this absence",
      });
    }

    res.json({ success: true, data: absence });
  } catch (error) {
    console.error("GET absence error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching absence",
      error: error.message,
    });
  }
});

// ======================================================
// CREATE ABSENCE REQUEST
// POST /api/absences
// ======================================================

router.post("/", async (req, res) => {
  try {
    const {
      company,
      employee,
      type,
      startDate,
      endDate,
      halfDay,
      justified,
      reason,
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

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Absence type is required",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
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
        message: "Not authorized to create an absence for this company",
      });
    }

    const employeeDoc = await Employee.findOne({ _id: employee, company });

    if (!employeeDoc) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in this company",
      });
    }

    const absence = await Absence.create({
      company,
      employee,
      type,
      startDate,
      endDate,
      halfDay: !!halfDay,
      daysCount: computeDaysCount(startDate, endDate, halfDay),
      justified: justified !== undefined ? justified : true,
      reason,
      status: "pending",
      requestedBy: req.user.id,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const populated = await absence.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    res.status(201).json({
      success: true,
      data: populated,
      message: "Absence request created successfully",
    });
  } catch (error) {
    console.error("POST absence error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating absence request",
      error: error.message,
    });
  }
});

// ======================================================
// UPDATE ABSENCE
// PUT /api/absences/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid absence ID",
      });
    }

    const absence = await Absence.findById(req.params.id).populate("company");

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: "Absence not found",
      });
    }

    if (!canManage(req, absence.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this absence",
      });
    }

    const {
      type,
      startDate,
      endDate,
      halfDay,
      justified,
      reason,
    } = req.body;

    if (type !== undefined) absence.type = type;
    if (startDate !== undefined) absence.startDate = startDate;
    if (endDate !== undefined) absence.endDate = endDate;
    if (halfDay !== undefined) absence.halfDay = halfDay;
    if (justified !== undefined) absence.justified = justified;
    if (reason !== undefined) absence.reason = reason;

    if (startDate !== undefined || endDate !== undefined || halfDay !== undefined) {
      absence.daysCount = computeDaysCount(
        absence.startDate,
        absence.endDate,
        absence.halfDay
      );
    }

    absence.updatedBy = req.user.id;

    await absence.save();

    const populated = await absence.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    res.json({
      success: true,
      data: populated,
      message: "Absence updated successfully",
    });
  } catch (error) {
    console.error("PUT absence error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating absence",
      error: error.message,
    });
  }
});

// ======================================================
// REVIEW ABSENCE (accept / reject)
// PATCH /api/absences/:id/review
// body: { status: "accepted" | "rejected", reviewComment? }
// ======================================================

router.patch("/:id/review", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid absence ID",
      });
    }

    const { status, reviewComment } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be "accepted" or "rejected"',
      });
    }

    const absence = await Absence.findById(req.params.id).populate("company");

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: "Absence not found",
      });
    }

    if (!canManage(req, absence.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this absence",
      });
    }

    absence.status = status;
    absence.reviewComment = reviewComment;
    absence.reviewedBy = req.user.id;
    absence.reviewedAt = new Date();
    absence.updatedBy = req.user.id;

    await absence.save();

    const populated = await absence
      .populate("employee", "firstName lastName employeeNumber jobTitle photo")
      .then((doc) => doc.populate("reviewedBy", "firstName lastName"));

    res.json({
      success: true,
      data: populated,
      message: `Absence ${status} successfully`,
    });
  } catch (error) {
    console.error("PATCH absence review error:", error);
    res.status(500).json({
      success: false,
      message: "Error reviewing absence",
      error: error.message,
    });
  }
});

// ======================================================
// DELETE ABSENCE
// DELETE /api/absences/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid absence ID",
      });
    }

    const absence = await Absence.findById(req.params.id).populate("company");

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: "Absence not found",
      });
    }

    if (!canManage(req, absence.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this absence",
      });
    }

    await Absence.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Absence deleted successfully",
      absenceId: absence._id,
    });
  } catch (error) {
    console.error("DELETE absence error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting absence",
      error: error.message,
    });
  }
});

module.exports = router;
