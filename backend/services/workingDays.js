const PublicHoliday = require("../models/PublicHoliday");

/**
 * ============================================================
 * WORKING DAYS IN A PERIOD
 * ============================================================
 * How many days of an absence actually count: days the company's
 * work schedule marks as working days (Organisation → Work
 * schedule; Monday–Saturday by default, i.e. the labour code's
 * "jours ouvrables"), minus public holidays on which the company
 * is closed (HR → Public holidays).
 *
 * Used for paid leave (a week of leave costs 6 days on a Monday–
 * Saturday schedule, not 7), unpaid leave and unjustified absences.
 * Sick leave keeps calendar days — that's how medical certificates
 * and CNSS daily allowances count.
 * ============================================================
 */

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DEFAULT_WORKING = new Set([1, 2, 3, 4, 5, 6]); // Monday–Saturday

// Types counted in working days; the others stay in calendar days.
const WORKING_DAY_TYPES = new Set(["paid_leave", "unpaid_leave", "absence", "other"]);

function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(v) {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calendarDays(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  return Math.round((end - start) / 86400000) + 1;
}

/**
 * Pure: counts working days given a set of working weekdays and the
 * closed holidays ("YYYY-MM-DD").
 */
function countWorkingDays(startDate, endDate, { workingWeekdays = DEFAULT_WORKING, closedDays = new Set() } = {}) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (workingWeekdays.has(d.getDay()) && !closedDays.has(dayKey(d))) count += 1;
  }
  return count;
}

async function loadCalendar(companyId, startDate, endDate, employeeId = null) {
  const { scheduleForEmployee, defaultSchedule } = require("./scheduleResolver");
  const [schedule, holidays] = await Promise.all([
    // The employee's (department) schedule, else the company default.
    employeeId ? scheduleForEmployee(employeeId, companyId, { lean: true }) : defaultSchedule(companyId, { create: false, lean: true }),
    PublicHoliday.find({
      company: companyId,
      isWorkingDay: false,
      day: { $gte: dayKey(startOfDay(startDate)), $lte: dayKey(startOfDay(endDate)) },
    }).select("day").lean(),
  ]);
  const workingWeekdays = schedule
    ? new Set(DAY_KEYS.map((k, i) => (schedule[k] && schedule[k].isWorkingDay === false ? null : i)).filter((i) => i !== null))
    : DEFAULT_WORKING;
  return { workingWeekdays, closedDays: new Set(holidays.map((h) => h.day)) };
}

/**
 * Days an absence counts for.
 * @returns {Promise<number>} 0.5 for a half day, else whole days (may be 0
 *   when the period has no working day at all — callers reject that).
 */
async function countAbsenceDays({ companyId, employeeId = null, type, startDate, endDate, halfDay }) {
  let days;
  if (WORKING_DAY_TYPES.has(type)) {
    days = countWorkingDays(startDate, endDate, await loadCalendar(companyId, startDate, endDate, employeeId));
  } else {
    days = Math.max(calendarDays(startDate, endDate), 1);
  }
  if (halfDay) return days > 0 ? 0.5 : 0;
  return days;
}

module.exports = { countWorkingDays, countAbsenceDays, calendarDays, loadCalendar, WORKING_DAY_TYPES, dayKey };
