import { describe, it, expect, beforeAll } from "vitest";

/** Daily business checks: each alert once, to the right people. */
const tenantScope = require("./tenantScope");
const fake = require("../test/fakeMongo");
const mongoose = require("mongoose");

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const Workshop = require("../models/Workshop");
const Project = require("../models/Project");
const ProductionOrder = require("../models/ProductionOrder");
const Quote = require("../models/Quote");
const SalesInvoice = require("../models/SalesInvoice");
const Notification = require("../models/Notification");
const checks = require("./businessNotifications");
const { applyMovement } = require("./inventoryService");

const DAY = 86400000;
const ago = (n) => new Date(Date.now() - n * DAY);
let ids = {};

beforeAll(async () => {
  fake.connect();
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@x.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    const sales = await User.create({ firstName: "S", lastName: "S", email: "s@x.ma", password: "secret12", role: "user", department: "sales", tenant: tenant._id });
    const purch = await User.create({ firstName: "P", lastName: "P", email: "p@x.ma", password: "secret12", role: "user", department: "purchasing", tenant: tenant._id });
    const emp = await Employee.collection.insertOne({ company: company._id, firstName: "V", lastName: "V", employmentStatus: "active" });
    const glazier = await User.create({ firstName: "V", lastName: "V", email: "v@x.ma", password: "secret12", role: "user", department: "quality_control", employee: emp.insertedId, tenant: tenant._id });
    const vit = await Workshop.create({ company: company._id, code: "VIT", name: "Vitrage", kind: "vitrage", manager: emp.insertedId });
    const project = await Project.create({ company: company._id, number: "PRJ-1", name: "Villa", dueDate: new Date(Date.now() + 3 * DAY), status: "in_progress", manager: emp.insertedId, items: [] });
    const order = await ProductionOrder.create({ company: company._id, number: "OF-1", workshop: vit._id, kind: "vitrage", project: project._id, status: "in_progress", dueDate: ago(2) });
    const quote = await Quote.create({ company: company._id, number: "DV-1", customer: new mongoose.Types.ObjectId(), date: ago(20), validUntil: new Date(Date.now() + 2 * DAY), status: "sent", lines: [{ description: "x", quantity: 1, unitPrice: 100 }], createdBy: sales._id });
    const invoice = await SalesInvoice.create({ company: company._id, number: "FA-1", type: "invoice", customer: new mongoose.Types.ObjectId(), date: ago(60), dueDate: ago(5), status: "issued", lines: [{ description: "x", quantity: 1, unitPrice: 100 }], createdBy: sales._id });
    const product = await Product.create({ company: company._id, category: new mongoose.Types.ObjectId(), name: "Poudre", quantity: 12, threshold: 10, unit: "kg" });
    ids = { admin: String(admin._id), sales: String(sales._id), purch: String(purch._id), glazier: String(glazier._id), order: order._id, project: project._id, quote: quote._id, invoice: invoice._id, product };
  });
});

const notesFor = (userId, key) => tenantScope.runAsSystem(() => Notification.find({ user: userId, ...(key ? { key } : {}) }).lean());

describe("daily business checks", () => {
  it("alerts late orders, projects due soon, expiring devis and overdue invoices — once", async () => {
    const r1 = await tenantScope.runAsSystem(() => checks.runDailyBusinessChecks());
    expect(r1).toEqual({ checkLateOrders: 1, checkProjectsDueSoon: 1, checkQuotesExpiring: 1, checkOverdueInvoices: 1, checkLateDeliveries: 0 });
    expect(await notesFor(ids.glazier, "orderLate")).toHaveLength(1); // workshop manager
    expect(await notesFor(ids.glazier, "projectDueSoon")).toHaveLength(1); // project manager
    expect(await notesFor(ids.sales, "quoteExpiring")).toHaveLength(1); // devis author
    expect(await notesFor(ids.sales, "invoiceOverdue")).toHaveLength(1);
    expect(await notesFor(ids.admin, "orderLate")).toHaveLength(1); // production side: admins
    expect(await notesFor(ids.purch, "orderLate")).toHaveLength(0);
    const r2 = await tenantScope.runAsSystem(() => checks.runDailyBusinessChecks());
    expect(r2).toEqual({ checkLateOrders: 0, checkProjectsDueSoon: 0, checkQuotesExpiring: 0, checkOverdueInvoices: 0, checkLateDeliveries: 0 });
  });

  it("alerts low stock once per drop, again after a restock", async () => {
    await tenantScope.runAsSystem(async () => {
      const p = await Product.findById(ids.product._id);
      await applyMovement({ product: p, type: "out", quantity: 1, actorId: ids.admin }); // 11: above threshold
      await applyMovement({ product: p, type: "out", quantity: 2, actorId: ids.admin }); // 9: alert
      await applyMovement({ product: p, type: "out", quantity: 1, actorId: ids.admin }); // 8: no repeat
    });
    expect(await notesFor(ids.purch, "stockLow")).toHaveLength(1);
    expect(await notesFor(ids.admin, "stockLow")).toHaveLength(0); // the person who took it out isn't told
    await tenantScope.runAsSystem(async () => {
      const p = await Product.findById(ids.product._id);
      await applyMovement({ product: p, type: "in", quantity: 20, actorId: ids.admin }); // 28: marker cleared
      await applyMovement({ product: p, type: "out", quantity: 19, actorId: ids.admin }); // 9: alert again
    });
    const again = await notesFor(ids.purch, "stockLow");
    expect(again).toHaveLength(2);
    expect(again[1].params).toMatchObject({ article: "Poudre", quantity: 9, threshold: 10 });
  });
});
