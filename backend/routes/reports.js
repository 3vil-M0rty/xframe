const express = require("express");

const router = express.Router();

const Employee = require("../models/Employee");
const Absence = require("../models/Absence");
const PayrollRun = require("../models/PayrollRun");
const Salary = require("../models/Salary");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");

router.use(auth, requireHRAccess);

const { calculatePayslip } = require("../services/payrollCalculationService");

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

    const employees = await Employee.find({ company: company._id })
      .select("department employmentStatus employmentType")
      .populate("department", "name");

    const byDepartment = {};
    const byStatus = {};
    const byType = {};

    for (const emp of employees) {
      // department is now a Department reference, not a plain
      // string — group by its name (falling back to
      // "Unassigned" for employees with none set yet) rather than
      // the raw ObjectId, which wouldn't mean anything on a chart.
      const dept = emp.department?.name || "Unassigned";
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

/**
 * Live estimate of "what payroll would cost right now" — summed
 * directly from every active employee's CURRENT salary record
 * (endDate: null), run through the same calculation engine used
 * for real payslips. Independent of whether payroll has actually
 * been RUN for any period yet, unlike everything else in this
 * file (which reads PayrollRun/Payslip history) — this is what
 * lets the Reports page show a meaningful number the moment
 * salaries are entered, instead of staying at 0 until the first
 * "Generate payroll" happens.
 */
async function computeCurrentPayrollEstimate(companyId) {
  const employees = await Employee.find({
    company: companyId,
    employmentStatus: "active",
  }).select("_id numberOfDependents");

  const currentSalaries = await Salary.find({
    employee: { $in: employees.map((e) => e._id) },
    endDate: null,
  });

  const salaryByEmployee = new Map(
    currentSalaries.map((s) => [s.employee.toString(), s])
  );

  let totalGross = 0;
  let totalNet = 0;
  let totalEmployerCost = 0;
  let employeesWithSalary = 0;

  for (const employee of employees) {
    const salary = salaryByEmployee.get(employee._id.toString());
    if (!salary) continue;

    const calc = calculatePayslip({
      baseSalary: salary.baseSalary,
      allowances: salary.allowances,
      numberOfDependents: employee.numberOfDependents || 0,
    });

    totalGross += calc.grossSalary;
    totalNet += calc.netSalary;
    totalEmployerCost += calc.employer.totalEmployerCost;
    employeesWithSalary += 1;
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  return {
    totalGross: round2(totalGross),
    totalNet: round2(totalNet),
    totalEmployerCost: round2(totalEmployerCost),
    employeesWithSalary,
    employeesWithoutSalary: employees.length - employeesWithSalary,
  };
}

// ======================================================
// CURRENT PAYROLL COST ESTIMATE (live, not run-dependent)
// GET /api/reports/current-payroll-estimate?companyId=
// ======================================================

router.get("/current-payroll-estimate", async (req, res) => {
  try {
    const company = await requireCompanyAccess(req, res, req.query.companyId);
    if (!company) return;

    const estimate = await computeCurrentPayrollEstimate(company._id);
    res.json({ success: true, data: estimate });
  } catch (error) {
    console.error("GET current payroll estimate error:", error);
    res.status(500).json({ success: false, message: "Error computing current payroll estimate", error: error.message });
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

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Only compute the live estimate if we'll actually need it
    // (i.e. the current month has no real run yet) — avoids the
    // extra work on every request.
    const needsEstimate = !runs.some(
      (r) => r.month === currentMonth && r.year === currentYear
    );
    const estimate = needsEstimate
      ? await computeCurrentPayrollEstimate(company._id)
      : null;

    const series = months.map(({ month, year }) => {
      const run = runs.find((r) => r.month === month && r.year === year);

      if (run) {
        return {
          month,
          year,
          totalGross: run.totalGross || 0,
          totalNet: run.totalNet || 0,
          totalEmployerCost: run.totalEmployerCost || 0,
          estimated: false,
        };
      }

      // No real run for this period. For the CURRENT month only,
      // fall back to the live estimate (clearly flagged) rather
      // than a flat, misleading 0 — there's no honest way to
      // backfill a number for a genuinely past, un-run period.
      const isCurrentMonth = month === currentMonth && year === currentYear;

      return {
        month,
        year,
        totalGross: isCurrentMonth ? estimate.totalGross : 0,
        totalNet: isCurrentMonth ? estimate.totalNet : 0,
        totalEmployerCost: isCurrentMonth ? estimate.totalEmployerCost : 0,
        estimated: isCurrentMonth,
      };
    });

    res.json({ success: true, data: series });
  } catch (error) {
    console.error("GET payroll cost report error:", error);
    res.status(500).json({ success: false, message: "Error building payroll cost report", error: error.message });
  }
});

module.exports = router;
