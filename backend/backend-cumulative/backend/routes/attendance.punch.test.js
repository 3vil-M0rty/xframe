import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true,
  exports: (req, res, next) => { req.user = { id: "u1", role: "user", employee: "507f1f77bcf86cd7994390e1" }; next(); } };

const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const WorkSchedule = require("../models/WorkSchedule");
const PublicHoliday = require("../models/PublicHoliday");
const router = require("./attendance");

const SPLIT = { isWorkingDay: true, startHour: 8, startMinute: 0, splitShift: true, breakStartHour: 12, breakStartMinute: 0,
  breakEndHour: 14, breakEndMinute: 0, endHour: 18, endMinute: 0, graceMinutes: 10 };
const CONTINUOUS = { isWorkingDay: true, startHour: 9, startMinute: 0, endHour: 16, endMinute: 0, graceMinutes: 10 };

describe("clock-in / clock-out follow the company's schedule", () => {
  let stored; let dayConfig; let holiday;
  beforeEach(() => {
    vi.restoreAllMocks();
    stored = null;
    holiday = null;
    vi.spyOn(PublicHoliday, "findOne").mockImplementation(() => ({ lean: async () => holiday }));
    vi.spyOn(Employee, "findById").mockImplementation(() => {
      const emp = { _id: "507f1f77bcf86cd7994390e1", company: "507f1f77bcf86cd7994390f1" };
      const q = Promise.resolve(emp); q.select = () => Promise.resolve(emp); return q;
    });
    vi.spyOn(WorkSchedule, "findOne").mockResolvedValue({ getDayConfig: () => dayConfig });
    vi.spyOn(Attendance, "findOne").mockImplementation(async () => stored);
    vi.spyOn(Attendance.prototype, "save").mockImplementation(async function save() { stored = this; return this; });
  });
  afterEach(() => vi.useRealTimers());

  const app = () => { const a = express(); a.use(express.json()); a.use("/api/attendance", router); return a; };
  const punchAt = (path, h, m = 0) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 12, h, m));
    return request(app()).post(`/api/attendance/${path}`);
  };

  it("split day (8-12 / 14-18): two clock-ins and two clock-outs, lunch unpaid, overtime counted", async () => {
    dayConfig = SPLIT;
    expect((await punchAt("clock-in", 8, 0)).body.punch).toBe("clockIn");
    const mid = await punchAt("clock-out", 12, 0);
    expect(mid.body.punch).toBe("breakOut");
    expect(mid.body.nextPunch).toBe("breakIn");
    expect((await punchAt("clock-in", 14, 0)).body.punch).toBe("breakIn");
    const last = await punchAt("clock-out", 19, 0);
    expect(last.body.punch).toBe("clockOut");
    expect(last.body.nextPunch).toBeNull();
    expect(stored.hoursWorked).toBe(9);          // 4h + 5h
    expect(stored.overtimeMinutes).toBe(60);     // 1h heures supp
    // no fifth punch
    expect((await punchAt("clock-in", 19, 5)).status).toBe(400);
  });

  it("continuous day (9-16): the second clock-out is refused, overtime after 16:00", async () => {
    dayConfig = CONTINUOUS;
    await punchAt("clock-in", 9, 0);
    const out = await punchAt("clock-out", 17, 0);
    expect(out.body.punch).toBe("clockOut");
    expect(stored.overtimeMinutes).toBe(60);
    expect((await punchAt("clock-out", 17, 5)).status).toBe(400);
  });

  it("closed public holiday: clocking in still works, nobody is late, hours become holiday time", async () => {
    dayConfig = CONTINUOUS;
    holiday = { name: "Fête du Trône", isWorkingDay: false, payRate: 2 };
    await punchAt("clock-in", 11, 0);   // would be 2h late on a normal day
    await punchAt("clock-out", 14, 0);
    expect(stored.lateMinutes).toBe(0);
    expect(stored.holidayMinutes).toBe(180);
    expect(stored.holidayPayRate).toBe(2);
    expect(stored.overtimeMinutes).toBe(0);
  });

  it("refuses punches in the wrong direction", async () => {
    dayConfig = SPLIT;
    expect((await punchAt("clock-out", 8, 0)).status).toBe(400); // can't clock out first
    await punchAt("clock-in", 8, 0);
    expect((await punchAt("clock-in", 9, 0)).status).toBe(400); // already in
  });
});

// ------------------------------------------------------------------
// REGRESSION: the tests above hand the route a plain object, which hid
// a real bug — the database returns a Mongoose DOCUMENT, and copying
// one with { ...config } drops every field, so all schedules silently
// became 09:00-17:00 continuous (no split, wrong lateness/overtime).
// These feed the route a real WorkSchedule document.
// ------------------------------------------------------------------
describe("with a REAL WorkSchedule document (as loaded from the database)", () => {
  let stored;
  const realSchedule = (monday) => new WorkSchedule({ company: "507f1f77bcf86cd7994390f1", monday });

  beforeEach(() => {
    vi.restoreAllMocks();
    stored = null;
    vi.spyOn(Employee, "findById").mockImplementation(() => {
      const emp = { _id: "507f1f77bcf86cd7994390e1", company: "507f1f77bcf86cd7994390f1" };
      const q = Promise.resolve(emp); q.select = () => Promise.resolve(emp); return q;
    });
    vi.spyOn(PublicHoliday, "findOne").mockImplementation(() => ({ lean: async () => null }));
    vi.spyOn(Attendance, "findOne").mockImplementation(async () => stored);
    vi.spyOn(Attendance.prototype, "save").mockImplementation(async function save() { stored = this; return this; });
  });
  afterEach(() => vi.useRealTimers());

  const app = () => { const a = express(); a.use(express.json()); a.use("/api/attendance", router); return a; };
  const punchAt = (path, h, m = 0) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 12, h, m)); // a Monday
    return request(app()).post(`/api/attendance/${path}`);
  };

  it("a split day saved by the admin really gives employees 2 clock-ins and 2 clock-outs", async () => {
    vi.spyOn(WorkSchedule, "findOne").mockResolvedValue(realSchedule(SPLIT));
    expect((await punchAt("clock-in", 8)).body.punch).toBe("clockIn");
    const second = await punchAt("clock-out", 12);
    expect(second.body.punch).toBe("breakOut"); // was "clockOut" -> day over after 1 pair
    expect(second.body.nextPunch).toBe("breakIn");
  });

  it("lateness uses the company's REAL start time, not a default 09:00", async () => {
    // company starts at 08:00 -> arriving 08:40 is 30 min late (after 10 min grace)
    vi.spyOn(WorkSchedule, "findOne").mockResolvedValue(realSchedule({ ...CONTINUOUS, startHour: 8, endHour: 16 }));
    await punchAt("clock-in", 8, 40);
    expect(stored.lateMinutes).toBe(30); // with the bug: 0 (compared to 09:00)
  });
});
