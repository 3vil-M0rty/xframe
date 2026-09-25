const express = require("express");

const router = express.Router();

const WorkSchedule = require("../models/WorkSchedule");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { canManageCompany } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");

router.use(auth);

// ======================================================
// GET WORK SCHEDULE (creates a default one on first read if
// none exists yet, so the frontend always has something to show)
// GET /api/work-schedule?companyId=
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

    if (!canManageCompany(req.user, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    let schedule = await WorkSchedule.findOne({ company: companyId });

    if (!schedule) {
      schedule = await WorkSchedule.create({ company: companyId, updatedBy: req.user.id });
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error("GET work schedule error:", error);
    res.status(500).json({ success: false, message: "Error fetching work schedule", error: error.message });
  }
});

// ======================================================
// UPDATE WORK SCHEDULE
// PUT /api/work-schedule
// body: { companyId, monday, tuesday, ..., sunday }
// Restricted to whoever can manage the company itself (admin, or
// the owner of THIS company) — this is a company-wide policy
// setting, not day-to-day HR work, so it's a narrower gate than
// the general HR module (canAccessHR/requireHRAccess).
// ======================================================

router.put("/", async (req, res) => {
  try {
    const { companyId, hoursManagement, ...days } = req.body;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (!canManageCompany(req.user, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const allowedDays = WorkSchedule.DAY_KEYS;
    const update = { updatedBy: req.user.id };
    const num = (v, fallback = 0) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? fallback : Number(v));

    // Every day field — including the split-shift ones. This list used
    // to stop at start/workHours/grace, so endHour, splitShift and the
    // midday times were silently DROPPED: switching to a split shift
    // "saved" successfully but came back as one continuous shift.
    for (const day of allowedDays) {
      if (days[day]) {
        const d = days[day];
        update[day] = {
          isWorkingDay: !!d.isWorkingDay,
          startHour: num(d.startHour),
          startMinute: num(d.startMinute),
          endHour: d.endHour === undefined || d.endHour === null || d.endHour === "" ? null : num(d.endHour),
          endMinute: num(d.endMinute),
          workHours: num(d.workHours),
          graceMinutes: num(d.graceMinutes),
          splitShift: !!d.splitShift,
          breakStartHour: num(d.breakStartHour, 12),
          breakStartMinute: num(d.breakStartMinute),
          breakEndHour: num(d.breakEndHour, 14),
          breakEndMinute: num(d.breakEndMinute),
        };
      }
    }

    if (hoursManagement) {
      update.hoursManagement = {
        payOvertime: !!hoursManagement.payOvertime,
        overtimeRate: Number(hoursManagement.overtimeRate) || 1.25,
        deductLateArrival: !!hoursManagement.deductLateArrival,
        deductEarlyLeave: !!hoursManagement.deductEarlyLeave,
        deductionRate: Number(hoursManagement.deductionRate) || 1,
        monthlyStandardHours: Number(hoursManagement.monthlyStandardHours) || 191,
      };
    }

    // Load-or-create then save(), NOT findOneAndUpdate: the model's
    // validate hook (models/WorkSchedule.js) derives each day's hours
    // from its times and rejects impossible orders — update queries
    // skip that hook entirely.
    let schedule = await WorkSchedule.findOne({ company: companyId });
    if (!schedule) schedule = new WorkSchedule({ company: companyId });
    schedule.set(update);
    try {
      await schedule.save();
    } catch (validationError) {
      if (validationError.name === "ValidationError") {
        return res.status(400).json({ success: false, message: Object.values(validationError.errors)[0].message });
      }
      throw validationError;
    }

    await logAudit(req, {
      company: companyId,
      action: "update",
      resourceType: "WorkSchedule",
      resourceId: schedule._id,
      resourceLabel: "Work schedule",
    });

    res.json({ success: true, data: schedule, message: "Work schedule updated successfully" });
  } catch (error) {
    console.error("PUT work schedule error:", error);
    res.status(500).json({ success: false, message: "Error updating work schedule", error: error.message });
  }
});

module.exports = router;
