const mongoose = require("mongoose");

/**
 * ============================================================
 * WORK SCHEDULE
 * ============================================================
 * One document per company, holding a config for each day of the
 * week. This is what routes/attendance.js reads instead of a
 * single hardcoded 9am/8h/10min constant — different companies
 * (and different days within the same company, e.g. a shorter
 * Friday) can have different expectations.
 *
 * `startHour`/`startMinute` is when the workday is expected to
 * begin; clocking in later than that PLUS `graceMinutes` marks the
 * record "late". `workHours` is the expected shift length, used to
 * compute overtime on clock-out (anything worked beyond it).
 * `isWorkingDay: false` (typically the weekend) means attendance
 * isn't expected at all that day.
 * ============================================================
 */

const dayConfigSchema = new mongoose.Schema(
  {
    isWorkingDay: { type: Boolean, default: true },
    startHour: { type: Number, default: 9, min: 0, max: 23 },
    startMinute: { type: Number, default: 0, min: 0, max: 59 },
    workHours: { type: Number, default: 8, min: 0, max: 24 },
    graceMinutes: { type: Number, default: 10, min: 0, max: 180 },
  },
  { _id: false }
);

function defaultWorkday() {
  return { isWorkingDay: true, startHour: 9, startMinute: 0, workHours: 8, graceMinutes: 10 };
}

function defaultWeekend() {
  return { isWorkingDay: false, startHour: 9, startMinute: 0, workHours: 8, graceMinutes: 10 };
}

const workScheduleSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },

    // Morocco's standard work week is Monday–Friday/Saturday
    // depending on the sector — Saturday defaults to a working day
    // here (common in retail/industry) but is easy to toggle off
    // per company.
    monday: { type: dayConfigSchema, default: defaultWorkday },
    tuesday: { type: dayConfigSchema, default: defaultWorkday },
    wednesday: { type: dayConfigSchema, default: defaultWorkday },
    thursday: { type: dayConfigSchema, default: defaultWorkday },
    friday: { type: dayConfigSchema, default: defaultWorkday },
    saturday: { type: dayConfigSchema, default: defaultWorkday },
    sunday: { type: dayConfigSchema, default: defaultWeekend },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Returns the day config for a given JS Date's day-of-week
 * (0=Sunday...6=Saturday) — the ONE thing routes/attendance.js
 * actually needs, so it doesn't need to know the schema shape.
 */
workScheduleSchema.methods.getDayConfig = function getDayConfig(date) {
  const key = DAY_KEYS[date.getDay()];
  return this[key];
};

workScheduleSchema.statics.DAY_KEYS = DAY_KEYS;

module.exports = mongoose.model("WorkSchedule", workScheduleSchema);
