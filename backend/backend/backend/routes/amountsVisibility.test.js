import { describe, it, expect, beforeAll } from "vitest";

/**
 * Production, workshops and logistics run projects without seeing
 * money: no revenue / costs / margins / budget / expenses on projects,
 * no pricing, hourly rates, surcharges or cost prices in the production
 * set-up — and saving their screens doesn't wipe those values.
 * Admins, owners and sales see everything; "Voir les montants"
 * (User.showFinancials) opens them to anyone else.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "amounts-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const { findTemplate } = require("../config/chassisCatalog");
const { modelFromTemplate } = require("../services/chassisCatalogService");
const ChassisModel = require("../models/ChassisModel");

let app;
let admin;
let prod;
let prodPlus;
let prodPlusId;
let companyId;
let modelId;
const h = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/projects", require("./projects"));
  app.use("/api/production", require("./productionConfig"));
  app.use("/api/users", require("./users"));
  tenantScope.enableStrictMode(true);
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const a = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: a._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const p = await User.create({ firstName: "P", lastName: "P", email: "p@alu.ma", password: "secret12", role: "user", department: "production", tenant: tenant._id });
    const pp = await User.create({ firstName: "Q", lastName: "Q", email: "q@alu.ma", password: "secret12", role: "user", department: "production", tenant: tenant._id });
    prodPlusId = String(pp._id);
    modelId = String((await ChassisModel.create(modelFromTemplate(findTemplate("coulissant_2v"), { company: company._id }))). _id);
    admin = jwt.sign({ id: String(a._id) }, process.env.JWT_SECRET);
    prod = jwt.sign({ id: String(p._id) }, process.env.JWT_SECRET);
    prodPlus = jwt.sign({ id: String(pp._id) }, process.env.JWT_SECRET);
  });
});

describe("amounts visibility", () => {
  let projectId;

  it("projects: production sees progress, not money", async () => {
    const p = await request(app).post("/api/projects").set(h(admin)).send({ company: companyId, name: "Villa", budget: { revenue: 50000, materials: 20000 } });
    projectId = p.body.data._id;
    await request(app).post(`/api/projects/${projectId}/expenses`).set(h(admin)).send({ label: "Grue", amount: 1200 }).expect(201);

    const full = await request(app).get(`/api/projects/${projectId}`).set(h(admin));
    expect(full.body.data.budget.revenue).toBe(50000);
    expect(full.body.data.expenses).toHaveLength(1);
    expect(full.body.amountsHidden).toBeUndefined();

    const r = await request(app).get(`/api/projects/${projectId}`).set(h(prod));
    expect(r.status).toBe(200);
    expect(r.body.amountsHidden).toBe(true);
    expect(r.body.data.budget).toBeUndefined();
    expect(r.body.data.expenses).toEqual([]);
    expect(r.body.data.invoices).toEqual([]);
    expect(Object.keys(r.body.data.financials).sort()).toEqual(["actual", "progress"]);
    expect(JSON.stringify(r.body.data)).not.toMatch(/50000|1200/);

    const list = await request(app).get(`/api/projects?companyId=${companyId}`).set(h(prod));
    expect(list.body.data[0]).not.toHaveProperty("revenue");
    expect(list.body.data[0]).not.toHaveProperty("actualMargin");
    expect(list.body.data[0]).toHaveProperty("progress");
  });

  it("projects: production can't touch the budget or expenses", async () => {
    await request(app).put(`/api/projects/${projectId}`).set(h(prod)).send({ name: "Villa Anfa", budget: { revenue: 1 } }).expect(200);
    await request(app).post(`/api/projects/${projectId}/expenses`).set(h(prod)).send({ label: "x", amount: 5 }).expect(403);
    const full = await request(app).get(`/api/projects/${projectId}`).set(h(admin));
    expect(full.body.data.name).toBe("Villa Anfa");
    expect(full.body.data.budget.revenue).toBe(50000);
  });

  it("production set-up: pricing, rates and surcharges hidden and kept", async () => {
    const m = await request(app).get(`/api/production/models/${modelId}`).set(h(prod));
    expect(m.status).toBe(200);
    expect(m.body.data.pricing).toBeUndefined();
    expect(m.body.data.components.length).toBeGreaterThan(0);
    // Saving the model (with a fake pricing) keeps the real one
    await request(app).put(`/api/production/models/${modelId}`).set(h(prod)).send({ name: "Coulissant 2V", pricing: { mode: "per_unit", pricePerUnit: 1 } }).expect(200);
    const full = await request(app).get(`/api/production/models/${modelId}`).set(h(admin));
    expect(full.body.data.name).toBe("Coulissant 2V");
    expect(full.body.data.pricing.mode).not.toBe("per_unit");

    const test = await request(app).post(`/api/production/models/${modelId}/test`).set(h(prod)).send({ L: 1200, H: 1000 });
    expect(test.status).toBe(200);
    expect(test.body.data.price).toBeUndefined();
    expect(test.body.data.lines.length).toBeGreaterThan(0);
    await request(app).post(`/api/production/models/${modelId}/price`).set(h(prod)).send({ L: 1200, H: 1000 }).expect(403);

    const ws = await request(app).get(`/api/production/workshops?companyId=${companyId}`).set(h(admin));
    const alu = ws.body.data.find((w) => w.code === "ALU");
    await request(app).put(`/api/production/workshops/${alu._id}`).set(h(admin)).send({ hourlyRate: 80 }).expect(200);
    const seen = await request(app).get(`/api/production/workshops?companyId=${companyId}`).set(h(prod));
    expect(seen.body.data.find((w) => w.code === "ALU").hourlyRate).toBeUndefined();
    await request(app).put(`/api/production/workshops/${alu._id}`).set(h(prod)).send({ name: "Alu", hourlyRate: 0 }).expect(200);
    const after = await request(app).get(`/api/production/workshops?companyId=${companyId}`).set(h(admin));
    expect(after.body.data.find((w) => w.code === "ALU").hourlyRate).toBe(80);
  });

  it("'Voir les montants' opens them to a production login", async () => {
    let r = await request(app).get(`/api/projects/${projectId}`).set(h(prodPlus));
    expect(r.body.data.budget).toBeUndefined();
    const me = await request(app).get(`/api/users/${prodPlusId}`).set(h(admin));
    const u = me.body.data || me.body.user || me.body;
    await request(app).put(`/api/users/${prodPlusId}`).set(h(admin)).send({ firstName: u.firstName, lastName: u.lastName, email: u.email, showFinancials: true }).expect(200);
    r = await request(app).get(`/api/projects/${projectId}`).set(h(prodPlus));
    expect(r.body.data.budget.revenue).toBe(50000);
    // …and nobody can grant it to themselves
    await request(app).put(`/api/users/${prodPlusId}`).set(h(prod)).send({ firstName: "P", lastName: "P", email: "p@alu.ma", showFinancials: true });
    const p2 = await request(app).get(`/api/projects/${projectId}`).set(h(prod));
    expect(p2.body.data.budget).toBeUndefined();
  });
});
