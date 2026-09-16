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
    const { companyId, ...days } = req.body;

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

    for (const day of allowedDays) {
      if (days[day]) {
        update[day] = {
          isWorkingDay: !!days[day].isWorkingDay,
          startHour: Number(days[day].startHour) || 0,
          startMinute: Number(days[day].startMinute) || 0,
          workHours: Number(days[day].workHours) || 0,
          graceMinutes: Number(days[day].graceMinutes) || 0,
        };
      }
    }

    const schedule = await WorkSchedule.findOneAndUpdate(
      { company: companyId },
      update,
      { new: true, upsert: true, runValidators: true }
    );

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
