import { describe, it, expect, beforeAll } from "vitest";

/**
 * The workshop flow, as people do it:
 *   A (chargé des barres) issues the exact raw bars (+ an offcut) to Laquage
 *   B (Laquage) receives them → laquage starts → finishes: "1.2 kg of powder"
 *     → the lacquered bars are sent back to Aluminium
 *   C (Aluminium) receives them → launches → chassis made WITHOUT glass
 *   Vitrage, launched at any time, finishes → glass units sent to Aluminium
 *   C receives the glass → finishes (glazed). Accessories issued by the
 *   storekeeper. A step can be sub-contracted (draft purchase order).
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "workshop-flow-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");

let app;
let token;
let companyId;
let supplierId;
const P = {};
const h = () => ({ Authorization: `Bearer ${token}` });
const get = (id) => tenantScope.runAsSystem(() => Product.findById(id).lean());

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/projects", require("./projects"));
  app.use("/api/production", require("./productionConfig"));
  app.use("/api/production-orders", require("./productionOrders"));
  app.use("/api/production-flow", require("./productionFlow"));
  tenantScope.enableStrictMode(true);
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const category = new mongoose.Types.ObjectId();
    const add = async (key, doc) => {
      const r = await Product.collection.insertOne({ company: company._id, category, unit: "u", isActive: true, baseProduct: null, finish: null, ...doc });
      P[key] = String(r.insertedId);
    };
    await add("profile", { name: "Profilé 50", internalReference: "P50", materialType: "profile", stockMode: "bar", barLength: 6500, perimeter: 200, quantity: 30, prices: [{ supplierName: "X", price: 150 }] });
    await add("gasket", { name: "Joint", materialType: "gasket", stockMode: "meter", quantity: 500, prices: [{ supplierName: "X", price: 3 }] });
    await add("accessory", { name: "Équerre", materialType: "accessory", stockMode: "unit", quantity: 500, prices: [{ supplierName: "X", price: 2 }] });
    await add("consumable", { name: "Silicone", materialType: "consumable", stockMode: "unit", quantity: 100, prices: [{ supplierName: "X", price: 25 }] });
    await add("powder", { name: "Poudre 9016", materialType: "powder", stockMode: "kg", unit: "kg", coverage: 0.12, quantity: 40, prices: [{ supplierName: "X", price: 60 }] });
    await add("glass", { name: "Float 4 mm 3210×2250", materialType: "glass", stockMode: "sheet", sheetWidth: 3210, sheetHeight: 2250, quantity: 10, prices: [{ supplierName: "X", price: 400 }] });
    const sup = await Supplier.collection.insertOne({ company: company._id, name: "Laquage Express", isActive: true });
    supplierId = String(sup.insertedId);
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

describe("workshop flow", () => {
  let projectId;
  let orders;
  let offcutId;

  it("sets up a lacquered fixed window with a glass composition and launches it", async () => {
    await request(app).get(`/api/production/workshops?companyId=${companyId}`).set(h()).expect(200);
    const fin = await request(app).post("/api/production/finishes").set(h()).send({ company: companyId, code: "RAL 9016", kind: "lacquer", powderProduct: P.powder });
    const gt = await request(app).post("/api/production/glass-types").set(h()).send({ company: companyId, name: "Simple 4", layers: [{ label: "Verre 4 mm", thickness: 4, count: 1, sheets: [P.glass] }] });
    const imp = await request(app).post("/api/production/models/import").set(h()).send({ company: companyId, templateKey: "fixe" });
    const full = (await request(app).get(`/api/production/models/${imp.body.data._id}`).set(h())).body.data;
    const map = (c) => (c.kind === "model" || c.productParam ? c : { ...c, product: c.kind === "profile" ? P.profile : c.kind === "gasket" ? P.gasket : c.kind === "consumable" ? P.consumable : P.accessory });
    await request(app).put(`/api/production/models/${imp.body.data._id}`).set(h()).send({ components: full.components.map(map) }).expect(200);
    const p = await request(app).post("/api/projects").set(h()).send({ company: companyId, name: "Villa", finish: fin.body.data._id });
    projectId = p.body.data._id;
    await request(app).post(`/api/projects/${projectId}/items`).set(h()).send({ model: imp.body.data._id, ref: "F1", L: 1200, H: 1000, quantity: 2, params: { vitrage: gt.body.data._id } }).expect(201);
    const plan = await request(app).post(`/api/projects/${projectId}/production/plan`).set(h());
    expect(plan.status).toBe(201);
    orders = Object.fromEntries(plan.body.data.orders.map((o) => [o.kind, o]));
    expect(Object.keys(orders).sort()).toEqual(["aluminium", "laquage", "vitrage"]);
  });

  it("A issues the exact raw bars + an offcut to Laquage", async () => {
    const off = await request(app).post("/api/production-flow/offcuts").set(h()).send({ company: companyId, product: P.profile, length: 1500, quantity: 2 });
    expect(off.status).toBe(201);
    offcutId = off.body.data._id;
    const f = (await request(app).get(`/api/production-flow/projects/${projectId}`).set(h())).body.data;
    const laqLine = f.bars.find((b) => b.order === orders.laquage._id);
    expect(laqLine.toIssue).toBeGreaterThan(0);
    // Aluminium gets its bars from Laquage: nothing to issue directly
    expect(f.bars.find((b) => b.order === orders.aluminium._id && b.workshopKind === "aluminium")?.toIssue || 0).toBe(0);
    const before = await get(P.profile);
    const r = await request(app).post(`/api/production-flow/projects/${projectId}/issue`).set(h()).send({
      category: "bars",
      lines: [{ order: laqLine.order, need: laqLine.need, quantity: laqLine.toIssue - 1, offcuts: [{ offcut: offcutId, length: 1500, quantity: 1 }] }],
    });
    expect(r.status).toBe(201);
    expect(r.body.data[0].number).toMatch(/^BT-\d{4}-\d{4}$/);
    expect((await get(P.profile)).quantity).toBe(before.quantity - (laqLine.toIssue - 1));
    const offs = (await request(app).get(`/api/production-flow/offcuts?companyId=${companyId}`).set(h())).body.data;
    expect(offs[0].quantity).toBe(1);
    const huge = await request(app).post(`/api/production-flow/projects/${projectId}/issue`).set(h()).send({ category: "bars", lines: [{ order: laqLine.order, need: laqLine.need, quantity: 9999 }] });
    expect(huge.status).toBe(409);
  });

  it("B receives at Laquage (it starts), finishes with the kg of powder: lacquered bars go to Aluminium", async () => {
    const pending = (await request(app).get(`/api/production-flow/transfers?companyId=${companyId}&status=sent`).set(h())).body.data;
    const t = pending.find((x) => String(x.toOrder._id) === orders.laquage._id);
    const rec = await request(app).post(`/api/production-flow/transfers/${t._id}/receive`).set(h()).send({});
    expect(rec.status).toBe(200);
    const laq = (await request(app).get(`/api/production-orders/${orders.laquage._id}`).set(h())).body.data;
    expect(laq.status).toBe("in_progress");
    const powderBefore = await get(P.powder);
    const done = await request(app).post(`/api/production-flow/orders/${orders.laquage._id}/finish-laquage`).set(h()).send({ powderKg: 1.2 });
    expect(done.status).toBe(200);
    expect(done.body.data.order.status).toBe("done");
    expect((await get(P.powder)).quantity).toBeCloseTo(powderBefore.quantity - 1.2, 5);
    expect(done.body.data.transfer.category).toBe("lacquered");
    expect(done.body.data.transfer.lines[0].offcuts).toEqual([expect.objectContaining({ length: 1500, quantity: 1 })]);
  });

  it("C receives the lacquered bars, launches; Vitrage runs on its own; frames made without glass", async () => {
    const early = await request(app).post(`/api/production-orders/${orders.aluminium._id}/start`).set(h()).send({});
    expect(early.status).toBe(409);
    expect(early.body.message).toMatch(/Réceptionnez/);
    const f = (await request(app).get(`/api/production-flow/projects/${projectId}`).set(h())).body.data;
    const t = f.transfers.find((x) => x.category === "lacquered");
    await request(app).post(`/api/production-flow/transfers/${t._id}/receive`).set(h()).send({}).expect(200);
    await request(app).post(`/api/production-orders/${orders.aluminium._id}/start`).set(h()).send({}).expect(200);
    // Accessories by the storekeeper
    const acc = f.accessories.filter((a) => a.order === orders.aluminium._id);
    expect(acc.length).toBeGreaterThan(0);
    const issued = await request(app).post(`/api/production-flow/projects/${projectId}/issue`).set(h()).send({ category: "accessories", lines: acc.map((a) => ({ order: a.order, need: a.need, quantity: a.toIssue })) });
    expect(issued.status).toBe(201);
    await request(app).post(`/api/production-flow/transfers/${issued.body.data[0]._id}/receive`).set(h()).send({}).expect(200);
    const frames = await request(app).post(`/api/production-flow/orders/${orders.aluminium._id}/frames-done`).set(h());
    expect(frames.status).toBe(200);
    expect(frames.body.data.framesDoneAt).toBeTruthy();
    await request(app).post(`/api/production-flow/orders/${orders.aluminium._id}/offcuts-from-plan`).set(h()).expect(201);
  });

  it("a step can be sub-contracted (draft purchase order) and taken back", async () => {
    const sc = await request(app).post(`/api/production-flow/orders/${orders.vitrage._id}/subcontract`).set(h()).send({ supplier: supplierId, note: "verre coupé" });
    expect(sc.status).toBe(201);
    expect(sc.body.data.purchaseOrder.number).toMatch(/^BC-/);
    expect(sc.body.data.purchaseOrder.status).toBe("draft");
    await request(app).delete(`/api/production-flow/orders/${orders.vitrage._id}/subcontract`).set(h()).expect(200);
  });

  it("Vitrage finishes → glass units sent; C receives them and finishes", async () => {
    await request(app).post(`/api/production-orders/${orders.vitrage._id}/start`).set(h()).send({}).expect(200);
    const v = await request(app).post(`/api/production-flow/orders/${orders.vitrage._id}/finish-vitrage`).set(h()).send({});
    expect(v.status).toBe(200);
    expect(v.body.data.transfer.category).toBe("glass");
    await request(app).post(`/api/production-flow/transfers/${v.body.data.transfer._id}/receive`).set(h()).send({}).expect(200);
    const alu = (await request(app).get(`/api/production-orders/${orders.aluminium._id}`).set(h())).body.data;
    expect(alu.glassReceivedAt).toBeTruthy();
    const done = await request(app).post(`/api/production-orders/${orders.aluminium._id}/complete`).set(h()).send({ force: true });
    expect(done.status).toBe(200);
    const f = (await request(app).get(`/api/production-flow/projects/${projectId}`).set(h())).body.data;
    expect(f.orders.every((o) => o.status === "done")).toBe(true);
    expect(f.transfers.every((t) => t.status === "received")).toBe(true);
  });
});
