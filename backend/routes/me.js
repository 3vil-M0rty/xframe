const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Employee = require("../models/Employee");
const Payslip = require("../models/Payslip");
const Absence = require("../models/Absence");
const Advance = require("../models/Advance");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { canSelfService } = require("../permissions/permissions");
const { getLeaveBalance } = require("../services/leaveBalanceService");
const {
  notifyMany,
  getHRRecipientIds,
} = require("../services/notificationService");

router.use(auth);

// Every route here needs a linked employee record.
router.use((req, res, next) => {
  if (!canSelfService(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Your account isn't linked to an employee record",
    });
  }
  next();
});

// ======================================================
// MY EMPLOYEE PROFILE
// GET /api/me/employee
// ======================================================

router.get("/employee", async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.employee).populate(
      "manager",
      "firstName lastName jobTitle"
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    console.error("GET me/employee error:", error);
    res.status(500).json({ success: false, message: "Error fetching your profile", error: error.message });
  }
});

// ======================================================
// MY LEAVE BALANCE
// GET /api/me/leave-balance
// ======================================================

router.get("/leave-balance", async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.employee);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const balance = await getLeaveBalance(employee);
    res.json({ success: true, data: balance });
  } catch (error) {
    console.error("GET me/leave-balance error:", error);
    res.status(500).json({ success: false, message: "Error computing leave balance", error: error.message });
  }
});

// ======================================================
// MY PAYSLIPS
// GET /api/me/payslips?page=&limit=
// GET /api/me/payslips/:id
// ======================================================

router.get("/payslips", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const filter = { employee: req.user.employee, status: { $ne: "draft" } };

    const [payslips, total] = await Promise.all([
      Payslip.find(filter)
        .sort({ year: -1, month: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      Payslip.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: payslips,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET me/payslips error:", error);
    res.status(500).json({ success: false, message: "Error fetching your payslips", error: error.message });
  }
});

router.get("/payslips/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid payslip ID" });
    }

    const payslip = await Payslip.findOne({
      _id: req.params.id,
      employee: req.user.employee,
      status: { $ne: "draft" },
    });

    if (!payslip) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }

    res.json({ success: true, data: payslip });
  } catch (error) {
    console.error("GET me/payslip error:", error);
    res.status(500).json({ success: false, message: "Error fetching payslip", error: error.message });
  }
});

// ======================================================
// MY ABSENCES
// GET /api/me/absences?page=&limit=
// POST /api/me/absences
// ======================================================

router.get("/absences", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const filter = { employee: req.user.employee };

    const [absences, total] = await Promise.all([
      Absence.find(filter)
        .sort({ startDate: -1 })
        .skip((currentPage - 1) * currentLimit)
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
    console.error("GET me/absences error:", error);
    res.status(500).json({ success: false, message: "Error fetching your absences", error: error.message });
  }
});

router.post("/absences", async (req, res) => {
  try {
    const { type, startDate, endDate, halfDay, reason } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Type, start date and end date are required",
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: "End date cannot be before start date" });
    }

    const employee = await Employee.findById(req.user.employee);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffDays =
      Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const daysCount = halfDay ? 0.5 : Math.max(diffDays, 1);

    const absence = await Absence.create({
      company: employee.company,
      employee: employee._id,
      type,
      startDate,
      endDate,
      halfDay: !!halfDay,
      daysCount,
      justified: true,
      reason,
      status: "pending",
      requestedBy: req.user.id,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    // Notify HR and (if any) the employee's manager.
    const company = await Company.findById(employee.company);
    const hrIds = await getHRRecipientIds(company);

    let managerUserIds = [];
    if (employee.manager) {
      const managerUsers = await User.find({ employee: employee.manager }).select("_id");
      managerUserIds = managerUsers.map((u) => u._id);
    }

    await notifyMany([...hrIds, ...managerUserIds], {
      type: "absence_pending",
      title: "New absence request",
      message: `${employee.firstName} ${employee.lastName} requested ${type.replace("_", " ")}.`,
      link: "/hr/absences",
    });

    res.status(201).json({ success: true, data: absence, message: "Absence request submitted" });
  } catch (error) {
    console.error("POST me/absences error:", error);
    res.status(500).json({ success: false, message: "Error submitting absence request", error: error.message });
  }
});

router.delete("/absences/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid absence ID" });
    }

    const absence = await Absence.findOne({
      _id: req.params.id,
      employee: req.user.employee,
    });

    if (!absence) {
      return res.status(404).json({ success: false, message: "Absence request not found" });
    }

    if (absence.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only a pending request can be cancelled",
      });
    }

    await Absence.findByIdAndDelete(absence._id);

    res.json({ success: true, message: "Absence request cancelled" });
  } catch (error) {
    console.error("DELETE me/absences error:", error);
    res.status(500).json({ success: false, message: "Error cancelling request", error: error.message });
  }
});

// ======================================================
// MY ADVANCES
// GET /api/me/advances?page=&limit=
// POST /api/me/advances
// ======================================================

router.get("/advances", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const filter = { employee: req.user.employee };

    const [advances, total] = await Promise.all([
      Advance.find(filter)
        .sort({ requestDate: -1 })
        .skip((currentPage - 1) * currentLimit)
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
    console.error("GET me/advances error:", error);
    res.status(500).json({ success: false, message: "Error fetching your advances", error: error.message });
  }
});

router.post("/advances", async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid amount is required" });
    }

    const employee = await Employee.findById(req.user.employee);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const advance = await Advance.create({
      company: employee.company,
      employee: employee._id,
      amount,
      reason,
      status: "pending",
      requestedBy: req.user.id,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const company = await Company.findById(employee.company);
    const hrIds = await getHRRecipientIds(company);

    let managerUserIds = [];
    if (employee.manager) {
      const managerUsers = await User.find({ employee: employee.manager }).select("_id");
      managerUserIds = managerUsers.map((u) => u._id);
    }

    await notifyMany([...hrIds, ...managerUserIds], {
      type: "advance_pending",
      title: "New advance request",
      message: `${employee.firstName} ${employee.lastName} requested an advance of ${amount} MAD.`,
      link: "/hr/advances",
    });

    res.status(201).json({ success: true, data: advance, message: "Advance request submitted" });
  } catch (error) {
    console.error("POST me/advances error:", error);
    res.status(500).json({ success: false, message: "Error submitting advance request", error: error.message });
  }
});

// ======================================================
// MY ATTENDANCE HISTORY
// GET /api/me/attendance?month=&year=
// ======================================================

router.get("/attendance", async (req, res) => {
  try {
    const { month, year } = req.query;

    const filter = { employee: req.user.employee };
    if (month && year) {
      const from = new Date(Number(year), Number(month) - 1, 1);
      const to = new Date(Number(year), Number(month), 0, 23, 59, 59);
      filter.date = { $gte: from, $lte: to };
    }

    const records = await Attendance.find(filter).sort({ date: -1 });

    res.json({ success: true, data: records });
  } catch (error) {
    console.error("GET me/attendance error:", error);
    res.status(500).json({ success: false, message: "Error fetching your attendance", error: error.message });
  }
});

// ======================================================
// MY TEAM'S PENDING REQUESTS (manager view)
// GET /api/me/team-requests
// Only meaningful if other employees have this employee set as
// their manager — returns an empty list otherwise.
// ======================================================

router.get("/team-requests", async (req, res) => {
  try {
    const directReports = await Employee.find({
      manager: req.user.employee,
    }).select("_id");

    const reportIds = directReports.map((e) => e._id);

    const [pendingAbsences, pendingAdvances] = await Promise.all([
      Absence.find({ employee: { $in: reportIds }, status: "pending" })
        .populate("employee", "firstName lastName employeeNumber photo")
        .sort({ createdAt: -1 }),
      Advance.find({ employee: { $in: reportIds }, status: "pending" })
        .populate("employee", "firstName lastName employeeNumber photo")
        .sort({ createdAt: -1 }),
    ]);

    res.json({
      success: true,
      data: { absences: pendingAbsences, advances: pendingAdvances },
    });
  } catch (error) {
    console.error("GET me/team-requests error:", error);
    res.status(500).json({ success: false, message: "Error fetching team requests", error: error.message });
  }
});

module.exports = router;
