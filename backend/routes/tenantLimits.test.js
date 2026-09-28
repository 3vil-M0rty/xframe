import { describe, it, expect, beforeAll, beforeEach } from "vitest";

const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Employee = require("../models/Employee");

process.env.JWT_SECRET = "limits-test-secret";

let app;
let platformToken;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  a.use("/api/auth", require("./auth"));
  a.use("/api/platform", require("./platform"));
  a.use("/api/companies", require("./companies"));
  a.use("/api/employees", require("./employees"));
  return a;
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });

beforeAll(() => {
  fake.connect();
  app = buildApp();
  tenantScope.enableStrictMode(true);
});

beforeEach(async () => {
  fake.reset();
  const ops = await tenantScope.runAsSystem(() =>
    User.create({ firstName: "Ops", lastName: "Ops", email: "ops@frame.ma", password: "platform-pass-1", role: "platform_admin" })
  );
  platformToken = jwt.sign({ id: String(ops._id) }, process.env.JWT_SECRET);
});

const newEmployee = (company, n) => ({
  company, employeeNumber: `E${n}`, firstName: "Emp", lastName: `N${n}`, hireDate: "2026-01-01", createLogin: false,
});

describe("client quotas (companies / employees)", () => {
  it("the platform sets quotas; the client can't go beyond them until they are raised", async () => {
    const res = await request(app).post("/api/platform/tenants").set(bearer(platformToken))
      .send({ name: "Atlas", limits: { maxCompanies: 2, maxEmployees: 2 }, admin: { firstName: "Ad", lastName: "Min", email: "admin@atlas.ma", password: "Client-pass-1" }, company: { name: "Atlas Alu" } });
    expect(res.status).toBe(201);
    const tenantId = res.body.data.tenant._id;
    const token = (await login("admin@atlas.ma", "Client-pass-1")).body.data.token;

    // Companies: 1 created with the client, 1 more allowed, the 3rd refused.
    await request(app).post("/api/companies").set(bearer(token)).send({ name: "Atlas Vitrage", industry: "Vitrage", legalForm: "SARL" }).expect(201);
    const third = await request(app).post("/api/companies").set(bearer(token)).send({ name: "Atlas Transport", industry: "Transport", legalForm: "SARL" });
    expect(third.status).toBe(403);
    expect(third.body.code).toBe("COMPANY_QUOTA");
    expect(third.body.quota).toMatchObject({ maxCompanies: 2, companies: 2 });
    // The platform itself is held to the same quota.
    expect((await request(app).post(`/api/platform/tenants/${tenantId}/companies`).set(bearer(platformToken)).send({ name: "X" })).status).toBe(400);

    const quota = await request(app).get("/api/companies/quota").set(bearer(token));
    expect(quota.body.data).toEqual({ maxCompanies: 2, maxEmployees: 2, companies: 2, employees: 0 });

    // Employees: 2 allowed across the client's companies, the 3rd refused.
    const companyId = res.body.data.company._id;
    await request(app).post("/api/employees").set(bearer(token)).send(newEmployee(companyId, 1)).expect(201);
    await request(app).post("/api/employees").set(bearer(token)).send(newEmployee(companyId, 2)).expect(201);
    const e3 = await request(app).post("/api/employees").set(bearer(token)).send(newEmployee(companyId, 3));
    expect(e3.status).toBe(403);
    expect(e3.body.code).toBe("EMPLOYEE_QUOTA");

    // A terminated employee frees a seat… and can't come back while the quota is full.
    const first = await tenantScope.runAsSystem(() => Employee.findOne({ employeeNumber: "E1" }));
    first.employmentStatus = "terminated";
    await tenantScope.runAsSystem(() => first.save());
    await request(app).post("/api/employees").set(bearer(token)).send(newEmployee(companyId, 3)).expect(201);
    const back = await request(app).put(`/api/employees/${first._id}`).set(bearer(token)).send({ employmentStatus: "active" });
    expect(back.status).toBe(403);
    expect(back.body.code).toBe("EMPLOYEE_QUOTA");

    // Raising the quotas unblocks; the platform list shows them.
    await request(app).patch(`/api/platform/tenants/${tenantId}`).set(bearer(platformToken)).send({ limits: { maxCompanies: 3, maxEmployees: null } }).expect(200);
    await request(app).post("/api/companies").set(bearer(token)).send({ name: "Atlas Transport", industry: "Transport", legalForm: "SARL" }).expect(201);
    await request(app).post("/api/employees").set(bearer(token)).send(newEmployee(companyId, 4)).expect(201);
    const list = await request(app).get("/api/platform/tenants").set(bearer(platformToken));
    const atlas = list.body.data.find((c) => c.name === "Atlas");
    expect(atlas.limits).toEqual({ maxCompanies: 3, maxEmployees: null });
    expect(atlas.counts).toMatchObject({ companies: 3, employees: 3 });

    // Invalid quota values are refused.
    await request(app).patch(`/api/platform/tenants/${tenantId}`).set(bearer(platformToken)).send({ limits: { maxEmployees: -1 } }).expect(400);
  });

  it("no quota set = unlimited (existing clients keep working)", async () => {
    await request(app).post("/api/platform/tenants").set(bearer(platformToken))
      .send({ name: "Free", admin: { firstName: "Ad", lastName: "Min", email: "admin@free.ma", password: "Client-pass-1" } }).expect(201);
    const token = (await login("admin@free.ma", "Client-pass-1")).body.data.token;
    for (const n of ["Alpha SARL", "Beta SARL", "Gamma SARL"]) {
      await request(app).post("/api/companies").set(bearer(token)).send({ name: n, industry: "x", legalForm: "SARL" }).expect(201);
    }
    const quota = await request(app).get("/api/companies/quota").set(bearer(token));
    expect(quota.body.data).toMatchObject({ maxCompanies: null, maxEmployees: null, companies: 3 });
  });
});
