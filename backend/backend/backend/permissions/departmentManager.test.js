import { describe, it, expect, vi, beforeEach } from "vitest";

const request = require("supertest");
const express = require("express");

const { canReviewRequest, reviewerRole, isDepartmentManagerOf } = require("./permissions");
const Department = require("../models/Department");
const JobPosition = require("../models/JobPosition");
const Employee = require("../models/Employee");
let resyncQueries = [];
const { computeInheritedPermissions } = require("../services/employeeAccountService");

const PROD = "507f1f77bcf86cd7994390a1";
const SALES = "507f1f77bcf86cd7994390a2";
const MGR_EMP = "507f1f77bcf86cd7994390b1";
const OPERATOR = "507f1f77bcf86cd7994390b2";

const deptManager = { id: "u1", role: "user", employee: MGR_EMP, managedDepartments: [PROD] };
const company = { owner: "owner1" };

describe("department manager — review rights", () => {
  it("can review requests from anyone in the department they manage", () => {
    const requester = { _id: OPERATOR, department: PROD, manager: null };
    expect(isDepartmentManagerOf(deptManager, requester)).toBe(true);
    expect(canReviewRequest(deptManager, company, requester)).toBe(true);
    expect(reviewerRole(deptManager, company, requester)).toBe("manager");
  });

  it("SECURITY: cannot review their OWN request", () => {
    const ownRequest = { _id: MGR_EMP, department: PROD, manager: null };
    expect(canReviewRequest(deptManager, company, ownRequest)).toBe(false);
    expect(reviewerRole(deptManager, company, ownRequest)).toBeNull();
  });

  it("cannot review requests from a department they don't manage", () => {
    const outsider = { _id: OPERATOR, department: SALES, manager: null };
    expect(canReviewRequest(deptManager, company, outsider)).toBe(false);
  });

  it("works with a populated department object too", () => {
    expect(isDepartmentManagerOf(deptManager, { _id: OPERATOR, department: { _id: PROD } })).toBe(true);
  });
});

describe("department manager — inherited access", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("gets the full module at the top tier regardless of job title", async () => {
    vi.spyOn(Department, "findById").mockReturnValue({ select: () => Promise.resolve({ permissionKey: "hr", manager: MGR_EMP }) });
    vi.spyOn(JobPosition, "findOne").mockReturnValue({ select: () => Promise.resolve(null) });
    const result = await computeInheritedPermissions({ _id: MGR_EMP, department: PROD, jobTitle: "Any Title" });
    expect(result).toEqual({ department: "hr", hrRole: "hr_director" });
  });

  it("a non-manager in the same department still follows the position rule", async () => {
    vi.spyOn(Department, "findById").mockReturnValue({ select: () => Promise.resolve({ permissionKey: "production", manager: MGR_EMP }) });
    vi.spyOn(JobPosition, "findOne").mockReturnValue({ select: () => Promise.resolve({ grantsModuleAccess: false }) });
    const result = await computeInheritedPermissions({ _id: OPERATOR, department: PROD, jobTitle: "Opérateur" });
    expect(result.department).toBeUndefined();
  });
});

describe("PATCH /job-positions/:id/access — distributing permissions", () => {
  const authPath = require.resolve("../middleware/auth");
  let currentUser;
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = currentUser; next(); } };
  const router = require("../routes/jobPositions");
  const POS = "507f1f77bcf86cd7994390c1";

  let position;
  beforeEach(() => {
    vi.restoreAllMocks();
    position = { _id: POS, title: "Chef d'Équipe", department: PROD, grantsModuleAccess: false, company: { _id: "c1", owner: "owner1" }, async save() {} };
    vi.spyOn(JobPosition, "findById").mockReturnValue({ populate: () => Promise.resolve(position) });
    // Flipping the switch re-syncs everyone holding the position.
    resyncQueries = [];
    vi.spyOn(Employee, "find").mockImplementation((q) => { resyncQueries.push(q); return { select: async () => [] }; });
  });

  const call = (user, body) => {
    currentUser = user;
    const app = express(); app.use(express.json()); app.use("/api/job-positions", router);
    return request(app).patch(`/api/job-positions/${POS}/access`).send(body);
  };

  it("the department's manager can turn module access on for one of its positions", async () => {
    const res = await call(deptManager, { grantsModuleAccess: true });
    expect(res.status).toBe(200);
    expect(position.grantsModuleAccess).toBe(true);
    // ...and the people holding that position are re-synced right away
    expect(resyncQueries[0]).toMatchObject({ department: PROD, jobTitle: { $in: ["Chef d'Équipe"] } });
  });

  it("SECURITY: a manager of a DIFFERENT department is refused", async () => {
    const res = await call({ ...deptManager, managedDepartments: [SALES] }, { grantsModuleAccess: true });
    expect(res.status).toBe(403);
    expect(position.grantsModuleAccess).toBe(false);
  });

  it("SECURITY: a plain employee is refused", async () => {
    const res = await call({ id: "u9", role: "user", employee: OPERATOR, managedDepartments: [] }, { grantsModuleAccess: true });
    expect(res.status).toBe(403);
  });

  it("rejects a non-boolean value", async () => {
    const res = await call(deptManager, { grantsModuleAccess: "yes" });
    expect(res.status).toBe(400);
  });
});
