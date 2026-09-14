const express = require("express");

const router = express.Router();

const Employee = require("../models/Employee");
const Absence = require("../models/Absence");
const PayrollRun = require("../models/PayrollRun");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");

router.use(auth, requireHRAccess);

async function requireCompanyAccess(req, res, companyId) {
  if (!companyId) {
    res.status(400).json({ success: false, message: "companyId is required" });
    return null;
  }

  const company = await Company.findById(companyId);
  if (!company) {
    res.status(404).json({ success: false, message: "Company not found" });
    return null;
  }

  if (!canAccessHRForCompany(req.user, company)) {
    res.status(403).json({ success: false, message: "Not authorized" });
    return null;
  }

  return company;
}

function lastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return months;
}

// ======================================================
// HEADCOUNT — current headcount by department + status
// GET /api/reports/headcount?companyId=
// ======================================================

router.get("/headcount", async (req, res) => {
  try {
    const company = await requireCompanyAccess(req, res, req.query.companyId);
    if (!company) return;

    const employees = await Employee.find({ company: company._id }).select(
      "department employmentStatus employmentType"
    );

    const byDepartment = {};
    const byStatus = {};
    const byType = {};

    for (const emp of employees) {
      const dept = emp.department || "unassigned";
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;

      const status = emp.employmentStatus || "unknown";
      byStatus[status] = (byStatus[status] || 0) + 1;

      const type = emp.employmentType || "unknown";
      byType[type] = (byType[type] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        total: employees.length,
        active: byStatus.active || 0,
        byDepartment,
        byStatus,
        byType,
      },
    });
  } catch (error) {
    console.error("GET headcount report error:", error);
    res.status(500).json({ success: false, message: "Error building headcount report", error: error.message });
  }
});

// ======================================================
// TURNOVER — hires vs terminations per month
// GET /api/reports/turnover?companyId=&months=12
// ======================================================

router.get("/turnover", async (req, res) => {
  try {
    const company = await requireCompanyAccess(req, res, req.query.companyId);
    if (!company) return;

    const months = lastNMonths(Number(req.query.months) || 12);

    const employees = await Employee.find({ company: company._id }).select(
      "hireDate terminationDate"
    );

    const series = months.map(({ month, year }) => {
      const hires = employees.filter((e) => {
        if (!e.hireDate) return false;
        const d = new Date(e.hireDate);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }).length;

      const terminations = employees.filter((e) => {
        if (!e.terminationDate) return false;
        const d = new Date(e.terminationDate);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }).length;

      return { month, year, hires, terminations, net: hires - terminations };
    });

    res.json({ success: true, data: series });
  } catch (error) {
    console.error("GET turnover report error:", error);
    res.status(500).json({ success: false, message: "Error building turnover report", error: error.message });
  }
});

// ======================================================
// ABSENTEEISM — absence days per month vs total headcount
// GET /api/reports/absenteeism?companyId=&months=6
// ======================================================

router.get("/absenteeism", async (req, res) => {
  try {
    const company = await requireCompanyAccess(req, res, req.query.companyId);
    if (!company) return;

    const monthCount = Number(req.query.months) || 6;
    const months = lastNMonths(monthCount);

    const oldestStart = new Date(months[0].year, months[0].month - 1, 1);

    const absences = await Absence.find({
      company: company._id,
      status: "accepted",
      startDate: { $gte: oldestStart },
    }).select("startDate daysCount type");

    const activeEmployeeCount = await Employee.countDocuments({
      company: company._id,
      employmentStatus: "active",
    });

    const series = months.map(({ month, year }) => {
      const daysThisMonth = absences
        .filter((a) => {
          const d = new Date(a.startDate);
          return d.getMonth() + 1 === month && d.getFullYear() === year;
        })
        .reduce((sum, a) => sum + (a.daysCount || 0), 0);

      // Rough absenteeism rate: absence days / (headcount × ~22
      // working days in the month). Illustrative, not a certified
      // HR-metric formula — swap in your own definition if needed.
      const possibleWorkingDays = activeEmployeeCount * 22;
      const rate = possibleWorkingDays
        ? Math.round((daysThisMonth / possibleWorkingDays) * 10000) / 100
        : 0;

      return { month, year, absenceDays: daysThisMonth, ratePercent: rate };
    });

    res.json({ success: true, data: series });
  } catch (error) {
    console.error("GET absenteeism report error:", error);
    res.status(500).json({ success: false, message: "Error building absenteeism report", error: error.message });
  }
});

// ======================================================
// PAYROLL COST — gross/net/employer cost per month
// GET /api/reports/payroll-cost?companyId=&months=12
// ======================================================

router.get("/payroll-cost", async (req, res) => {
  try {
    const company = await requireCompanyAccess(req, res, req.query.companyId);
    if (!company) return;

    const months = lastNMonths(Number(req.query.months) || 12);

    const runs = await PayrollRun.find({
      company: company._id,
      status: { $ne: "voided" },
    }).select("month year totalGross totalNet totalEmployerCost");

    const series = months.map(({ month, year }) => {
      const run = runs.find((r) => r.month === month && r.year === year);
      return {
        month,
        year,
        totalGross: run?.totalGross || 0,
        totalNet: run?.totalNet || 0,
        totalEmployerCost: run?.totalEmployerCost || 0,
      };
    });

    res.json({ success: true, data: series });
  } catch (error) {
    console.error("GET payroll cost report error:", error);
    res.status(500).json({ success: false, message: "Error building payroll cost report", error: error.message });
  }
});

module.exports = router;
