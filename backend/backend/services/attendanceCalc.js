/**
 * ============================================================
 * ATTENDANCE CALCULATIONS (continuous and split shifts)
 * ============================================================
 * Pure functions, no database access — every rule about "which punch
 * comes next", "how late", "how early", "how much overtime" lives
 * here, so clock-in/out, HR edits and tests all use the exact same
 * logic.
 *
 * A day's schedule is one of two shapes, chosen by the admin in
 * Organization > Work schedule (see models/WorkSchedule.js):
 *
 *   continuous:  start ─────────────────────────── end
 *                e.g. 09:00 → 16:00                  2 punches
 *
 *   split:       start ──── breakStart   breakEnd ──── end
 *                e.g. 08:00 → 12:00       14:00 → 18:00   4 punches
 *
 * Punches on an Attendance record:
 *   clockIn   — morning in   (both shapes)
 *   breakOut  — midday out   (split only)
 *   breakIn   — midday in    (split only)
 *   clockOut  — final out    (both shapes)
 *
 * All schedule times are minutes since midnight of the attendance
 * date.
 * ============================================================
 */

const DEFAULTS = { startHour: 9, startMinute: 0, workHours: 8, graceMinutes: 10 };

const toMinutes = (hour, minute) => (Number(hour) || 0) * 60 + (Number(minute) || 0);
const isSet = (v) => v !== undefined && v !== null && v !== "";

/**
 * Normalizes a stored day config into concrete minute values.
 * Backward compatible: a config saved before end times existed
 * (start + workHours only) resolves to a continuous shift ending
 * workHours after the start.
 */
function resolveDaySchedule(dayConfig = {}) {
  const cfg = { ...DEFAULTS, ...dayConfig };
  const start = toMinutes(cfg.startHour, cfg.startMinute);
  const split = !!cfg.splitShift && isSet(cfg.breakStartHour) && isSet(cfg.breakEndHour);

  let breakStart = null;
  let breakEnd = null;
  if (split) {
    breakStart = toMinutes(cfg.breakStartHour, cfg.breakStartMinute);
    breakEnd = toMinutes(cfg.breakEndHour, cfg.breakEndMinute);
  }

  let end;
  if (isSet(cfg.endHour)) {
    end = toMinutes(cfg.endHour, cfg.endMinute);
  } else {
    // Legacy config: derive the end from the number of hours.
    end = start + Math.round((Number(cfg.workHours) || 0) * 60) + (split ? breakEnd - breakStart : 0);
  }

  const expectedMinutes = Math.max(end - start - (split ? breakEnd - breakStart : 0), 0);

  return {
    isWorkingDay: cfg.isWorkingDay !== false,
    split,
    start,
    end,
    breakStart,
    breakEnd,
    expectedMinutes,
    graceMinutes: Number(cfg.graceMinutes) || 0,
  };
}

/**
 * Checks a day config makes sense before it's saved. Returns an
 * error message, or null when valid.
 */
function validateDayConfig(dayConfig) {
  if (dayConfig?.isWorkingDay === false) return null;
  const s = resolveDaySchedule(dayConfig);
  if (s.end <= s.start) return "The end time must be after the start time";
  if (s.split) {
    if (!(s.start < s.breakStart && s.breakStart < s.breakEnd && s.breakEnd < s.end)) {
      return "Split shift times must be in order: morning in < midday out < midday in < final out";
    }
  }
  return null;
}

/** Punch order for a schedule shape. */
function punchSequence(schedule) {
  return schedule.split ? ["clockIn", "breakOut", "breakIn", "clockOut"] : ["clockIn", "clockOut"];
}

/**
 * The next punch expected on `record` (null once the day is done).
 * A record that already has a clockOut is always done, even on a
 * split day where the midday punches were skipped.
 */
function nextPunch(record, schedule) {
  if (record?.clockOut) return null;
  return punchSequence(schedule).find((field) => !record?.[field]) || null;
}

/** "in" for clockIn/breakIn, "out" for breakOut/clockOut. */
const punchDirection = (field) => (field === "clockIn" || field === "breakIn" ? "in" : "out");

/** Minutes since midnight of `dayStart` for a timestamp. */
function minutesOfDay(timestamp, dayStart) {
  return Math.round((new Date(timestamp) - new Date(dayStart)) / 60000);
}

/**
 * Recomputes every derived figure on an attendance record from its
 * punches and the day's schedule. Returns the fields to assign —
 * callers do `Object.assign(record, computeDay(...))`.
 */
function computeDay(record, schedule, dayStart) {
  const m = (field) => (record?.[field] ? minutesOfDay(record[field], dayStart) : null);
  const clockIn = m("clockIn");
  const breakOut = m("breakOut");
  const breakIn = m("breakIn");
  const clockOut = m("clockOut");

  // ---- time actually worked ----
  let worked = 0;
  if (schedule.split && breakOut !== null && clockIn !== null) {
    worked += Math.max(breakOut - clockIn, 0);
    if (breakIn !== null && clockOut !== null) worked += Math.max(clockOut - breakIn, 0);
  } else if (clockIn !== null && clockOut !== null) {
    // Continuous day — or a split day where the midday punches were
    // never recorded: count the whole span, minus the scheduled
    // break on a split day (it's unpaid time either way).
    const breakLength = schedule.split ? schedule.breakEnd - schedule.breakStart : 0;
    worked = Math.max(clockOut - clockIn - breakLength, 0);
  }

  const grace = schedule.graceMinutes;
  const lateness = (actual, expected) => (actual === null ? 0 : Math.max(actual - expected - grace, 0));
  const earliness = (actual, expected) => (actual === null ? 0 : Math.max(expected - actual - grace, 0));

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  if (schedule.isWorkingDay) {
    lateMinutes += lateness(clockIn, schedule.start);
    if (schedule.split) {
      lateMinutes += lateness(breakIn, schedule.breakEnd);          // late back from lunch
      earlyLeaveMinutes += earliness(breakOut, schedule.breakStart); // left for lunch early
    }
    earlyLeaveMinutes += earliness(clockOut, schedule.end);
  }

  // Overtime (heures supplémentaires) is only known once the day is
  // finished. On a rest day nothing is expected, so every minute
  // worked is overtime.
  const dayDone = clockOut !== null;
  const expected = schedule.isWorkingDay ? schedule.expectedMinutes : 0;
  let overtimeMinutes = dayDone ? Math.max(worked - expected, 0) : 0;

  // Public holiday (jour férié — see models/PublicHoliday.js). Hours
  // worked on it go to holidayMinutes, paid at the holiday's rate by
  // payroll, instead of being counted twice:
  //   company CLOSED: every minute worked is holiday time (not overtime)
  //   company OPEN:   the scheduled part is holiday time; anything
  //                   beyond the schedule stays ordinary overtime
  let holidayMinutes = 0;
  let holidayPayRate = null;
  if (schedule.holiday) {
    holidayPayRate = schedule.holiday.payRate;
    if (schedule.holiday.closed) {
      holidayMinutes = worked;
      overtimeMinutes = 0;
    } else {
      holidayMinutes = Math.max(worked - overtimeMinutes, 0);
    }
  }

  return {
    hoursWorked: Math.round((worked / 60) * 100) / 100,
    lateMinutes,
    earlyLeaveMinutes,
    leftEarly: earlyLeaveMinutes > 0,
    overtimeMinutes,
    holidayMinutes,
    holidayPayRate,
    status: schedule.isWorkingDay && lateMinutes > 0 ? "late" : "present",
  };
}

/**
 * Applies a public holiday (models/PublicHoliday) on top of a
 * resolved day schedule. A CLOSED holiday makes it a non-working day
 * (no lateness, nothing expected); an OPEN one keeps the normal
 * schedule. Either way the holiday is attached for computeDay.
 */
function applyHoliday(schedule, holiday) {
  if (!holiday) return schedule;
  const closed = !holiday.isWorkingDay;
  return {
    ...schedule,
    isWorkingDay: closed ? false : schedule.isWorkingDay,
    holiday: { name: holiday.name, closed, payRate: holiday.payRate === 1 ? 1 : 2 },
  };
}

module.exports = {
  resolveDaySchedule,
  applyHoliday,
  validateDayConfig,
  punchSequence,
  nextPunch,
  punchDirection,
  computeDay,
};
