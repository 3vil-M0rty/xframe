const Absence = require("../models/Absence");

/**
 * ============================================================
 * LEAVE BALANCE SERVICE — Code du travail (Loi 65-99)
 * ============================================================
 * Paid annual leave, as the labour code defines it:
 *
 *   Art. 231 — 1.5 working days per month of service
 *              (2 days per month for employees under 18).
 *   Art. 232 — +1.5 days per full period of 5 years of service,
 *              the total never exceeding 30 working days a year.
 *   Art. 240 — leave can be carried over to the following year
 *              only by agreement; the balance shows a warning when
 *              more than 2 years' worth is accumulated.
 *
 * Not a stored running balance: accrued days are recomputed from
 * the hire date (or from the opening balance HR entered when the
 * company started using the app) every time, and used days are
 * the accepted "paid_leave" absences — nothing to keep in sync.
 *
 * Leave days are WORKING days (see services/workingDays.js): a
 * Monday-to-Monday week of leave on a Monday–Saturday schedule
 * costs 6 days, not 8, and closed public holidays don't count.
 *
 * Companies giving MORE than the legal minimum (collective
 * agreement, company policy) set Company.settings.extraLeaveDaysPerYear.
 * ============================================================
 */

const RULES = Object.freeze({
  DAYS_PER_MONTH: 1.5,
  DAYS_PER_MONTH_MINOR: 2,
  MINOR_AGE: 18,
  SENIORITY_STEP_YEARS: 5,
  SENIORITY_BONUS_DAYS: 1.5,
  ANNUAL_CAP: 30,
  CARRY_OVER_WARNING_YEARS: 2,
});

// Kept for callers of the previous version.
const ACCRUAL_DAYS_PER_MONTH = RULES.DAYS_PER_MONTH;

const round2 = (n) => Math.round(n * 100) / 100;

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/** Full months between two dates ("one month" = same day-of-month reached). */
function monthsBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

function fullYearsBetween(from, to) {
  return Math.floor(monthsBetween(from, to) / 12);
}

/**
 * Yearly entitlement on a given date.
 * @returns {{ base, seniorityYears, seniorityBonus, extra, total, isMinor, monthlyRate }}
 */
function annualEntitlement({ hireDate, dateOfBirth, at = new Date(), extraDaysPerYear = 0 }) {
  const isMinor = !!dateOfBirth && fullYearsBetween(dateOfBirth, at) < RULES.MINOR_AGE;
  const base = 12 * (isMinor ? RULES.DAYS_PER_MONTH_MINOR : RULES.DAYS_PER_MONTH);
  const seniorityYears = hireDate ? fullYearsBetween(hireDate, at) : 0;
  const seniorityBonus = Math.floor(seniorityYears / RULES.SENIORITY_STEP_YEARS) * RULES.SENIORITY_BONUS_DAYS;
  const legal = Math.min(base + seniorityBonus, RULES.ANNUAL_CAP);
  const extra = Math.max(Number(extraDaysPerYear) || 0, 0);
  const total = legal + extra;
  return { base, seniorityYears, seniorityBonus, legal, extra, total, isMinor, monthlyRate: round2(total / 12) };
}

/**
 * Days accrued between `from` and `asOf`, month by month, each month
 * at the rate in force on that month (seniority and age change
 * over time).
 */
function accruedBetween({ from, asOf, hireDate, dateOfBirth, extraDaysPerYear }) {
  const months = monthsBetween(from, asOf);
  let total = 0;
  for (let m = 1; m <= months; m += 1) {
    // Rate in force when that month of service BEGAN: the month that
    // ends on the 5-year anniversary was still worked before it.
    const at = addMonths(from, m - 1);
    total += annualEntitlement({ hireDate, dateOfBirth, at, extraDaysPerYear }).total / 12;
  }
  return round2(total);
}

/**
 * @param {Object} employee - hireDate, dateOfBirth, leaveOpeningBalance?
 * @param {Date} [asOf]
 * @param {Object} [options] - { extraDaysPerYear } (company policy above the law)
 */
async function getLeaveBalance(employee, asOf = new Date(), options = {}) {
  const at = new Date(asOf);
  let { extraDaysPerYear } = options;
  if (extraDaysPerYear === undefined && employee?.company) {
    // Company policy above the legal minimum, if any.
    const Company = require("../models/Company");
    const company = employee.company.settings
      ? employee.company
      : await Company.findById(employee.company._id || employee.company).select("settings.extraLeaveDaysPerYear").lean();
    extraDaysPerYear = company?.settings?.extraLeaveDaysPerYear || 0;
  }
  extraDaysPerYear = extraDaysPerYear || 0;
  if (!employee?.hireDate) {
    return {
      accruedDays: 0,
      usedDays: 0,
      remainingDays: 0,
      accrualDaysPerMonth: RULES.DAYS_PER_MONTH,
      annualEntitlement: 0,
      seniorityBonusDays: 0,
      seniorityYears: 0,
      isMinor: false,
      openingBalance: null,
      takenThisYear: 0,
      excessCarryOver: false,
      missingHireDate: true,
    };
  }

  const opening = employee.leaveOpeningBalance?.asOf ? employee.leaveOpeningBalance : null;
  const accrualStart = opening ? new Date(opening.asOf) : new Date(employee.hireDate);

  const accrued = round2(
    (opening ? Number(opening.days) || 0 : 0) +
      accruedBetween({
        from: accrualStart,
        asOf: at,
        hireDate: employee.hireDate,
        dateOfBirth: employee.dateOfBirth,
        extraDaysPerYear,
      })
  );

  // Leave taken before the opening balance date is already reflected
  // in that balance — only count what was taken from then on.
  const filter = { employee: employee._id, type: "paid_leave", status: "accepted", startDate: { $lte: at } };
  if (opening) filter.startDate.$gte = accrualStart;
  const approvedLeave = await Absence.find(filter).select("daysCount startDate");

  const usedDays = round2(approvedLeave.reduce((s, a) => s + (a.daysCount || 0), 0));
  const yearStart = new Date(at.getFullYear(), 0, 1);
  const takenThisYear = round2(
    approvedLeave.filter((a) => new Date(a.startDate) >= yearStart).reduce((s, a) => s + (a.daysCount || 0), 0)
  );

  const ent = annualEntitlement({ hireDate: employee.hireDate, dateOfBirth: employee.dateOfBirth, at, extraDaysPerYear });
  const remainingDays = round2(accrued - usedDays);

  return {
    accruedDays: accrued,
    usedDays,
    remainingDays,
    accrualDaysPerMonth: ent.monthlyRate,
    annualEntitlement: ent.total,
    legalEntitlement: ent.legal,
    extraDaysPerYear: ent.extra,
    seniorityBonusDays: ent.seniorityBonus,
    seniorityYears: ent.seniorityYears,
    isMinor: ent.isMinor,
    openingBalance: opening ? { days: Number(opening.days) || 0, asOf: opening.asOf } : null,
    takenThisYear,
    // Art. 240: carrying leave over needs an agreement; more than two
    // years' worth piling up is worth a look.
    excessCarryOver: remainingDays > ent.total * RULES.CARRY_OVER_WARNING_YEARS,
  };
}

module.exports = {
  getLeaveBalance,
  annualEntitlement,
  accruedBetween,
  monthsBetween,
  RULES,
  ACCRUAL_DAYS_PER_MONTH,
};
