const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const WorkSchedule = require("../models/WorkSchedule");
const { resolveDaySchedule, applyHoliday, nextPunch, punchDirection, computeDay } = require("../services/attendanceCalc");
const PublicHoliday = require("../models/PublicHoliday");

const auth = require("../middleware/auth");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const {
  canAccessHRForCompany,
  canSelfService,
} = require("../permissions/permissions");

// Note: NOT gated by requireHRAccess at the router level, unlike
// the other HR routes — clock-in/clock-out has to be usable by any
// employee with a linked User account (self-service), not just HR.
// Each route below checks the right permission for what it does.
router.use(auth);

// Used if a company hasn't configured a work schedule yet (see
// models/WorkSchedule.js and pages/owner/WorkSchedule.jsx) — same
// numbers as the schema's own defaults, kept here too so this file
// works standalone even if the schedule lookup fails for any reason.
const FALLBACK_DAY_CONFIG = {
  isWorkingDay: true,
  startHour: 9,
  startMinute: 0,
  workHours: 8,
  graceMinutes: 10,
};

async function getDayConfigForDate(companyId, date) {
  const schedule = await WorkSchedule.findOne({ company: companyId });
  if (!schedule) return FALLBACK_DAY_CONFIG;
  return schedule.getDayConfig(date) || FALLBACK_DAY_CONFIG;
}

// The day's resolved schedule WITH any public holiday applied (a
// closed holiday becomes a non-working day; worked time on any
// holiday is tracked separately — see services/attendanceCalc.js).
async function getScheduleForDate(companyId, date) {
  const schedule = resolveDaySchedule(await getDayConfigForDate(companyId, date));
  if (!companyId) return schedule;
  const holiday = await PublicHoliday.findOne({ company: companyId, day: PublicHoliday.dayKey(date) }).lean();
  return applyHoliday(schedule, holiday);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ======================================================
// CLOCK IN (self-service)
// POST /api/attendance/clock-in
// ======================================================

// Both endpoints go through one implementation. Whether a punch is a
// "clock in" or a "clock out" depends on the day's schedule (see
// services/attendanceCalc.js): a continuous day is in -> out; a split
// day is in -> midday out -> midday in -> out. The frontend just
// calls /clock-in or /clock-out; this works out WHICH punch it is.
async function punch(req, res, direction) {
  try {
    if (!canSelfService(req.user)) {
      return res.status(403).json({ success: false, message: "Your account isn't linked to an employee record" });
    }

    const employee = await Employee.findById(req.user.employee);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const now = new Date();
    const today = startOfDay(now);
    let record = await Attendance.findOne({ employee: employee._id, date: today });
    const schedule = await getScheduleForDate(employee.company, today);

    const next = nextPunch(record || {}, schedule);
    if (!next) {
      return res.status(400).json({ success: false, message: "You've already clocked out for today" });
    }
    if (punchDirection(next) !== direction) {
      return res.status(400).json({
        success: false,
        message: direction === "in" ? "You're already clocked in — clock out first" : "You need to clock in first",
      });
    }

    if (!record) {
      record = new Attendance({ company: employee.company, employee: employee._id, date: today, source: "self" });
    }

    record[next] = now;
    Object.assign(record, computeDay(record, schedule, today));
    await record.save();

    res.status(direction === "in" ? 201 : 200).json({
      success: true,
      data: record,
      punch: next,
      nextPunch: nextPunch(record, schedule),
      message: direction === "in" ? "Clocked in" : "Clocked out",
    });
  } catch (error) {
    console.error(`POST clock-${direction} error:`, error);
    res.status(500).json({ success: false, message: direction === "in" ? "Error clocking in" : "Error clocking out", error: error.message });
  }
}

// POST /api/attendance/clock-in   — morning in, or midday in on a split day
router.post("/clock-in", (req, res) => punch(req, res, "in"));

// POST /api/attendance/clock-out  — final out, or midday out on a split day
router.post("/clock-out", (req, res) => punch(req, res, "out"));

// ======================================================
// TODAY'S STATUS (self-service)
// GET /api/attendance/today
// ======================================================

router.get("/today", async (req, res) => {
  try {
    if (!canSelfService(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Your account isn't linked to an employee record",
      });
    }

    const today = startOfDay(new Date());
    const record = await Attendance.findOne({ employee: req.user.employee, date: today });

    // The day's schedule and which punch comes next, so My Space can
    // show the right button (and 4 punches on a split day).
    const employee = await Employee.findById(req.user.employee).select("company");
    const schedule = await getScheduleForDate(employee?.company, today);

    res.json({
      success: true,
      data: record || null,
      schedule: {
        isWorkingDay: schedule.isWorkingDay,
        split: schedule.split,
        start: schedule.start,
        breakStart: schedule.breakStart,
        breakEnd: schedule.breakEnd,
        end: schedule.end,
        holiday: schedule.holiday || null,
      },
      nextPunch: nextPunch(record || {}, schedule),
    });
  } catch (error) {
    console.error("GET attendance today error:", error);
    res.status(500).json({ success: false, message: "Error fetching today's attendance", error: error.message });
  }
});

// ======================================================
// LIST ATTENDANCE (HR view)
// GET /api/attendance?companyId=&employeeId=&from=&to=&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId, employeeId, from, to, page = 1, limit = 31 } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canAccessHRForCompany(req.user, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const filter = { company: companyId };
    if (employeeId) filter.employee = employeeId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = startOfDay(from);
      if (to) filter.date.$lte = startOfDay(to);
    }

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate("employee", "firstName lastName employeeNumber photo")
        .sort({ date: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      Attendance.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET attendance error:", error);
    res.status(500).json({ success: false, message: "Error fetching attendance", error: error.message });
  }
});

// ======================================================
// HR CORRECTION
// PUT /api/attendance/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid attendance ID" });
    }

    const record = await Attendance.findById(req.params.id).populate("company");
    if (!record) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }
    if (!canAccessHRForCompany(req.user, record.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const { clockIn, clockOut, breakOut, breakIn, status, notes } = req.body;
    if (clockIn !== undefined) record.clockIn = clockIn || null;
    if (clockOut !== undefined) record.clockOut = clockOut || null;
    if (breakOut !== undefined) record.breakOut = breakOut || null;
    if (breakIn !== undefined) record.breakIn = breakIn || null;
    if (notes !== undefined) record.notes = notes;
    record.source = "hr";

    // Recompute hours / late / early / overtime from the corrected
    // punches with the same rules as self clock-in (it used to only
    // update hoursWorked, leaving overtime and lateness stale).
    const dayStart = startOfDay(record.date);
    const schedule = await getScheduleForDate(record.company._id, dayStart);
    const computed = computeDay(record, schedule, dayStart);
    // Only derive a status for records that actually have punches; an
    // explicit status from HR (absent, half day...) always wins.
    if (!record.clockIn) delete computed.status;
    Object.assign(record, computed);
    if (status !== undefined) record.status = status;

    await record.save();

    res.json({ success: true, data: record, message: "Attendance updated successfully" });
  } catch (error) {
    console.error("PUT attendance error:", error);
    res.status(500).json({ success: false, message: "Error updating attendance", error: error.message });
  }
});

// ======================================================
// MONTHLY SUMMARY (HR view — feeds reporting)
// GET /api/attendance/summary?companyId=&employeeId=&month=&year=
// ======================================================

router.get("/summary", async (req, res) => {
  try {
    const { companyId, employeeId, month, year } = req.query;

    if (!companyId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "companyId, month and year are required",
      });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canAccessHRForCompany(req.user, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const from = new Date(Number(year), Number(month) - 1, 1);
    const to = new Date(Number(year), Number(month), 0, 23, 59, 59);

    const filter = { company: companyId, date: { $gte: from, $lte: to } };
    if (employeeId) filter.employee = employeeId;

    const records = await Attendance.find(filter);

    const summary = {
      daysPresent: records.filter((r) => r.status === "present").length,
      daysLate: records.filter((r) => r.status === "late").length,
      daysAbsent: records.filter((r) => r.status === "absent").length,
      totalHours: Math.round(
        records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0) * 100
      ) / 100,
      totalLateMinutes: records.reduce((sum, r) => sum + (r.lateMinutes || 0), 0),
      totalOvertimeMinutes: records.reduce(
        (sum, r) => sum + (r.overtimeMinutes || 0),
        0
      ),
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("GET attendance summary error:", error);
    res.status(500).json({ success: false, message: "Error fetching attendance summary", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (notes) — see config/i18nContent.js
// ======================================================
// Notes are an HR-correction field (see the PUT /:id handler above),
// so translating/editing them is gated the same way: HR access to
// the record's company, not employee self-service.

attachTranslationRoutes(router, Attendance, {
  resourceType: "Attendance",
  populate: "company",
  authorize: async (req, doc) => canAccessHRForCompany(req.user, doc.company),
});

module.exports = router;
