const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const {
  canAccessHRForCompany,
  canSelfService,
} = require("../permissions/permissions");

// Note: NOT gated by requireHRAccess at the router level, unlike
// the other HR routes — clock-in/clock-out has to be usable by any
// employee with a linked User account (self-service), not just HR.
// Each route below checks the right permission for what it does.
router.use(auth);

// Simple expected-schedule constants — there's no per-company
// schedule model yet, so this is a single default for the whole
// app. Move this into Company settings once that's needed.
const EXPECTED_START_HOUR = 9; // 09:00
const EXPECTED_WORKDAY_MINUTES = 8 * 60; // 8 hours
const GRACE_MINUTES = 10;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ======================================================
// CLOCK IN (self-service)
// POST /api/attendance/clock-in
// ======================================================

router.post("/clock-in", async (req, res) => {
  try {
    if (!canSelfService(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Your account isn't linked to an employee record",
      });
    }

    const employee = await Employee.findById(req.user.employee);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const today = startOfDay(new Date());
    const now = new Date();

    let record = await Attendance.findOne({ employee: employee._id, date: today });

    if (record?.clockIn) {
      return res.status(400).json({ success: false, message: "Already clocked in today" });
    }

    const expectedStart = new Date(today);
    expectedStart.setHours(EXPECTED_START_HOUR, 0, 0, 0);
    const lateMinutes = Math.max(
      Math.round((now - expectedStart) / 60000) - GRACE_MINUTES,
      0
    );

    if (!record) {
      record = new Attendance({
        company: employee.company,
        employee: employee._id,
        date: today,
        source: "self",
      });
    }

    record.clockIn = now;
    record.status = lateMinutes > 0 ? "late" : "present";
    record.lateMinutes = lateMinutes;
    await record.save();

    res.status(201).json({ success: true, data: record, message: "Clocked in" });
  } catch (error) {
    console.error("POST clock-in error:", error);
    res.status(500).json({ success: false, message: "Error clocking in", error: error.message });
  }
});

// ======================================================
// CLOCK OUT (self-service)
// POST /api/attendance/clock-out
// ======================================================

router.post("/clock-out", async (req, res) => {
  try {
    if (!canSelfService(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Your account isn't linked to an employee record",
      });
    }

    const today = startOfDay(new Date());
    const now = new Date();

    const record = await Attendance.findOne({
      employee: req.user.employee,
      date: today,
    });

    if (!record || !record.clockIn) {
      return res.status(400).json({ success: false, message: "You haven't clocked in today" });
    }
    if (record.clockOut) {
      return res.status(400).json({ success: false, message: "Already clocked out today" });
    }

    record.clockOut = now;

    const minutesWorked = Math.round((now - record.clockIn) / 60000);
    record.hoursWorked = Math.round((minutesWorked / 60) * 100) / 100;
    record.overtimeMinutes = Math.max(
      minutesWorked - EXPECTED_WORKDAY_MINUTES,
      0
    );

    await record.save();

    res.json({ success: true, data: record, message: "Clocked out" });
  } catch (error) {
    console.error("POST clock-out error:", error);
    res.status(500).json({ success: false, message: "Error clocking out", error: error.message });
  }
});

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

    const record = await Attendance.findOne({
      employee: req.user.employee,
      date: startOfDay(new Date()),
    });

    res.json({ success: true, data: record || null });
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

    const { clockIn, clockOut, status, notes } = req.body;
    if (clockIn !== undefined) record.clockIn = clockIn;
    if (clockOut !== undefined) record.clockOut = clockOut;
    if (status !== undefined) record.status = status;
    if (notes !== undefined) record.notes = notes;
    record.source = "hr";

    if (record.clockIn && record.clockOut) {
      const minutesWorked = Math.round(
        (new Date(record.clockOut) - new Date(record.clockIn)) / 60000
      );
      record.hoursWorked = Math.round((minutesWorked / 60) * 100) / 100;
    }

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

module.exports = router;
