const Absence = require("../models/Absence");
const Advance = require("../models/Advance");
const Attendance = require("../models/Attendance");

/**
 * ============================================================
 * PAYROLL ATTENDANCE/ABSENCE/ADVANCE INTEGRATION
 * ============================================================
 * Used by routes/payroll.js when generating a run — this is what
 * makes absences, advances, and attendance actually affect a
 * payslip instead of just sitting there as separate records.
 * Every number this returns feeds directly into
 * services/payrollCalculationService.js's calculatePayslip()
 * inputs (unpaidDeduction, overtimeAmount, deductions).
 * ============================================================
 */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Unpaid-leave / unjustified-absence deduction: any ACCEPTED
 * absence of type "unpaid_leave", or type "absence" that's
 * unjustified, overlapping the pay period, reduces the base
 * salary proportionally — dailyRate × unpaid days.
 */
async function computeUnpaidDeduction({ employeeId, periodStart, periodEnd, baseSalary, standardMonthlyDays = 26 }) {
  const absences = await Absence.find({
    employee: employeeId,
    status: "accepted",
    startDate: { $lte: periodEnd },
    endDate: { $gte: periodStart },
    $or: [{ type: "unpaid_leave" }, { type: "absence", justified: false }],
  }).select("daysCount");

  const unpaidDays = absences.reduce((sum, a) => sum + (a.daysCount || 0), 0);

  if (unpaidDays === 0) return { unpaidDeduction: 0, unpaidDays: 0 };

  const dailyRate = baseSalary / standardMonthlyDays;
  return { unpaidDeduction: round2(dailyRate * unpaidDays), unpaidDays };
}

/**
 * Advance repayment: every ACCEPTED, not-yet-fully-repaid advance
 * for this employee has its full remaining balance deducted from
 * THIS payslip (there's no installment-plan concept yet — one
 * advance is repaid in one go on the next payroll run after it was
 * accepted). Returns both the deduction line items (for the
 * payslip) and the list of {advance, amount} pairs the caller
 * should mark as repaid once the run is actually saved.
 */
async function computeAdvanceDeductions({ employeeId }) {
  const advances = await Advance.find({
    employee: employeeId,
    status: "accepted",
    repaid: false,
  });

  const deductionItems = [];
  const toMarkRepaid = [];

  for (const advance of advances) {
    const remaining = round2((advance.amount || 0) - (advance.repaidAmount || 0));
    if (remaining <= 0) continue;

    deductionItems.push({ label: "Avance sur salaire", amount: remaining });
    toMarkRepaid.push({ advanceId: advance._id, amount: remaining });
  }

  return { deductionItems, toMarkRepaid };
}

/**
 * Overtime pay + late/early-leave deductions, computed from
 * Attendance records in the pay period — each one independently
 * gated by the company's WorkSchedule.hoursManagement toggles, so
 * an admin can turn overtime pay on without turning on lateness
 * deductions, or vice versa.
 */
async function computeHoursAdjustments({ employeeId, periodStart, periodEnd, baseSalary, hoursManagement }) {
  const result = { overtimeAmount: 0, holidayAmount: 0, holidayHours: 0, deductionItems: [] };

  const records = await Attendance.find({
    employee: employeeId,
    date: { $gte: periodStart, $lte: periodEnd },
  }).select("overtimeMinutes lateMinutes earlyLeaveMinutes holidayMinutes holidayPayRate");

  const hourlyRate = baseSalary / (hoursManagement?.monthlyStandardHours || 191);

  // Public holidays (jours fériés) worked. The monthly salary already
  // pays the holiday itself (jour férié payé), so "double" adds ONE
  // extra hourly rate per hour worked on it, and "normal" adds
  // nothing. Applied whatever the overtime settings are: the rate is
  // chosen per holiday by HR (models/PublicHoliday.js).
  let premiumHours = 0;
  for (const r of records) {
    if (!r.holidayMinutes) continue;
    result.holidayHours += r.holidayMinutes / 60;
    premiumHours += (r.holidayMinutes / 60) * Math.max((r.holidayPayRate || 1) - 1, 0);
  }
  result.holidayHours = round2(result.holidayHours);
  result.holidayAmount = round2(hourlyRate * premiumHours);

  if (!hoursManagement) return result;

  if (hoursManagement.payOvertime) {
    const totalOvertimeMinutes = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
    if (totalOvertimeMinutes > 0) {
      const overtimeHours = totalOvertimeMinutes / 60;
      result.overtimeAmount = round2(
        hourlyRate * (hoursManagement.overtimeRate || 1.25) * overtimeHours
      );
    }
  }

  let deductibleMinutes = 0;
  if (hoursManagement.deductLateArrival) {
    deductibleMinutes += records.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
  }
  if (hoursManagement.deductEarlyLeave) {
    deductibleMinutes += records.reduce((sum, r) => sum + (r.earlyLeaveMinutes || 0), 0);
  }

  if (deductibleMinutes > 0) {
    const deductionHours = deductibleMinutes / 60;
    const amount = round2(hourlyRate * (hoursManagement.deductionRate || 1) * deductionHours);
    if (amount > 0) {
      result.deductionItems.push({ label: "Retard / départ anticipé", amount });
    }
  }

  return result;
}

/**
 * The one function routes/payroll.js actually calls — bundles all
 * three adjustments above for one employee's pay period.
 */
async function computePayrollAdjustments({
  employeeId,
  month,
  year,
  baseSalary,
  hoursManagement,
}) {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [unpaid, advances, hours] = await Promise.all([
    computeUnpaidDeduction({ employeeId, periodStart, periodEnd, baseSalary }),
    computeAdvanceDeductions({ employeeId }),
    computeHoursAdjustments({ employeeId, periodStart, periodEnd, baseSalary, hoursManagement }),
  ]);

  return {
    unpaidDeduction: unpaid.unpaidDeduction,
    unpaidDays: unpaid.unpaidDays,
    overtimeAmount: hours.overtimeAmount,
    holidayAmount: hours.holidayAmount,
    holidayHours: hours.holidayHours,
    otherDeductions: [...advances.deductionItems, ...hours.deductionItems],
    advancesToMarkRepaid: advances.toMarkRepaid,
  };
}

module.exports = {
  computePayrollAdjustments,
  computeUnpaidDeduction,
  computeAdvanceDeductions,
  computeHoursAdjustments,
};
