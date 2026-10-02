const express = require("express");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");

const Employee = require("../models/Employee");
const Company = require("../models/Company");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");
const { has: hasPerm } = require("../services/permissionService");
const { getLeaveBalance, RULES } = require("../services/leaveBalanceService");
const { logAudit } = require("../services/auditLogger");

/**
 * ============================================================
 * PAID LEAVE BALANCES (HR) — /api/leave
 * ============================================================
 * GET   /balances?companyId=         every active employee's balance
 * GET   /balances/export?companyId=  same, as Excel
 * PATCH /opening-balance/:employeeId { days, asOf, note } | { clear: true }
 * Rules: services/leaveBalanceService.js (Code du travail art. 231–240).
 * ============================================================
 */

const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.leave));
router.use(auth, requireHRAccess);

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));

async function loadCompany(req, res) {
  const { companyId } = req.query;
  if (!isId(companyId)) {
    res.status(400).json({ success: false, message: "A valid companyId is required" });
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

async function balancesFor(company) {
  const employees = await Employee.find({ company: company._id, employmentStatus: { $ne: "terminated" } })
    .select("firstName lastName employeeNumber jobTitle hireDate dateOfBirth leaveOpeningBalance company")
    .sort({ lastName: 1, firstName: 1 })
    .lean();
  const extraDaysPerYear = company.settings?.extraLeaveDaysPerYear || 0;
  return Promise.all(
    employees.map(async (e) => ({
      employee: {
        _id: e._id,
        firstName: e.firstName,
        lastName: e.lastName,
        employeeNumber: e.employeeNumber,
        jobTitle: e.jobTitle,
        hireDate: e.hireDate,
      },
      balance: await getLeaveBalance(e, new Date(), { extraDaysPerYear }),
    }))
  );
}

router.get("/balances", async (req, res) => {
  try {
    const company = await loadCompany(req, res);
    if (!company) return;
    res.json({
      success: true,
      data: await balancesFor(company),
      rules: { ...RULES, extraLeaveDaysPerYear: company.settings?.extraLeaveDaysPerYear || 0 },
    });
  } catch (error) {
    console.error("GET leave balances error:", error);
    res.status(500).json({ success: false, message: "Error computing leave balances", error: error.message });
  }
});

router.get("/balances/export", async (req, res) => {
  try {
    const company = await loadCompany(req, res);
    if (!company) return;
    const rows = await balancesFor(company);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Soldes de congés");
    ws.columns = [
      { header: "Matricule", key: "num", width: 12 },
      { header: "Nom et prénom", key: "name", width: 28 },
      { header: "Date d'embauche", key: "hire", width: 15 },
      { header: "Ancienneté (ans)", key: "years", width: 15 },
      { header: "Droit annuel (jours)", key: "annual", width: 18 },
      { header: "dont ancienneté", key: "bonus", width: 15 },
      { header: "Solde d'ouverture", key: "opening", width: 17 },
      { header: "Acquis", key: "accrued", width: 10 },
      { header: "Pris", key: "used", width: 10 },
      { header: "Pris cette année", key: "year", width: 15 },
      { header: "Solde", key: "remaining", width: 10 },
      { header: "Alerte", key: "alert", width: 40 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const { employee: e, balance: b } of rows) {
      ws.addRow({
        num: e.employeeNumber || "",
        name: `${e.lastName || ""} ${e.firstName || ""}`.trim(),
        hire: e.hireDate ? new Date(e.hireDate) : "",
        years: b.seniorityYears,
        annual: b.annualEntitlement,
        bonus: b.seniorityBonusDays,
        opening: b.openingBalance ? b.openingBalance.days : "",
        accrued: b.accruedDays,
        used: b.usedDays,
        year: b.takenThisYear,
        remaining: b.remainingDays,
        alert: b.missingHireDate
          ? "Date d'embauche manquante"
          : b.excessCarryOver
            ? "Plus de 2 ans de congés accumulés (report sur accord — art. 240)"
            : "",
      });
    }
    ws.getColumn("hire").numFmt = "dd/mm/yyyy";
    ws.addRow([]);
    ws.addRow(["Règles : 1,5 jour ouvrable par mois (2 pour les moins de 18 ans), +1,5 jour par 5 ans d'ancienneté, 30 jours maximum par an (Code du travail, art. 231–232)."]);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="soldes-conges-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("GET leave balances export error:", error);
    res.status(500).json({ success: false, message: "Error exporting leave balances", error: error.message });
  }
});

router.patch("/opening-balance/:employeeId", async (req, res) => {
  try {
    if (!hasPerm(req.user, "hr.leave.edit")) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    if (!isId(req.params.employeeId)) return res.status(400).json({ success: false, message: "Invalid employee ID" });
    const employee = await Employee.findById(req.params.employeeId).populate("company");
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    if (!canAccessHRForCompany(req.user, employee.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const before = employee.leaveOpeningBalance ? { ...employee.leaveOpeningBalance.toObject?.() } : null;
    if (req.body.clear) {
      employee.leaveOpeningBalance = { days: null, asOf: null, note: "" };
    } else {
      const days = Number(req.body.days);
      const asOf = new Date(req.body.asOf);
      if (!Number.isFinite(days) || days < -60 || days > 365) {
        return res.status(400).json({ success: false, message: "Enter the number of days (can be negative if leave was taken in advance)" });
      }
      if (!req.body.asOf || Number.isNaN(asOf.getTime())) {
        return res.status(400).json({ success: false, message: "Enter the date of this balance" });
      }
      if (employee.hireDate && asOf < new Date(employee.hireDate)) {
        return res.status(400).json({ success: false, message: "The balance date can't be before the hire date" });
      }
      if (asOf > new Date()) {
        return res.status(400).json({ success: false, message: "The balance date can't be in the future" });
      }
      employee.leaveOpeningBalance = { days, asOf, note: String(req.body.note || "").slice(0, 300) };
    }
    employee.markModified("leaveOpeningBalance");
    await employee.save();

    await logAudit(req, {
      company: employee.company._id,
      action: "update",
      resourceType: "Employee",
      resourceId: employee._id,
      resourceLabel: `${employee.firstName} ${employee.lastName} — solde de congés d'ouverture`,
      before,
      after: employee.leaveOpeningBalance,
    });

    res.json({ success: true, data: await getLeaveBalance(employee) });
  } catch (error) {
    console.error("PATCH leave opening balance error:", error);
    res.status(500).json({ success: false, message: "Error saving the opening balance", error: error.message });
  }
});

module.exports = router;
