import { describe, it, expect, vi, beforeEach } from "vitest";

const request = require("supertest");
const express = require("express");

const Absence = require("../models/Absence");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

// Same require.cache injection technique used elsewhere in this
// backend's tests (see scheduledNotificationsService.test.js) —
// middleware/auth.js is a plain CommonJS function export, not an
// ESM module, so vi.mock's factory shape doesn't apply cleanly here.
const authPath = require.resolve("../middleware/auth");
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: (req, res, next) => {
    req.user = { id: "507f1f77bcf86cd799439011", role: "admin" };
    next();
  },
};

const router = require("../routes/reports");

describe("GET /reports/employee-rankings — Absence status filter", () => {
  const FAKE_COMPANY_ID = "507f1f77bcf86cd799439012";

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Company, "findById").mockResolvedValue({ _id: FAKE_COMPANY_ID, owner: "507f1f77bcf86cd799439011" });
    vi.spyOn(Employee, "find").mockReturnValue({ select: () => Promise.resolve([]) });
    vi.spyOn(Attendance, "aggregate").mockResolvedValue([]);
  });

  it("REGRESSION: queries Absence with status 'accepted' — the model's real enum value — not 'approved', which doesn't exist and would silently return zero results forever", async () => {
    // Absence.status's actual enum is ["pending", "accepted", "rejected"]
    // (see models/Absence.js) — this route originally filtered on
    // "approved" instead, a value that can never match anything, so
    // "most absence days" would always come back empty in
    // production despite working fine against a mock that didn't
    // check which filter it was actually called with.
    const aggregateSpy = vi.spyOn(Absence, "aggregate").mockResolvedValue([]);

    const app = express();
    app.use(express.json());
    app.use("/api/reports", router);

    await request(app).get(`/api/reports/employee-rankings?companyId=${FAKE_COMPANY_ID}&days=30`);

    expect(aggregateSpy).toHaveBeenCalled();
    const pipeline = aggregateSpy.mock.calls[0][0];
    const matchStage = pipeline.find((stage) => stage.$match);
    expect(matchStage.$match.status).toBe("accepted");
    expect(matchStage.$match.status).not.toBe("approved");
  });
});
