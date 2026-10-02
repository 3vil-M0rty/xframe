import { describe, it, expect, vi, beforeEach } from "vitest";

const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = currentUser; next(); } };

const Department = require("../models/Department");
const Company = require("../models/Company");
const JobPosition = require("../models/JobPosition");
const Employee = require("../models/Employee");
const User = require("../models/User");
const router = require("./departments");

const chain = (result) => {
  const q = { select: () => q, populate: () => q, sort: () => q, lean: async () => result };
  return q;
};

describe("GET /departments/managed — who oversees which departments", () => {
  let lastFilter;
  beforeEach(() => {
    vi.restoreAllMocks();
    lastFilter = undefined;
    vi.spyOn(Department, "find").mockImplementation((filter) => { lastFilter = filter; return chain([{ _id: "d1", name: "Production", company: { name: "Atlas" } }]); });
    vi.spyOn(Company, "find").mockImplementation(() => chain([{ _id: "c-owned" }]));
    vi.spyOn(JobPosition, "find").mockImplementation(() => chain([]));
    vi.spyOn(Employee, "find").mockImplementation(() => chain([]));
    vi.spyOn(User, "find").mockImplementation(() => chain([]));
  });

  const call = (user) => {
    currentUser = user;
    const app = express(); app.use(express.json()); app.use("/api/departments", router);
    return request(app).get("/api/departments/managed");
  };

  it("admin oversees EVERY department (no filter)", async () => {
    const res = await call({ id: "a", role: "admin", managedDepartments: [] });
    expect(res.status).toBe(200);
    expect(lastFilter).toEqual({});
  });

  it("owner oversees the departments of the companies they own (plus any they manage)", async () => {
    await call({ id: "o", role: "owner", managedDepartments: [] });
    expect(JSON.stringify(lastFilter)).toContain("c-owned");
  });

  it("a department manager sees only the department(s) they manage", async () => {
    await call({ id: "m", role: "user", managedDepartments: ["d1"] });
    expect(lastFilter).toEqual({ _id: { $in: ["d1"] } });
  });

  it("a plain employee oversees nothing and no query is made", async () => {
    const res = await call({ id: "e", role: "user", managedDepartments: [] });
    expect(res.body.data).toEqual([]);
    expect(lastFilter).toBeUndefined();
  });
});
