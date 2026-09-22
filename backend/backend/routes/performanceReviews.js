const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const PerformanceReview = require("../models/PerformanceReview");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const User = require("../models/User");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany, canManageEmployeeRecords, canApproveHRRequests } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const { notify } = require("../services/notificationService");

router.use(auth, requireHRAccess);

const canManage = (req, company) => canAccessHRForCompany(req.user, company);

// ======================================================
// GET ALL REVIEWS
// GET /api/performance-reviews?companyId=&employeeId=&page=&limit=
// ======================================================
// Draft reviews are only ever returned to HR-tier requests — this
// endpoint sits behind requireHRAccess entirely, so that's already
// guaranteed; self-service employees see their own reviews through
// a separate, narrower endpoint (not built here) that would filter
// to status != "draft".

router.get("/", async (req, res) => {
  try {
    const { companyId, employeeId, page = 1, limit = 20 } = req.query;
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "A valid companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });
    if (!canManage(req, company)) return res.status(403).json({ success: false, message: "Not authorized" });

    const filter = { company: companyId };
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) filter.employee = employeeId;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const [reviews, total] = await Promise.all([
      PerformanceReview.find(filter)
        .populate("employee", "firstName lastName employeeNumber jobTitle")
        .populate("reviewer", "firstName lastName")
        .sort({ reviewDate: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      PerformanceReview.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: reviews,
      pagination: { total, page: currentPage, limit: currentLimit, pages: Math.ceil(total / currentLimit) || 1 },
    });
  } catch (error) {
    console.error("GET performance reviews error:", error);
    res.status(500).json({ success: false, message: "Error fetching performance reviews", error: error.message });
  }
});

// ======================================================
// GET SINGLE REVIEW
// GET /api/performance-reviews/:id
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await PerformanceReview.findById(req.params.id)
      .populate("employee", "firstName lastName employeeNumber jobTitle")
      .populate("reviewer", "firstName lastName")
      .populate("company");

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (!canManage(req, review.company)) return res.status(403).json({ success: false, message: "Not authorized" });

    res.json({ success: true, data: review });
  } catch (error) {
    console.error("GET performance review error:", error);
    res.status(500).json({ success: false, message: "Error fetching review", error: error.message });
  }
});

// ======================================================
// CREATE REVIEW
// POST /api/performance-reviews
// ======================================================

router.post("/", async (req, res) => {
  try {
    const { company, employee, reviewer, periodLabel, reviewDate, ratings, goals, strengths, areasForImprovement, comments } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!employee || !reviewer || !periodLabel) {
      return res.status(400).json({ success: false, message: "Employee, reviewer, and a period label are required" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) return res.status(404).json({ success: false, message: "Company not found" });
    if (!canManage(req, companyDoc)) return res.status(403).json({ success: false, message: "Not authorized" });
    if (!canManageEmployeeRecords(req.user)) {
      return res.status(403).json({ success: false, message: "Creating performance reviews requires Chargé RH authority or higher" });
    }

    const employeeDoc = await Employee.findOne({ _id: employee, company });
    if (!employeeDoc) return res.status(404).json({ success: false, message: "Employee not found in this company" });

    const review = await PerformanceReview.create({
      company,
      employee,
      reviewer,
      periodLabel,
      reviewDate: reviewDate || new Date(),
      ratings,
      goals,
      strengths,
      areasForImprovement,
      comments,
      status: "draft",
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "PerformanceReview",
      resourceId: review._id,
      resourceLabel: `Review (${periodLabel}) for ${employeeDoc.firstName} ${employeeDoc.lastName}`,
      after: review.toObject(),
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error("POST performance review error:", error);
    res.status(500).json({ success: false, message: "Error creating review", error: error.message });
  }
});

// ======================================================
// UPDATE REVIEW
// PUT /api/performance-reviews/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await PerformanceReview.findById(req.params.id).populate("company");
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (!canManage(req, review.company)) return res.status(403).json({ success: false, message: "Not authorized" });
    if (!canManageEmployeeRecords(req.user)) {
      return res.status(403).json({ success: false, message: "Editing performance reviews requires Chargé RH authority or higher" });
    }

    const { periodLabel, reviewDate, ratings, goals, strengths, areasForImprovement, comments } = req.body;
    if (periodLabel !== undefined) review.periodLabel = periodLabel;
    if (reviewDate !== undefined) review.reviewDate = reviewDate;
    if (ratings !== undefined) review.ratings = ratings;
    if (goals !== undefined) review.goals = goals;
    if (strengths !== undefined) review.strengths = strengths;
    if (areasForImprovement !== undefined) review.areasForImprovement = areasForImprovement;
    if (comments !== undefined) review.comments = comments;
    review.updatedBy = req.user.id;

    await review.save();
    res.json({ success: true, data: review });
  } catch (error) {
    console.error("PUT performance review error:", error);
    res.status(500).json({ success: false, message: "Error updating review", error: error.message });
  }
});

// ======================================================
// SUBMIT REVIEW (draft -> submitted, notifies the employee)
// PATCH /api/performance-reviews/:id/submit
// ======================================================

router.patch("/:id/submit", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await PerformanceReview.findById(req.params.id).populate("company").populate("employee", "firstName lastName");
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (!canManage(req, review.company)) return res.status(403).json({ success: false, message: "Not authorized" });
    if (review.status !== "draft") {
      return res.status(400).json({ success: false, message: "Only a draft review can be submitted" });
    }

    review.status = "submitted";
    review.updatedBy = req.user.id;
    await review.save();

    const linkedUser = await User.findOne({ employee: review.employee._id });
    if (linkedUser) {
      await notify(linkedUser._id, {
        type: "other",
        title: "New performance review",
        message: `Your performance review for "${review.periodLabel}" is ready to view.`,
        link: "/me",
      });
    }

    res.json({ success: true, data: review });
  } catch (error) {
    console.error("PATCH performance review submit error:", error);
    res.status(500).json({ success: false, message: "Error submitting review", error: error.message });
  }
});

// ======================================================
// ACKNOWLEDGE REVIEW (self-service — the reviewed employee only)
// PATCH /api/performance-reviews/:id/acknowledge
// ======================================================

router.patch("/:id/acknowledge", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await PerformanceReview.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    if (String(review.employee) !== String(req.user.employee)) {
      return res.status(403).json({ success: false, message: "You can only acknowledge your own review" });
    }
    if (review.status !== "submitted") {
      return res.status(400).json({ success: false, message: "This review is not awaiting acknowledgment" });
    }

    review.status = "acknowledged";
    review.acknowledgedAt = new Date();
    if (req.body.employeeComments !== undefined) review.employeeComments = req.body.employeeComments;
    await review.save();

    res.json({ success: true, data: review });
  } catch (error) {
    console.error("PATCH performance review acknowledge error:", error);
    res.status(500).json({ success: false, message: "Error acknowledging review", error: error.message });
  }
});

// ======================================================
// DELETE REVIEW — Responsable RH and above
// DELETE /api/performance-reviews/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await PerformanceReview.findById(req.params.id).populate("company");
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (!canManage(req, review.company)) return res.status(403).json({ success: false, message: "Not authorized" });
    if (!canApproveHRRequests(req.user)) {
      return res.status(403).json({ success: false, message: "Deleting a performance review requires Responsable RH authority or higher" });
    }

    await PerformanceReview.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: review.company._id,
      action: "delete",
      resourceType: "PerformanceReview",
      resourceId: review._id,
      resourceLabel: `Review (${review.periodLabel})`,
      before: review.toObject(),
    });

    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("DELETE performance review error:", error);
    res.status(500).json({ success: false, message: "Error deleting review", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (strengths, areasForImprovement, comments)
// ======================================================

attachTranslationRoutes(router, PerformanceReview, {
  resourceType: "PerformanceReview",
  middleware: [],
  authorize: async (req, doc) => canManage(req, doc.company),
  companyId: (doc) => doc.company,
});

module.exports = router;
