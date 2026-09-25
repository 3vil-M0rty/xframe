/**
 * ============================================================
 * RECOMPUTE ATTENDANCE (one-off correction)
 * ============================================================
 * Until the fix in models/WorkSchedule.js (getDayConfig), attendance
 * read every company's schedule as the DEFAULT 09:00-17:00 continuous
 * day — so lateness, early departure, overtime and split-shift punches
 * were computed against the wrong hours. This recalculates existing
 * records with each company's real schedule and public holidays.
 *
 * Safe by default: it only REPORTS what would change.
 *   node scripts/recomputeAttendance.js                    # dry run, everything
 *   node scripts/recomputeAttendance.js --from=2026-09-01  # dry run from a date
 *   node scripts/recomputeAttendance.js --apply            # write the changes
 *
 * Only records with a clock-in are recalculated. A status HR set by
 * hand (absent, half day, leave...) is kept — only present/late is
 * re-derived. Payslips already generated are snapshots and are NOT
 * changed; re-run payroll for a month if it needs the corrected figures.
 * ============================================================
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const Attendance = require("../models/Attendance");
const WorkSchedule = require("../models/WorkSchedule");
const PublicHoliday = require("../models/PublicHoliday");
const { resolveDaySchedule, applyHoliday, computeDay } = require("../services/attendanceCalc");

const FIELDS = ["hoursWorked", "lateMinutes", "earlyLeaveMinutes", "leftEarly", "overtimeMinutes", "holidayMinutes", "holidayPayRate"];
const DERIVED_STATUSES = ["present", "late"];

/**
 * Pure: the corrected fields for one record, or null if nothing
 * changes. `schedule` is the resolved day schedule (holiday applied).
 */
function correctionFor(record, schedule) {
  if (!record.clockIn) return null;
  const dayStart = new Date(record.date);
  const computed = computeDay(record, schedule, dayStart);
  if (!DERIVED_STATUSES.includes(record.status)) delete computed.status; // keep HR's status
  const changes = {};
  for (const [key, value] of Object.entries(computed)) {
    const before = record[key] === undefined ? null : record[key];
    const after = value === undefined ? null : value;
    if (before !== after) changes[key] = { before, after };
  }
  return Object.keys(changes).length ? changes : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const fromArg = process.argv.find((a) => a.startsWith("--from="));
  const filter = { clockIn: { $ne: null } };
  if (fromArg) filter.date = { $gte: new Date(fromArg.split("=")[1]) };

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✓ Connected — ${apply ? "APPLYING changes" : "DRY RUN (nothing is written; add --apply to save)"}`);

  const schedules = new Map();
  const scheduleFor = async (companyId) => {
    const key = String(companyId);
    if (!schedules.has(key)) schedules.set(key, await WorkSchedule.findOne({ company: companyId }));
    return schedules.get(key);
  };

  const records = await Attendance.find(filter).sort({ date: 1 });
  let changed = 0;
  for (const record of records) {
    // eslint-disable-next-line no-await-in-loop
    const ws = await scheduleFor(record.company);
    const dayConfig = ws ? ws.getDayConfig(new Date(record.date)) : undefined;
    // eslint-disable-next-line no-await-in-loop
    const holiday = await PublicHoliday.findOne({ company: record.company, day: PublicHoliday.dayKey(record.date) }).lean();
    const schedule = applyHoliday(resolveDaySchedule(dayConfig), holiday);

    const changes = correctionFor(record, schedule);
    if (!changes) continue;
    changed += 1;
    const summary = Object.entries(changes).map(([k, v]) => `${k}: ${v.before} → ${v.after}`).join(", ");
    console.log(`  ${new Date(record.date).toISOString().slice(0, 10)}  employee ${record.employee}  ${summary}`);
    if (apply) {
      for (const [key, v] of Object.entries(changes)) record[key] = v.after;
      // eslint-disable-next-line no-await-in-loop
      await record.save();
    }
  }

  console.log(`\n${records.length} record(s) checked, ${changed} ${apply ? "corrected" : "would change"}.`);
  if (!apply && changed) console.log("Run again with --apply to save these corrections.");
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Recompute failed:", err);
    process.exit(1);
  });
}

module.exports = { correctionFor };
