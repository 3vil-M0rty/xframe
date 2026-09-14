const Absence = require("../models/Absence");

/**
 * ============================================================
 * LEAVE BALANCE SERVICE
 * ============================================================
 * Deliberately NOT a stored running balance — accrued days are
 * computed from the employee's hire date every time this is
 * called, and used days are computed by summing approved
 * "paid_leave" absences. That means there's nothing to keep in
 * sync by hand and no risk of the stored number drifting from
 * reality; the trade-off is one extra query per balance check,
 * which is cheap at this scale.
 *
 * Morocco's labor code sets a MINIMUM statutory accrual of 1.5
 * days per full month of service (18 days/year) for employees
 * under 6 months' seniority scaling up with tenure in some
 * conventions — this implementation uses the simple, common
 * 1.5 days/month baseline. Companies with a more generous policy
 * should adjust ACCRUAL_DAYS_PER_MONTH below (or make it a
 * per-company setting later — it's isolated here on purpose so
 * that's a one-line change).
 * ============================================================
 */

const ACCRUAL_DAYS_PER_MONTH = 1.5;

function monthsBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  // Only count a month as "complete" once we've passed the same
  // day-of-month as the hire date (matches "1.5 days accrued per
  // full month worked").
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(months, 0);
}

/**
 * @param {Object} employee - must have `hireDate`
 * @param {Date} [asOf] - defaults to now
 */
async function getLeaveBalance(employee, asOf = new Date()) {
  if (!employee?.hireDate) {
    return {
      accruedDays: 0,
      usedDays: 0,
      remainingDays: 0,
      accrualDaysPerMonth: ACCRUAL_DAYS_PER_MONTH,
    };
  }

  const monthsWorked = monthsBetween(employee.hireDate, asOf);
  const accruedDays = Math.round(monthsWorked * ACCRUAL_DAYS_PER_MONTH * 100) / 100;

  const approvedLeave = await Absence.find({
    employee: employee._id,
    type: "paid_leave",
    status: "accepted",
  }).select("daysCount");

  const usedDays = approvedLeave.reduce(
    (sum, absence) => sum + (absence.daysCount || 0),
    0
  );

  const remainingDays = Math.round((accruedDays - usedDays) * 100) / 100;

  return {
    accruedDays,
    usedDays,
    remainingDays,
    accrualDaysPerMonth: ACCRUAL_DAYS_PER_MONTH,
  };
}

module.exports = {
  getLeaveBalance,
  ACCRUAL_DAYS_PER_MONTH,
};
