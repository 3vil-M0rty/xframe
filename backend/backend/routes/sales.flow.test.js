import { describe, it, expect, beforeAll } from "vitest";

/**
 * End to end, through the real routes and models:
 * client → devis → accepted → project → deposit invoice (30%) → issued →
 * paid → final invoice (deposit deducted) → issued → partial payment →
 * hours + materials + expense on the project → project margin.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "sales-flow-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Salary = require("../models/Salary");
const Product = require("../models/Product");

let app;
let token;
let companyId;
let employeeId;
let productId;
const h = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/customers", require("./customers"));
  app.use("/api/quotes", require("./quotes"));
  app.use("/api/sales-invoices", require("./salesInvoices"));
  app.use("/api/projects", require("./projects"));
  tenantScope.enableStrictMode(true);

  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@a.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Atlas", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const emp = await Employee.collection.insertOne({ company: company._id, firstName: "Ali", lastName: "Ouvrier", employmentStatus: "active" });
    employeeId = String(emp.insertedId);
    await Salary.collection.insertOne({ company: company._id, employee: emp.insertedId, baseSalary: 5730, allowances: [], endDate: null });
    const prod = await Product.collection.insertOne({ company: company._id, category: new mongoose.Types.ObjectId(), name: "Profilé alu", quantity: 50, unit: "m", prices: [{ supplierName: "X", price: 40 }] });
    productId = String(prod.insertedId);
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

describe("sales → project flow", () => {
  it("runs from devis to margin", async () => {
    const c = await request(app).post("/api/customers").set(h()).send({ company: companyId, name: "Hôtel Atlas", ice: "001234567000089", paymentDays: 30 });
    expect(c.status).toBe(201);

    const q = await request(app).post("/api/quotes").set(h()).send({
      company: companyId, customer: c.body.data._id, subject: "Menuiserie aluminium",
      lines: [{ description: "Fenêtres", quantity: 10, unitPrice: 1000, vatRate: 20 }],
    });
    expect(q.status).toBe(201);
    expect(q.body.data.number).toMatch(/^DV-\d{4}-0001$/);
    expect(q.body.data.totalTTC).toBe(12000);
    const quoteId = q.body.data._id;

    // Can't invoice or make a project before acceptance
    expect((await request(app).post(`/api/quotes/${quoteId}/deposit`).set(h()).send({ percent: 30 })).status).toBe(400);
    await request(app).patch(`/api/quotes/${quoteId}/status`).set(h()).send({ status: "sent" }).expect(200);
    await request(app).patch(`/api/quotes/${quoteId}/status`).set(h()).send({ status: "accepted" }).expect(200);

    const p = await request(app).post(`/api/quotes/${quoteId}/project`).set(h()).send({ manager: employeeId });
    expect(p.status).toBe(201);
    expect(p.body.data.budget.revenue).toBe(10000);
    const projectId = p.body.data._id;

    // Deposit 30% → issued → numbered AC-…-0001 → paid
    const d = await request(app).post(`/api/quotes/${quoteId}/deposit`).set(h()).send({ percent: 30 });
    expect(d.status).toBe(201);
    expect(d.body.data.number).toBeNull();
    const issuedDeposit = await request(app).post(`/api/sales-invoices/${d.body.data._id}/issue`).set(h());
    expect(issuedDeposit.body.data.number).toMatch(/^AC-\d{4}-0001$/);
    expect(issuedDeposit.body.data.totalTTC).toBe(3600);
    // due date from the customer's 30 days
    const due = new Date(issuedDeposit.body.data.dueDate) - new Date(issuedDeposit.body.data.date);
    expect(Math.round(due / 86400000)).toBe(30);
    const paid = await request(app).post(`/api/sales-invoices/${d.body.data._id}/payments`).set(h()).send({ amount: 3600, method: "virement" });
    expect(paid.body.data.status).toBe("paid");
    // overpaying is refused
    expect((await request(app).post(`/api/sales-invoices/${d.body.data._id}/payments`).set(h()).send({ amount: 1 })).status).toBe(400);

    // Final invoice: 12 000 − 3 600 = 8 400 TTC
    const f = await request(app).post(`/api/quotes/${quoteId}/invoice`).set(h());
    expect(f.status).toBe(201);
    expect(f.body.data.totalTTC).toBe(8400);
    const issued = await request(app).post(`/api/sales-invoices/${f.body.data._id}/issue`).set(h());
    expect(issued.body.data.number).toMatch(/^FA-\d{4}-0001$/);
    // An issued invoice can't be edited or deleted
    expect((await request(app).put(`/api/sales-invoices/${f.body.data._id}`).set(h()).send({ notes: "x" })).status).toBe(400);
    expect((await request(app).delete(`/api/sales-invoices/${f.body.data._id}`).set(h())).status).toBe(400);
    const part = await request(app).post(`/api/sales-invoices/${f.body.data._id}/payments`).set(h()).send({ amount: 4000 });
    expect(part.body.data.status).toBe("partially_paid");

    const rec = await request(app).get(`/api/sales-invoices/reports/receivables?companyId=${companyId}`).set(h());
    expect(rec.body.data.totals.total).toBe(4400);

    // Project: 8 h, 10 m of profile, 300 MAD transport
    const t = await request(app).post(`/api/projects/${projectId}/time`).set(h()).send({ employee: employeeId, hours: 8, date: new Date().toISOString() });
    expect(t.status).toBe(201);
    expect(t.body.data.cost).toBeGreaterThan(0);
    const m = await request(app).post(`/api/projects/${projectId}/materials`).set(h()).send({ product: productId, quantity: 10 });
    expect(m.status).toBe(201);
    expect(m.body.data.remainingStock).toBe(40);
    // can't return more than taken
    expect((await request(app).post(`/api/projects/${projectId}/materials`).set(h()).send({ product: productId, quantity: 11, direction: "return" })).status).toBe(400);
    await request(app).post(`/api/projects/${projectId}/expenses`).set(h()).send({ label: "Transport", amount: 300 }).expect(201);
    const task = await request(app).post(`/api/projects/${projectId}/tasks`).set(h()).send({ title: "Pose", estimatedHours: 16, assignees: [employeeId] });
    expect(task.status).toBe(201);
    await request(app).put(`/api/projects/tasks/${task.body.data._id}`).set(h()).send({ status: "done" }).expect(200);

    const detail = await request(app).get(`/api/projects/${projectId}`).set(h());
    const fin = detail.body.data.financials;
    expect(fin.actual.materials).toBe(400); // 10 × cheapest supplier price 40
    expect(fin.actual.other).toBe(300);
    expect(fin.actual.hours).toBe(8);
    expect(fin.invoiced).toBe(10000); // deposit 3 000 + final 7 000 HT
    expect(fin.progress).toBe(100);
    expect(detail.body.data.status).toBe("in_progress");
    expect(fin.actualMargin.amount).toBe(Math.round((10000 - fin.actual.total) * 100) / 100);

    // Credit note on the final invoice, then applied to it
    const cn = await request(app).post(`/api/sales-invoices/${f.body.data._id}/credit-note`).set(h());
    expect(cn.status).toBe(201);
    const cnIssued = await request(app).post(`/api/sales-invoices/${cn.body.data._id}/issue`).set(h());
    expect(cnIssued.body.data.number).toMatch(/^AV-\d{4}-0001$/);
    const applied = await request(app).post(`/api/sales-invoices/${cn.body.data._id}/apply-credit`).set(h()).send({ invoice: f.body.data._id });
    expect(applied.status).toBe(200);
    const after = await request(app).get(`/api/sales-invoices/${f.body.data._id}`).set(h());
    expect(after.body.data.status).toBe("paid");

    // PDFs render
    const pdf = await request(app).get(`/api/sales-invoices/${f.body.data._id}/pdf`).set(h()).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.body.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  it("invoice numbers can't go back in time", async () => {
    const c = await request(app).post("/api/customers").set(h()).send({ company: companyId, name: "Client B" });
    const inv = await request(app).post("/api/sales-invoices").set(h()).send({
      company: companyId, customer: c.body.data._id, date: "2020-01-01", lines: [{ description: "X", quantity: 1, unitPrice: 100 }],
    });
    expect(inv.status).toBe(201);
    const r = await request(app).post(`/api/sales-invoices/${inv.body.data._id}/issue`).set(h());
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/date/);
  });
});
