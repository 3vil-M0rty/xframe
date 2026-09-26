// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * ATTENDANCE
 * ============================================================
 * One document per employee, per day. Supports manual clock-in/
 * clock-out (self-service or HR-entered) — `source` distinguishes
 * how the record was created, which matters if a real biometric/
 * badge integration is added later (it would just insert records
 * with source: "biometric" alongside these, same schema).
 *
 * `lateMinutes` / `overtimeMinutes` are computed at clock-out time
 * against the company's expected schedule (see routes/attendance.js)
 * rather than stored redundantly from the start — kept here once
 * computed so payroll/reporting don't need to recompute them.
 * ============================================================
 */

const attendanceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // Stored as a plain date (midnight) representing the work day,
    // separate from the precise clockIn/clockOut timestamps.
    date: { type: Date, required: true },

    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },
    // Split-shift days only (WorkSchedule day splitShift): the midday
    // clock-out and clock-in, between clockIn and clockOut.
    breakOut: { type: Date, default: null },
    breakIn: { type: Date, default: null },
    // Public holiday (jour férié) worked time, and the rate it's paid
    // at (2 = double, 1 = normal) — see services/attendanceCalc.js.
    holidayMinutes: { type: Number, default: 0 },
    holidayPayRate: { type: Number, default: null },

    status: {
      type: String,
      enum: ["present", "late", "absent", "half_day", "holiday"],
      default: "present",
      index: true,
    },

    hoursWorked: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    // Left before the expected end time (start + work hours) minus
    // the day's grace period — mirrors lateMinutes/status but for
    // clock-out. Kept separate from `status` (rather than adding a
    // "left_early" enum value there) because an employee can be
    // BOTH late AND leave early on the same day.
    leftEarly: { type: Boolean, default: false },
    earlyLeaveMinutes: { type: Number, default: 0 },

    source: {
      type: String,
      enum: ["self", "hr", "biometric", "import"],
      default: "self",
    },

    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// One attendance record per employee per day.
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ company: 1, date: -1 });

// Multilingual content layer (see plugins/translatable.js) for the
// free-text field(s) below — every language in config/i18nContent.js's
// CONTENT_LANGUAGES gets its own auto-translated + manually-editable slot.
attendanceSchema.plugin(translatable, { fields: ["notes"] });

module.exports = mongoose.model("Attendance", attendanceSchema);
