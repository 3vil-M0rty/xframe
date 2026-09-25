import { describe, it, expect } from "vitest";
const { correctionFor } = require("./recomputeAttendance");
const { resolveDaySchedule } = require("../services/attendanceCalc");

const DAY = new Date(2026, 0, 12);
const at = (h, m = 0) => new Date(2026, 0, 12, h, m);
const eightToFour = resolveDaySchedule({ startHour: 8, endHour: 16, graceMinutes: 10 });

describe("recomputing attendance recorded with the wrong (default) schedule", () => {
  it("fixes lateness and overtime computed against 09:00-17:00", () => {
    // arrived 08:40 on an 08:00-16:00 day, left 17:00 -> 30 late, 40 overtime
    const record = { date: DAY, clockIn: at(8, 40), clockOut: at(17), status: "present",
      hoursWorked: 8.33, lateMinutes: 0, earlyLeaveMinutes: 0, leftEarly: false, overtimeMinutes: 0, holidayMinutes: 0, holidayPayRate: null };
    const changes = correctionFor(record, eightToFour);
    expect(changes.lateMinutes).toEqual({ before: 0, after: 30 });
    expect(changes.overtimeMinutes.after).toBe(20); // 500 min worked - 480 expected
    expect(changes.status).toEqual({ before: "present", after: "late" });
  });

  it("keeps a status HR set by hand", () => {
    const record = { date: DAY, clockIn: at(8, 40), clockOut: at(12), status: "half_day", lateMinutes: 0 };
    expect(correctionFor(record, eightToFour).status).toBeUndefined();
  });

  it("no change -> nothing reported; no clock-in -> skipped", () => {
    const ok = { date: DAY, clockIn: at(8), clockOut: at(16), status: "present", hoursWorked: 8, lateMinutes: 0, earlyLeaveMinutes: 0, leftEarly: false, overtimeMinutes: 0, holidayMinutes: 0, holidayPayRate: null };
    expect(correctionFor(ok, eightToFour)).toBeNull();
    expect(correctionFor({ date: DAY, clockIn: null, status: "absent" }, eightToFour)).toBeNull();
  });
});
