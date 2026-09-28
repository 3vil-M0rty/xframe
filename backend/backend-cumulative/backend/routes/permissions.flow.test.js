import { describe, it, expect, beforeAll } from "vitest";

/**
 * Fine-grained permissions handed out down the hierarchy:
 * Logistique department (manager Karim) › driver Said (reports to Karim)
 * › helper Omar (reports to Said). Production no longer sees logistics.
 * A manager only grants what he has, only to people under him, never to
 * himself; a sub-manager can pass on a subset.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "permissions-flow-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");

let app;
let companyId;
const tok = {};
const uid = {};
const h = (who) => ({ Authorization: `Bearer ${tok[who]}` });

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/permissions", require("./permissions"));
  app.use("/api/logistics", require("./logistics"));
  app.use("/api/salaries", require("./salaries"));
  app.use("/api/users", require("./users"));
  tenantScope.enableStrictMode(true);
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const emp = (firstName, extra = {}) => Employee.create({ company: company._id, firstName, lastName: "X", employeeNumber: firstName, hireDate: new Date(), jobTitle: extra.jobTitle || "Agent", ...extra });
    const karim = await emp("Karim", { jobTitle: "Responsable logistique" });
    const logDep = await Department.create({ company: company._id, name: "Logistique", permissionKey: "logistics", manager: karim._id });
    await Employee.updateOne({ _id: karim._id }, { department: logDep._id });
    const said = await emp("Said", { department: logDep._id, manager: karim._id, jobTitle: "Chauffeur" });
    const omar = await emp("Omar", { department: logDep._id, manager: said._id, jobTitle: "Aide chauffeur" });
    const user = async (key, extra) => {
      const u = await User.create({ firstName: key, lastName: "X", email: `${key}@alu.ma`, password: "secret12", role: "user", tenant: tenant._id, ...extra });
      uid[key] = String(u._id);
      tok[key] = jwt.sign({ id: String(u._id) }, process.env.JWT_SECRET);
    };
    await user("karim", { employee: karim._id, department: "logistics" });
    await user("said", { employee: said._id });
    await user("omar", { employee: omar._id });
    await user("prod", { department: "production" });
    await user("hrassist", { department: "hr", hrRole: "hr_assistant" });
    tok.admin = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

describe("permissions handed out down the hierarchy", () => {
  it("production doesn't see logistics any more; the logistics manager does", async () => {
    await request(app).get(`/api/logistics/delivery-notes?companyId=${companyId}`).set(h("prod")).expect(403);
    await request(app).get(`/api/logistics/delivery-notes?companyId=${companyId}`).set(h("karim")).expect(200);
    const me = await request(app).get("/api/users/me").set(h("karim"));
    expect(me.body.data.permissions).toEqual(expect.arrayContaining(["logistics.notes.create", "logistics.notes.deliver", "team.permissions.manage"]));
    expect(me.body.data.permissions).not.toContain("hr.salaries.view");
  });

  it("a manager sees his whole line (not himself)", async () => {
    const r = await request(app).get(`/api/permissions/team?companyId=${companyId}`).set(h("karim"));
    expect(r.status).toBe(200);
    expect(r.body.data.people.map((p) => p.name).sort()).toEqual(["Omar X", "Said X"]);
    const none = await request(app).get(`/api/permissions/team?companyId=${companyId}`).set(h("prod"));
    expect(none.body.data.people).toEqual([]);
  });

  it("grants only what he has; the driver can then deliver but not create notes", async () => {
    await request(app).get(`/api/logistics/delivery-notes?companyId=${companyId}`).set(h("said")).expect(403);
    const r = await request(app).put(`/api/permissions/users/${uid.said}`).set(h("karim"))
      .send({ permissions: ["logistics.notes.view", "logistics.notes.deliver", "logistics.notes.print", "team.permissions.manage", "hr.salaries.view"] });
    expect(r.status).toBe(200);
    expect(r.body.data.base.sort()).toEqual(["logistics.notes.deliver", "logistics.notes.print", "logistics.notes.view", "team.permissions.manage"]);
    await request(app).get(`/api/logistics/delivery-notes?companyId=${companyId}`).set(h("said")).expect(200);
    const create = await request(app).post("/api/logistics/delivery-notes").set(h("said")).send({ company: companyId });
    expect(create.status).toBe(403);
    expect(create.body.permission).toBe("logistics.notes.create");
  });

  it("a sub-manager passes on a subset of his own permissions only", async () => {
    const r = await request(app).put(`/api/permissions/users/${uid.omar}`).set(h("said"))
      .send({ permissions: ["logistics.notes.view", "logistics.notes.create"] });
    expect(r.status).toBe(200);
    expect(r.body.data.base).toEqual(["logistics.notes.view"]);
    // not up the line, not himself
    await request(app).put(`/api/permissions/users/${uid.karim}`).set(h("said")).send({ permissions: [] }).expect(403);
    await request(app).put(`/api/permissions/users/${uid.said}`).set(h("said")).send({ permissions: ["logistics.notes.create"] }).expect(403);
    // someone outside the team can't
    await request(app).put(`/api/permissions/users/${uid.omar}`).set(h("prod")).send({ permissions: [] }).expect(403);
  });

  it("taking a permission away leaves the ones the manager can't grant", async () => {
    // admin gives Omar an HR permission Karim doesn't have
    await request(app).put(`/api/permissions/users/${uid.omar}`).set(h("admin")).send({ permissions: ["logistics.notes.view", "hr.attendance.view"] }).expect(200);
    const r = await request(app).put(`/api/permissions/users/${uid.omar}`).set(h("karim")).send({ permissions: [] });
    expect(r.body.data.base).toEqual(["hr.attendance.view"]);
  });

  it("reset puts the department profile back", async () => {
    const r = await request(app).post(`/api/permissions/users/${uid.said}/reset`).set(h("karim"));
    expect(r.status).toBe(200);
    expect(r.body.data.user.mode).toBe("role");
    await request(app).get(`/api/logistics/delivery-notes?companyId=${companyId}`).set(h("said")).expect(403);
  });

  it("HR levels are ready-made profiles: an assistant can't create salaries", async () => {
    const r = await request(app).post("/api/salaries").set(h("hrassist")).send({});
    expect(r.status).toBe(403);
    expect(r.body.permission).toBe("hr.salaries.create");
  });

  it("the catalogue lists every module with its actions and profiles", async () => {
    const r = await request(app).get("/api/permissions/catalog").set(h("karim"));
    expect(r.body.data.modules.map((m) => m.key)).toEqual(expect.arrayContaining(["hr", "sales", "purchasing", "inventory", "production", "projects", "logistics"]));
    expect(r.body.data.presets.find((p) => p.key === "driver").keys).toContain("logistics.notes.deliver");
  });
});
