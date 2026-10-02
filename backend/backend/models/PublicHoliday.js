// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * ============================================================
 * PUBLIC HOLIDAY (jour férié)
 * ============================================================
 * One record per company per holiday date. HR imports the year's
 * list from Excel/CSV (see routes/holidays.js) — the religious
 * holidays follow the lunar calendar and move every year, so they
 * can't be hardcoded.
 *
 * `day` is a plain "YYYY-MM-DD" key (not a Date) so matching it
 * against an attendance day can never drift across a timezone
 * boundary.
 *
 * isWorkingDay:
 *   false (default) — the company is closed (chômé). Nobody is
 *                     expected: no lateness, no absence.
 *   true            — the company works that day; the normal work
 *                     schedule applies.
 * payRate — how hours WORKED on this day are paid:
 *   2 (default) — double (the labor code rule: paid double, or a
 *                 compensatory rest day)
 *   1           — normal, no premium
 * See services/attendanceCalc.js (holidayMinutes) and
 * services/payrollAttendanceService.js (the premium).
 * ============================================================
 */

const publicHolidaySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    year: { type: Number, required: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    isWorkingDay: { type: Boolean, default: false },
    payRate: { type: Number, enum: [1, 2], default: 2 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

publicHolidaySchema.index({ company: 1, day: 1 }, { unique: true });
publicHolidaySchema.index({ company: 1, year: 1 });

publicHolidaySchema.pre("validate", function deriveYear(next) {
  if (this.day) this.year = Number(this.day.slice(0, 4));
  next();
});

/** "YYYY-MM-DD" for a Date, using LOCAL date parts — the same local
 *  midnight the attendance routes use for their `date` field. */
publicHolidaySchema.statics.dayKey = function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

module.exports = mongoose.model("PublicHoliday", publicHolidaySchema);
