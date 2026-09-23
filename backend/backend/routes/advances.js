const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Advance = require("../models/Advance");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const User = require("../models/User");
const Department = require("../models/Department");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const { findMatchingEmployeeIds } = require("../utils/employeeSearch");
const {
  canAccessHRForCompany,
  canReviewAdvance,
  reviewerRole,
} = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { notify, notifyMany, getHRRecipientIds } = require("../services/notificationService");

// Only auth at the router level — see routes/absences.js for why
// (the review endpoint needs to also allow a requester's manager
// through, not just full HR access).
router.use(auth);

const canManage = (req, company) => canAccessHRForCompany(req.user, company);

// ======================================================
// GET ALL ADVANCES
// GET /api/advances?companyId=&employeeId=&search=&status=&page=&limit=
// ======================================================

router.get("/", requireHRAccess, async (req, res) => {
  try {
    const {
      companyId,
      employeeId,
      search,
      status,
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
        message: "Not authorized to view advances of this company",
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
    } else if (search) {
      filter.employee = { $in: await findMatchingEmployeeIds(companyId, search) };
    }

    if (status) filter.status = status;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);
    const skip = (currentPage - 1) * currentLimit;

    const [advances, total] = await Promise.all([
      Advance.find(filter)
        .populate("employee", "firstName lastName employeeNumber jobTitle photo")
        .populate("reviewedBy", "firstName lastName")
        .sort({ requestDate: -1 })
        .skip(skip)
        .limit(currentLimit),

      Advance.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: advances,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET advances error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching advances",
      error: error.message,
    });
  }
});

// ======================================================
// GET SINGLE ADVANCE
// GET /api/advances/:id
// ======================================================

router.get("/:id", requireHRAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advance ID",
      });
    }

    const advance = await Advance.findById(req.params.id)
      .populate("company", "name")
      .populate("employee", "firstName lastName employeeNumber jobTitle photo")
      .populate("reviewedBy", "firstName lastName");

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    if (!canManage(req, advance.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this advance",
      });
    }

    res.json({ success: true, data: advance });
  } catch (error) {
    console.error("GET advance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching advance",
      error: error.message,
    });
  }
});

// ======================================================
// CREATE ADVANCE REQUEST
// POST /api/advances
// ======================================================

router.post("/", requireHRAccess, async (req, res) => {
  try {
    const { company, employee, amount, currency, requestDate, reason } =
      req.body;

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

    if (amount === undefined || amount === null || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid amount is required",
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
        message: "Not authorized to create an advance for this company",
      });
    }

    const employeeDoc = await Employee.findOne({ _id: employee, company });

    if (!employeeDoc) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in this company",
      });
    }

    const advance = await Advance.create({
      company,
      employee,
      amount,
      currency: currency || "MAD",
      requestDate: requestDate || Date.now(),
      reason,
      status: "pending",
      requestedBy: req.user.id,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const populated = await advance.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "Advance",
      resourceId: advance._id,
      resourceLabel: `${populated.employee.firstName} ${populated.employee.lastName}`,
      after: advance.toObject(),
    });

    res.status(201).json({
      success: true,
      data: populated,
      message: "Advance request created successfully",
    });
  } catch (error) {
    console.error("POST advance error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating advance request",
      error: error.message,
    });
  }
});

// ======================================================
// UPDATE ADVANCE
// PUT /api/advances/:id
// ======================================================

router.put("/:id", requireHRAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advance ID",
      });
    }

    const advance = await Advance.findById(req.params.id).populate("company");

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    if (!canManage(req, advance.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this advance",
      });
    }

    const {
      amount,
      currency,
      requestDate,
      reason,
      repaidAmount,
      repaid,
    } = req.body;

    if (amount !== undefined) advance.amount = amount;
    if (currency !== undefined) advance.currency = currency;
    if (requestDate !== undefined) advance.requestDate = requestDate;
    if (reason !== undefined) advance.reason = reason;
    if (repaidAmount !== undefined) advance.repaidAmount = repaidAmount;
    if (repaid !== undefined) advance.repaid = repaid;

    // Repaying in full also flips the `repaid` flag automatically
    // so the two fields can't drift out of sync from the UI.
    if (advance.repaidAmount >= advance.amount && advance.amount > 0) {
      advance.repaid = true;
    }

    advance.updatedBy = req.user.id;

    await advance.save();

    const populated = await advance.populate(
      "employee",
      "firstName lastName employeeNumber jobTitle photo"
    );

    res.json({
      success: true,
      data: populated,
      message: "Advance updated successfully",
    });
  } catch (error) {
    console.error("PUT advance error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating advance",
      error: error.message,
    });
  }
});

// ======================================================
// REVIEW ADVANCE (accept / reject)
// PATCH /api/advances/:id/review
// body: { status: "accepted" | "rejected", reviewComment? }
// ======================================================

router.patch("/:id/review", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advance ID",
      });
    }

    const { status: requestedStatus, reviewComment } = req.body;

    if (!["accepted", "rejected"].includes(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'status must be "accepted" or "rejected"',
      });
    }

    const advance = await Advance.findById(req.params.id)
      .populate("company")
      .populate("employee", "firstName lastName manager department");

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    if (!canReviewAdvance(req.user, advance.company, advance.employee)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this advance",
      });
    }

    if (!["pending", "manager_approved"].includes(advance.status)) {
      return res.status(400).json({
        success: false,
        message: "This request has already been reviewed",
      });
    }

    // Same sequential-approval state machine as routes/absences.js's
    // /:id/review — see that file's comment for the full explanation.
    // The manager step can be performed by the employee's line manager
    // OR their department's manager (as long as that isn't the
    // employee themself) — with neither, fall back to single-step.
    const advanceDepartment = advance.employee.department
      ? await Department.findById(advance.employee.department).select("manager").lean()
      : null;
    const hasManagerStep =
      !!advance.employee.manager ||
      (!!advanceDepartment?.manager && String(advanceDepartment.manager) !== String(advance.employee._id));
    const sequential = !!advance.company.settings?.requireSequentialApproval && hasManagerStep;
    const capacity = reviewerRole(req.user, advance.company, advance.employee);

    let newStatus = requestedStatus;

    if (sequential && requestedStatus === "accepted") {
      if (advance.status === "pending") {
        if (capacity !== "manager") {
          return res.status(400).json({
            success: false,
            message: "This request needs the employee's manager to approve it first",
          });
        }
        newStatus = "manager_approved";
      } else {
        if (capacity !== "hr") {
          return res.status(400).json({
            success: false,
            message: "The manager has already approved this request — it's now awaiting HR's final approval",
          });
        }
        newStatus = "accepted";
      }
    }

    const before = advance.toObject();

    advance.status = newStatus;
    advance.reviewComment = reviewComment;
    advance.reviewedBy = req.user.id;
    advance.reviewedAt = new Date();
    advance.updatedBy = req.user.id;

    await advance.save();

    const populated = await advance
      .populate("employee", "firstName lastName employeeNumber jobTitle photo")
      .then((doc) => doc.populate("reviewedBy", "firstName lastName"));

    await logAudit(req, {
      company: advance.company._id,
      action: "review",
      resourceType: "Advance",
      resourceId: advance._id,
      resourceLabel: `${advance.employee.firstName} ${advance.employee.lastName}`,
      before,
      after: advance.toObject(),
    });

    if (newStatus === "manager_approved") {
      const hrRecipientIds = await getHRRecipientIds(advance.company);
      await notifyMany(hrRecipientIds, {
        type: "advance_pending",
        title: "Advance request awaiting your approval",
        message: `${advance.employee.firstName} ${advance.employee.lastName}'s manager has approved — final HR approval needed.`,
        link: "/hr/advances",
      });
    } else {
      const requesterUser = await User.findOne({ employee: advance.employee._id }).select("_id");
      if (requesterUser) {
        await notify(requesterUser._id, {
          type: "advance_reviewed",
          title: newStatus === "accepted" ? "Advance request accepted" : "Advance request rejected",
          message: reviewComment || undefined,
          link: "/me/advances",
        });
      }
    }

    res.json({
      success: true,
      data: populated,
      message: `Advance ${newStatus} successfully`,
    });
  } catch (error) {
    console.error("PATCH advance review error:", error);
    res.status(500).json({
      success: false,
      message: "Error reviewing advance",
      error: error.message,
    });
  }
});

// ======================================================
// DELETE ADVANCE
// DELETE /api/advances/:id
// ======================================================

router.delete("/:id", requireHRAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advance ID",
      });
    }

    const advance = await Advance.findById(req.params.id).populate("company");

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    if (!canManage(req, advance.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this advance",
      });
    }

    await Advance.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Advance deleted successfully",
      advanceId: advance._id,
    });
  } catch (error) {
    console.error("DELETE advance error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting advance",
      error: error.message,
    });
  }
});

// ======================================================
// TRANSLATIONS (reason, reviewComment) — see config/i18nContent.js
// ======================================================

attachTranslationRoutes(router, Advance, {
  resourceType: "Advance",
  middleware: [requireHRAccess],
  authorize: async (req, doc) => {
    const company = await Company.findById(doc.company);
    return canManage(req, company);
  },
});

module.exports = router;
