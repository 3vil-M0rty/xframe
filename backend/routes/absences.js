const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Absence = require("../models/Absence");
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
  canReviewAbsence,
  reviewerRole,
} = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { notify, notifyMany, getHRRecipientIds } = require("../services/notificationService");

// Only auth at the router level now — the review endpoint needs to
// also allow a requester's manager through (see canReviewAbsence),
// not just full HR access, so it can't sit behind a blanket
// requireHRAccess. Every OTHER route below still applies
// requireHRAccess individually.
router.use(auth);

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
// GET /api/absences?companyId=&employeeId=&search=&status=&type=&page=&limit=
// ======================================================

router.get("/", requireHRAccess, async (req, res) => {
  try {
    const {
      companyId,
      employeeId,
      search,
      status,
      type,
      from,
      to,
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
    } else if (search) {
      filter.employee = { $in: await findMatchingEmployeeIds(companyId, search) };
    }

    if (status) filter.status = status;
    if (type) filter.type = type;

    // A request "overlaps" the [from, to] window if it starts on
    // or before `to` AND ends on or after `from` — using this
    // (rather than only matching on startDate) means a multi-day
    // absence that merely OVERLAPS the selected range is still
    // included, not just ones that start inside it.
    if (from || to) {
      if (to) filter.startDate = { $lte: new Date(to) };
      if (from) filter.endDate = { $gte: new Date(from) };
    }

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
// LEAVE CALENDAR — who's on approved leave within a date range
// GET /api/absences/calendar?companyId=&from=&to=
// ======================================================
// Read-only, company-wide view — deliberately sits behind
// requireHRAccess (not the more permissive canReviewAbsence used by
// the review endpoint below) since "everyone's leave at a glance"
// is HR-module data, not something a random line manager should see
// company-wide just because they can approve their own team.
// Registered BEFORE GET /:id below — Express matches routes in
// registration order, and /:id would otherwise swallow a request to
// /calendar as if "calendar" were an absence id.

router.get("/calendar", requireHRAccess, async (req, res) => {
  try {
    const { companyId, from, to } = req.query;
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "A valid companyId is required" });
    }
    if (!from || !to) {
      return res.status(400).json({ success: false, message: "from and to dates are required" });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });
    if (!canManage(req, company)) return res.status(403).json({ success: false, message: "Not authorized" });

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const absences = await Absence.find({
      company: companyId,
      status: "accepted",
      startDate: { $lte: toDate },
      endDate: { $gte: fromDate },
    })
      .populate("employee", "firstName lastName employeeNumber")
      .sort({ startDate: 1 });

    res.json({ success: true, data: absences });
  } catch (error) {
    console.error("GET absences calendar error:", error);
    res.status(500).json({ success: false, message: "Error fetching leave calendar", error: error.message });
  }
});

// ======================================================
// GET SINGLE ABSENCE
// GET /api/absences/:id
// ======================================================

router.get("/:id", requireHRAccess, async (req, res) => {
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

router.post("/", requireHRAccess, async (req, res) => {
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

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "Absence",
      resourceId: absence._id,
      resourceLabel: `${populated.employee.firstName} ${populated.employee.lastName}`,
      after: absence.toObject(),
    });

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

router.put("/:id", requireHRAccess, async (req, res) => {
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
// Two workflows live in this one endpoint, chosen by
// company.settings.requireSequentialApproval:
//
// SEQUENTIAL OFF (default) — unchanged from before: whichever
// authorized reviewer (the line manager OR an HR approver) acts
// first sets the FINAL status directly.
//
// SEQUENTIAL ON — a two-step chain, enforced by reviewerRole (see
// permissions/permissions.js) telling us WHICH capacity the current
// reviewer is acting in:
//   pending -> [manager approves] -> manager_approved -> [HR approves] -> accepted
//   pending -> [either rejects]   -> rejected (rejection always short-circuits the chain)
// A manager can't act again once they've already approved (it's
// HR's turn), and HR can't skip straight to a final approval before
// the manager has — though HR CAN still reject directly from
// "pending", since rejecting doesn't need the manager's sign-off.
// If the employee has no manager on file, sequential mode falls
// back to the single-step behavior for that request — there's no
// one to perform the manager step, so requiring it would make the
// request unreviewable by anyone.

router.patch("/:id/review", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid absence ID",
      });
    }

    const { status: requestedStatus, reviewComment } = req.body;

    if (!["accepted", "rejected"].includes(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'status must be "accepted" or "rejected"',
      });
    }

    const absence = await Absence.findById(req.params.id)
      .populate("company")
      .populate("employee", "firstName lastName manager department");

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: "Absence not found",
      });
    }

    if (!canReviewAbsence(req.user, absence.company, absence.employee)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this absence",
      });
    }

    if (!["pending", "manager_approved"].includes(absence.status)) {
      return res.status(400).json({
        success: false,
        message: "This request has already been reviewed",
      });
    }

    // The manager step can be performed by the employee's line manager
    // OR their department's manager (as long as that isn't the
    // employee themself) — with neither, fall back to single-step.
    const absenceDepartment = absence.employee.department
      ? await Department.findById(absence.employee.department).select("manager").lean()
      : null;
    const hasManagerStep =
      !!absence.employee.manager ||
      (!!absenceDepartment?.manager && String(absenceDepartment.manager) !== String(absence.employee._id));
    const sequential = !!absence.company.settings?.requireSequentialApproval && hasManagerStep;
    const capacity = reviewerRole(req.user, absence.company, absence.employee);

    let newStatus = requestedStatus;
    let isFinal = true;

    if (sequential && requestedStatus === "accepted") {
      if (absence.status === "pending") {
        if (capacity !== "manager") {
          return res.status(400).json({
            success: false,
            message: "This request needs the employee's manager to approve it first",
          });
        }
        newStatus = "manager_approved";
        isFinal = false;
      } else {
        // status === "manager_approved" here (the only other value
        // this route reaches with, per the check above)
        if (capacity !== "hr") {
          return res.status(400).json({
            success: false,
            message: "The manager has already approved this request — it's now awaiting HR's final approval",
          });
        }
        newStatus = "accepted";
      }
    }
    // Rejection (sequential or not) and non-sequential acceptance
    // both go straight to their requested final status — no
    // additional gating beyond the canReviewAbsence check above.

    const before = absence.toObject();

    absence.status = newStatus;
    absence.reviewComment = reviewComment;
    absence.reviewedBy = req.user.id;
    absence.reviewedAt = new Date();
    absence.updatedBy = req.user.id;

    await absence.save();

    const populated = await absence
      .populate("employee", "firstName lastName employeeNumber jobTitle photo")
      .then((doc) => doc.populate("reviewedBy", "firstName lastName"));

    await logAudit(req, {
      company: absence.company._id,
      action: "review",
      resourceType: "Absence",
      resourceId: absence._id,
      resourceLabel: `${absence.employee.firstName} ${absence.employee.lastName}`,
      before,
      after: absence.toObject(),
    });

    if (newStatus === "manager_approved") {
      // Not a final decision — tell HR it's their turn instead of
      // notifying the employee (see below for that, which only
      // fires on a genuinely final accepted/rejected).
      const hrRecipientIds = await getHRRecipientIds(absence.company);
      await notifyMany(hrRecipientIds, {
        type: "absence_pending",
        title: "Absence request awaiting your approval",
        message: `${absence.employee.firstName} ${absence.employee.lastName}'s manager has approved — final HR approval needed.`,
        link: "/hr/absences",
      });
    } else {
      // Notify the employee (if they have a linked User account) —
      // only for a final accepted/rejected outcome.
      const requesterUser = await User.findOne({ employee: absence.employee._id }).select("_id");
      if (requesterUser) {
        await notify(requesterUser._id, {
          type: "absence_reviewed",
          title: newStatus === "accepted" ? "Absence request accepted" : "Absence request rejected",
          message: reviewComment || undefined,
          link: "/me/absences",
        });
      }
    }

    res.json({
      success: true,
      data: populated,
      message: `Absence ${newStatus} successfully`,
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

router.delete("/:id", requireHRAccess, async (req, res) => {
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

// ======================================================
// TRANSLATIONS (reason, reviewComment) — see config/i18nContent.js
// ======================================================

attachTranslationRoutes(router, Absence, {
  resourceType: "Absence",
  middleware: [requireHRAccess],
  authorize: async (req, doc) => {
    const company = await Company.findById(doc.company);
    return canManage(req, company);
  },
});

module.exports = router;
