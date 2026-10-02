import { describe, it, expect, beforeAll } from "vitest";

/**
 * Production permissions:
 *  - the production manager (head of the Production department) appoints
 *    the chef of each workshop and its team, and hands out permissions to
 *    every workshop's chef and team;
 *  - a chef d'atelier gets every permission to run HIS workshop (create,
 *    edit, start, consume, complete, cancel, print…) — not the others;
 *  - work orders of a project only come from launching the project.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "workshop-manager-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");

let app;
let companyId;
const tok = {};
const emp = {};
const h = (who) => ({ Authorization: `Bearer ${tok[who]}` });

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/permissions", require("./permissions"));
  app.use("/api/users", require("./users"));
  app.use("/api/production", require("./productionConfig"));
  app.use("/api/production-orders", require("./productionOrders"));
  tenantScope.enableStrictMode(true);
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const mk = (firstName) => Employee.create({ company: company._id, firstName, lastName: "X", employeeNumber: firstName, hireDate: new Date(), jobTitle: "Agent" });
    emp.hassan = await mk("Hassan"); // responsable production
    emp.youssef = await mk("Youssef"); // future chef vitrage (another department)
    emp.ali = await mk("Ali"); // vitrier
    const dep = await Department.create({ company: company._id, name: "Production", permissionKey: "production", manager: emp.hassan._id });
    await Employee.updateOne({ _id: emp.hassan._id }, { department: dep._id });
    const user = async (key, extra) => {
      const u = await User.create({ firstName: key, lastName: "X", email: `${key}@alu.ma`, password: "secret12", role: "user", tenant: tenant._id, ...extra });
      tok[key] = jwt.sign({ id: String(u._id) }, process.env.JWT_SECRET);
      return u;
    };
    await user("hassan", { employee: emp.hassan._id, department: "production" });
    await user("youssef", { employee: emp.youssef._id, department: "quality_control", permissionsMode: "custom", permissions: [] });
    await user("ali", { employee: emp.ali._id, department: "quality_control", permissionsMode: "custom", permissions: [] });
    tok.admin = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

describe("production permissions", () => {
  let ws;
  it("the production manager appoints the chef d'atelier and the team", async () => {
    const r = await request(app).get(`/api/production/workshops?companyId=${companyId}`).set(h("hassan"));
    expect(r.status).toBe(200);
    ws = Object.fromEntries(r.body.data.map((w) => [w.code, w]));
    const put = await request(app).put(`/api/production/workshops/${ws.VIT._id}`).set(h("hassan")).send({ manager: String(emp.youssef._id), members: [String(emp.ali._id)] });
    expect(put.status).toBe(200);
    expect(String(put.body.data.manager)).toBe(String(emp.youssef._id));
  });

  it("the chef d'atelier has every permission for his workshop only", async () => {
    const me = await request(app).get("/api/users/me").set(h("youssef"));
    const perms = me.body.data?.permissions || me.body.permissions || me.body.data?.user?.permissions;
    expect(perms).toEqual(expect.arrayContaining(["production.orders.create", "production.orders.cancel", "production.orders.edit", "team.permissions.manage"]));
    expect(perms).not.toContain("production.workshops.all");
    // creates an order in his workshop…
    const mine = await request(app).post("/api/production-orders").set(h("youssef")).send({ company: companyId, workshop: ws.VIT._id, title: "Verre client", items: [{ label: "Verre 4 mm", quantity: 2 }] });
    expect(mine.status).toBe(201);
    const cancel = await request(app).post(`/api/production-orders/${mine.body.data._id}/cancel`).set(h("youssef")).send({ reason: "test" });
    expect(cancel.status).toBe(200);
    // …not in another one, and he only sees his own workshop
    const other = await request(app).post("/api/production-orders").set(h("youssef")).send({ company: companyId, workshop: ws.ALU._id, title: "x", items: [{ label: "x", quantity: 1 }] });
    expect(other.status).toBe(403);
    const board = await request(app).get(`/api/production-orders/board?companyId=${companyId}`).set(h("youssef"));
    expect(board.body.data.map((w) => w.code)).toEqual(["VIT"]);
    // he can't appoint chefs, but manages his team
    const chef = await request(app).put(`/api/production/workshops/${ws.VIT._id}`).set(h("youssef")).send({ manager: String(emp.ali._id), members: [] });
    expect(chef.status).toBe(200);
    expect(String(chef.body.data.manager)).toBe(String(emp.youssef._id));
    expect(chef.body.data.members).toHaveLength(0);
    await request(app).put(`/api/production/workshops/${ws.VIT._id}`).set(h("youssef")).send({ members: [String(emp.ali._id)] }).expect(200);
  });

  it("permissions are handed out down the production line", async () => {
    // the production manager reaches the workshop chefs and teams (other departments)
    const team = await request(app).get(`/api/permissions/team?companyId=${companyId}`).set(h("hassan"));
    expect(team.body.data.people.map((p) => p.name)).toEqual(expect.arrayContaining(["Youssef X", "Ali X"]));
    // the chef reaches his team member
    const chefTeam = await request(app).get(`/api/permissions/team?companyId=${companyId}`).set(h("youssef"));
    expect(chefTeam.body.data.people.map((p) => p.name)).toEqual(["Ali X"]);
  });

  it("a project's work orders only come from launching the project", async () => {
    const r = await request(app).post("/api/production-orders").set(h("hassan")).send({ company: companyId, workshop: ws.ALU._id, project: String(ws.ALU._id), items: [{ label: "x", quantity: 1 }] });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/lançant le projet/);
  });
});
