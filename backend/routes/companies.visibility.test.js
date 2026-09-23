import { describe, it, expect, vi, beforeEach } from "vitest";

const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser = null;
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: (req, res, next) => {
    req.user = currentUser;
    next();
  },
};

const Company = require("../models/Company");
const Employee = require("../models/Employee");
const router = require("../routes/companies");

describe("GET /companies — visibility for HR/production department users", () => {
  const companies = [
    { _id: "c1", name: "Atlas Industries", owner: "owner1", toObject() { return { ...this }; } },
    { _id: "c2", name: "Other Company SARL", owner: "owner2", toObject() { return { ...this }; } },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Company, "find").mockImplementation((filter) => ({
      sort: () => Promise.resolve(companies.filter((c) => !filter.owner || c.owner === filter.owner)),
    }));
    vi.spyOn(Employee, "aggregate").mockResolvedValue([]);
  });

  function callAs(user) {
    currentUser = user;
    const app = express();
    app.use(express.json());
    app.use("/api/companies", router);
    return request(app).get("/api/companies");
  }

  it("REGRESSION: an HR-department user (e.g. HR director) sees every company, not just ones they personally own", async () => {
    // Bug history: this endpoint filtered every non-admin user down
    // to { owner: req.user.id }, which only an actual company owner
    // ever matches. The User model has no company-scoping field —
    // an HR-department login is INTENTIONALLY unscoped by design
    // (see permissions/permissions.js's canAccessHRForCompany,
    // which already granted these users full per-record access) —
    // so an HR director who wasn't also the owner saw an empty
    // company picker everywhere, unable to even select a company to
    // view its employees.
    const res = await callAs({ id: "hrDirector1", role: "user", department: "hr", hrRole: "hr_director" });
    expect(res.body.data.length).toBe(2);
  });

  it("a production-department user gets the same fix (same architectural pattern)", async () => {
    const res = await callAs({ id: "prodUser1", role: "user", department: "production" });
    expect(res.body.data.length).toBe(2);
  });

  it("admin is unaffected — still sees everything", async () => {
    const res = await callAs({ id: "admin1", role: "admin" });
    expect(res.body.data.length).toBe(2);
  });

  it("a real owner is unaffected — still scoped to only their own company", async () => {
    const res = await callAs({ id: "owner1", role: "owner" });
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe("Atlas Industries");
  });

  it("a non-HR, non-production department user does not get over-exposed to companies they don't own", async () => {
    const res = await callAs({ id: "salesUser1", role: "user", department: "sales" });
    expect(res.body.data.length).toBe(0);
  });
});
