import { describe, it, expect, vi, beforeEach } from "vitest";
const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = { id: "507f1f77bcf86cd799439999", role: "admin" }; next(); } };
const auditPath = require.resolve("../services/auditLogger");
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { logAudit: vi.fn() } };

const WorkSchedule = require("../models/WorkSchedule");
const Company = require("../models/Company");
const router = require("./workSchedule");
const COMPANY = "507f1f77bcf86cd799439201";
const app = () => { const a = express(); a.use(express.json()); a.use("/api/work-schedule", router); return a; };

const SPLIT_DAY = { isWorkingDay: true, startHour: 8, startMinute: 0, splitShift: true, breakStartHour: 12, breakStartMinute: 0,
  breakEndHour: 14, breakEndMinute: 0, endHour: 18, endMinute: 0, graceMinutes: 10 };

describe("saving a split-shift work schedule", () => {
  let saved;
  beforeEach(() => {
    vi.restoreAllMocks();
    saved = null;
    vi.spyOn(Company, "findById").mockResolvedValue({ _id: COMPANY, owner: "507f1f77bcf86cd799439999" });
    vi.spyOn(WorkSchedule, "findOne").mockResolvedValue(null);
    // the REAL validation hook runs; only the database write is skipped
    vi.spyOn(WorkSchedule.prototype, "save").mockImplementation(async function save() { await this.validate(); saved = this; return this; });
  });

  it("REGRESSION: split-shift fields are kept (they used to be silently dropped)", async () => {
    const res = await request(app()).put("/api/work-schedule").send({ companyId: COMPANY, monday: SPLIT_DAY });
    expect(res.status).toBe(200);
    expect(saved.monday.splitShift).toBe(true);
    expect(saved.monday.breakStartHour).toBe(12);
    expect(saved.monday.breakEndHour).toBe(14);
    expect(saved.monday.endHour).toBe(18);
    expect(saved.monday.workHours).toBe(8); // derived: 4h + 4h, lunch unpaid
  });

  it("impossible time orders are now rejected (update queries skipped validation)", async () => {
    const res = await request(app()).put("/api/work-schedule").send({ companyId: COMPANY, monday: { ...SPLIT_DAY, breakStartHour: 15 } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/order/);
  });
});
