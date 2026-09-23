const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const DisciplinaryAction = require("../models/DisciplinaryAction");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const User = require("../models/User");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany, canApproveHRRequests } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const { notify } = require("../services/notificationService");

// Only login is required at the router level — requireHRAccess is
// applied per-route below instead of globally, so /mine and
// /:id/acknowledge stay reachable by any logged-in employee. See
// the identical fix and reasoning in routes/performanceReviews.js.
router.use(auth);

const canManage = (req, company) => canAccessHRForCompany(req.user, company);

// Disciplinary records are more sensitive than routine HR data
// (contracts, documents) — every write action here needs
// Responsable RH authority or higher, not just Chargé RH. Reading
// the list still only needs ordinary HR access (requireHRAccess
// above), since a Chargé/Assistant RH may legitimately need to see
// this history even if they can't add to it.
const canManageDiscipline = canApproveHRRequests;

// ======================================================
// MY RECORDS (self-service)
// GET /api/disciplinary-actions/mine
// ======================================================
// Registered before GET /:id below, for the same route-ordering
// reason as performanceReviews.js's /mine. No requireHRAccess here
// — any logged-in user linked to an employee can see their own
// record. Unlike performance reviews there's no "draft" concept
// here to filter out — a disciplinary action is real the moment
// it's created, which is exactly why write access to this resource
// is gated at Responsable RH and above (see canManageDiscipline).

router.get("/mine", async (req, res) => {
  try {
    if (!req.user.employee) {
      return res.json({ success: true, data: [] });
    }

    const actions = await DisciplinaryAction.find({ employee: req.user.employee })
      .populate("issuedBy", "firstName lastName")
      .sort({ date: -1 });

    res.json({ success: true, data: actions });
  } catch (error) {
    console.error("GET my disciplinary actions error:", error);
    res.status(500).json({ success: false, message: "Error fetching your records", error: error.message });
  }
});

// ======================================================
// GET ALL DISCIPLINARY ACTIONS
// GET /api/disciplinary-actions?companyId=&employeeId=&page=&limit=
// ======================================================

router.get("/", requireHRAccess, async (req, res) => {
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

    const [actions, total] = await Promise.all([
      DisciplinaryAction.find(filter)
        .populate("employee", "firstName lastName employeeNumber jobTitle")
        .populate("issuedBy", "firstName lastName")
        .sort({ date: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      DisciplinaryAction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: actions,
      pagination: { total, page: currentPage, limit: currentLimit, pages: Math.ceil(total / currentLimit) || 1 },
    });
  } catch (error) {
    console.error("GET disciplinary actions error:", error);
    res.status(500).json({ success: false, message: "Error fetching disciplinary actions", error: error.message });
  }
});

// ======================================================
// GET SINGLE
// GET /api/disciplinary-actions/:id
// ======================================================

router.get("/:id", requireHRAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const action = await DisciplinaryAction.findById(req.params.id)
      .populate("employee", "firstName lastName employeeNumber jobTitle")
      .populate("issuedBy", "firstName lastName")
      .populate("company");

    if (!action) return res.status(404).json({ success: false, message: "Record not found" });
    if (!canManage(req, action.company)) return res.status(403).json({ success: false, message: "Not authorized" });

    res.json({ success: true, data: action });
  } catch (error) {
    console.error("GET disciplinary action error:", error);
    res.status(500).json({ success: false, message: "Error fetching record", error: error.message });
  }
});

// ======================================================
// CREATE
// POST /api/disciplinary-actions
// ======================================================

router.post("/", requireHRAccess, async (req, res) => {
  try {
    const { company, employee, type, date, reason, description, suspensionDays, issuedBy, notes } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!employee || !type || !reason) {
      return res.status(400).json({ success: false, message: "Employee, type, and reason are required" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) return res.status(404).json({ success: false, message: "Company not found" });
    if (!canManage(req, companyDoc)) return res.status(403).json({ success: false, message: "Not authorized" });
    if (!canManageDiscipline(req.user)) {
      return res.status(403).json({ success: false, message: "Recording a disciplinary action requires Responsable RH authority or higher" });
    }

    const employeeDoc = await Employee.findOne({ _id: employee, company });
    if (!employeeDoc) return res.status(404).json({ success: false, message: "Employee not found in this company" });

    const action = await DisciplinaryAction.create({
      company,
      employee,
      type,
      date: date || new Date(),
      reason,
      description,
      suspensionDays: type === "suspension" ? suspensionDays : null,
      issuedBy,
      notes,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "DisciplinaryAction",
      resourceId: action._id,
      resourceLabel: `${type} — ${employeeDoc.firstName} ${employeeDoc.lastName}`,
      after: action.toObject(),
    });

    const linkedUser = await User.findOne({ employee });
    if (linkedUser) {
      await notify(linkedUser._id, {
        type: "other",
        title: "New record on file",
        message: "A new record has been added to your HR file. Contact HR for details.",
        link: "/me/records",
      });
    }

    res.status(201).json({ success: true, data: action });
  } catch (error) {
    console.error("POST disciplinary action error:", error);
    res.status(500).json({ success: false, message: "Error creating record", error: error.message });
  }
});

// ======================================================
// UPDATE
// PUT /api/disciplinary-actions/:id
// ======================================================

router.put("/:id", requireHRAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const action = await DisciplinaryAction.findById(req.params.id).populate("company");
    if (!action) return res.status(404).json({ success: false, message: "Record not found" });
    if (!canManage(req, action.company)) return res.status(403).json({ success: false, message: "Not authorized" });
    if (!canManageDiscipline(req.user)) {
      return res.status(403).json({ success: false, message: "Editing a disciplinary action requires Responsable RH authority or higher" });
    }

    const { type, date, reason, description, suspensionDays, issuedBy, notes } = req.body;
    if (type !== undefined) action.type = type;
    if (date !== undefined) action.date = date;
    if (reason !== undefined) action.reason = reason;
    if (description !== undefined) action.description = description;
    if (suspensionDays !== undefined) action.suspensionDays = action.type === "suspension" ? suspensionDays : null;
    if (issuedBy !== undefined) action.issuedBy = issuedBy;
    if (notes !== undefined) action.notes = notes;
    action.updatedBy = req.user.id;

    await action.save();
    res.json({ success: true, data: action });
  } catch (error) {
    console.error("PUT disciplinary action error:", error);
    res.status(500).json({ success: false, message: "Error updating record", error: error.message });
  }
});

// ======================================================
// ACKNOWLEDGE (self-service — the affected employee only)
// PATCH /api/disciplinary-actions/:id/acknowledge
// ======================================================

router.patch("/:id/acknowledge", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const action = await DisciplinaryAction.findById(req.params.id);
    if (!action) return res.status(404).json({ success: false, message: "Record not found" });

    if (String(action.employee) !== String(req.user.employee)) {
      return res.status(403).json({ success: false, message: "You can only acknowledge your own record" });
    }

    action.acknowledgedByEmployee = true;
    action.acknowledgedAt = new Date();
    await action.save();

    res.json({ success: true, data: action });
  } catch (error) {
    console.error("PATCH disciplinary action acknowledge error:", error);
    res.status(500).json({ success: false, message: "Error acknowledging record", error: error.message });
  }
});

// ======================================================
// DELETE
// DELETE /api/disciplinary-actions/:id
// ======================================================

router.delete("/:id", requireHRAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const action = await DisciplinaryAction.findById(req.params.id).populate("company");
    if (!action) return res.status(404).json({ success: false, message: "Record not found" });
    if (!canManage(req, action.company)) return res.status(403).json({ success: false, message: "Not authorized" });
    if (!canManageDiscipline(req.user)) {
      return res.status(403).json({ success: false, message: "Deleting a disciplinary action requires Responsable RH authority or higher" });
    }

    await DisciplinaryAction.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: action.company._id,
      action: "delete",
      resourceType: "DisciplinaryAction",
      resourceId: action._id,
      resourceLabel: `${action.type}`,
      before: action.toObject(),
    });

    res.json({ success: true, message: "Record deleted" });
  } catch (error) {
    console.error("DELETE disciplinary action error:", error);
    res.status(500).json({ success: false, message: "Error deleting record", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (reason, description, notes)
// ======================================================

attachTranslationRoutes(router, DisciplinaryAction, {
  resourceType: "DisciplinaryAction",
  middleware: [],
  authorize: async (req, doc) => canManage(req, doc.company),
  companyId: (doc) => doc.company,
});

module.exports = router;
