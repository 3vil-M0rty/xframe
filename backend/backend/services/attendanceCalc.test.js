import { describe, it, expect } from "vitest";
const { resolveDaySchedule, validateDayConfig, nextPunch, computeDay } = require("./attendanceCalc");

const DAY = new Date(2026, 0, 12, 0, 0, 0, 0); // a Monday, local midnight
const at = (h, m = 0) => new Date(2026, 0, 12, h, m, 0, 0);

// Company A: 9:00 → 16:00 continuous
const continuous = resolveDaySchedule({ startHour: 9, startMinute: 0, endHour: 16, endMinute: 0, graceMinutes: 10 });
// Company B: 8:00 → 12:00 and 14:00 → 18:00
const split = resolveDaySchedule({
  startHour: 8, startMinute: 0, breakStartHour: 12, breakStartMinute: 0,
  breakEndHour: 14, breakEndMinute: 0, endHour: 18, endMinute: 0, splitShift: true, graceMinutes: 10,
});

describe("schedule resolution", () => {
  it("continuous 9→16 expects 7 hours", () => {
    expect(continuous.split).toBe(false);
    expect(continuous.expectedMinutes).toBe(420);
  });

  it("split 8→12 / 14→18 expects 8 hours (the 2h lunch is not paid)", () => {
    expect(split.split).toBe(true);
    expect(split.expectedMinutes).toBe(480);
  });

  it("BACKWARD COMPAT: an old config (start + workHours, no end) still resolves to the same continuous day", () => {
    const legacy = resolveDaySchedule({ startHour: 9, startMinute: 0, workHours: 8, graceMinutes: 10 });
    expect(legacy.split).toBe(false);
    expect(legacy.end).toBe(17 * 60);
    expect(legacy.expectedMinutes).toBe(480);
  });

  it("rejects out-of-order times", () => {
    expect(validateDayConfig({ startHour: 16, endHour: 9 })).toMatch(/after/);
    expect(validateDayConfig({ startHour: 8, breakStartHour: 15, breakEndHour: 14, endHour: 18, splitShift: true })).toMatch(/order/);
    expect(validateDayConfig({ startHour: 8, breakStartHour: 12, breakEndHour: 14, endHour: 18, splitShift: true })).toBeNull();
    expect(validateDayConfig({ isWorkingDay: false, startHour: 16, endHour: 9 })).toBeNull();
  });
});

describe("punch order", () => {
  it("continuous day: in, then out, then done", () => {
    expect(nextPunch({}, continuous)).toBe("clockIn");
    expect(nextPunch({ clockIn: at(9) }, continuous)).toBe("clockOut");
    expect(nextPunch({ clockIn: at(9), clockOut: at(16) }, continuous)).toBeNull();
  });

  it("split day: 2 clock-ins and 2 clock-outs, in order", () => {
    expect(nextPunch({}, split)).toBe("clockIn");
    expect(nextPunch({ clockIn: at(8) }, split)).toBe("breakOut");
    expect(nextPunch({ clockIn: at(8), breakOut: at(12) }, split)).toBe("breakIn");
    expect(nextPunch({ clockIn: at(8), breakOut: at(12), breakIn: at(14) }, split)).toBe("clockOut");
    expect(nextPunch({ clockIn: at(8), breakOut: at(12), breakIn: at(14), clockOut: at(18) }, split)).toBeNull();
  });
});

describe("hours, lateness and overtime (heures supplémentaires)", () => {
  it("continuous: working 9:00 → 17:00 on a 9→16 day = 1h overtime", () => {
    const r = computeDay({ clockIn: at(9), clockOut: at(17) }, continuous, DAY);
    expect(r.hoursWorked).toBe(8);
    expect(r.overtimeMinutes).toBe(60);
    expect(r.lateMinutes).toBe(0);
    expect(r.status).toBe("present");
  });

  it("continuous: leaving at 15:00 counts 60 min early (minus 10 min grace = 50)", () => {
    const r = computeDay({ clockIn: at(9), clockOut: at(15) }, continuous, DAY);
    expect(r.earlyLeaveMinutes).toBe(50);
    expect(r.leftEarly).toBe(true);
    expect(r.overtimeMinutes).toBe(0);
  });

  it("split: lunch is not counted as worked time", () => {
    const r = computeDay({ clockIn: at(8), breakOut: at(12), breakIn: at(14), clockOut: at(18) }, split, DAY);
    expect(r.hoursWorked).toBe(8);
    expect(r.overtimeMinutes).toBe(0);
  });

  it("split: overtime after the afternoon session", () => {
    const r = computeDay({ clockIn: at(8), breakOut: at(12), breakIn: at(14), clockOut: at(19, 30) }, split, DAY);
    expect(r.overtimeMinutes).toBe(90);
  });

  it("split: coming back late from lunch counts as late (beyond grace)", () => {
    const r = computeDay({ clockIn: at(8, 5), breakOut: at(12), breakIn: at(14, 25), clockOut: at(18) }, split, DAY);
    // morning 5 min is within grace; afternoon 25 - 10 = 15
    expect(r.lateMinutes).toBe(15);
    expect(r.status).toBe("late");
  });

  it("split: leaving for lunch early counts as leaving early", () => {
    const r = computeDay({ clockIn: at(8), breakOut: at(11, 30), breakIn: at(14), clockOut: at(18) }, split, DAY);
    expect(r.earlyLeaveMinutes).toBe(20); // 30 - 10 grace
  });

  it("split day with only in/out recorded (e.g. HR edit): scheduled lunch is still deducted", () => {
    const r = computeDay({ clockIn: at(8), clockOut: at(18) }, split, DAY);
    expect(r.hoursWorked).toBe(8);
    expect(r.overtimeMinutes).toBe(0);
  });

  it("overtime isn't counted until the day is finished", () => {
    const r = computeDay({ clockIn: at(8), breakOut: at(12) }, split, DAY);
    expect(r.hoursWorked).toBe(4);
    expect(r.overtimeMinutes).toBe(0);
  });

  it("rest day: every minute worked is overtime, and nobody is 'late'", () => {
    const rest = { ...continuous, isWorkingDay: false };
    const r = computeDay({ clockIn: at(10), clockOut: at(13) }, rest, DAY);
    expect(r.overtimeMinutes).toBe(180);
    expect(r.lateMinutes).toBe(0);
    expect(r.status).toBe("present");
  });
});
