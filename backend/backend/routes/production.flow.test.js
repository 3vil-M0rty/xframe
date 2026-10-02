import { describe, it, expect, beforeAll } from "vitest";

/**
 * End to end, through the real routes and models (aluminium joinery):
 * catalogue (series → imported templates → articles mapped) → colour
 * lacquered in-house → devis with a chassis line → project ouvrages →
 * work orders Laquage + Vitrage → Aluminium (dependencies) → laquage
 * turns raw bars + powder into lacquered bars → aluminium consumes them
 * → project material cost; plus workshop-member access rules.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "production-flow-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Product = require("../models/Product");

let app;
let token;
let memberToken;
let companyId;
let memberEmployeeId;
const P = {};
const h = (t = token) => ({ Authorization: `Bearer ${t}` });
const binary = (res, cb) => { const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => cb(null, Buffer.concat(c))); };

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/customers", require("./customers"));
  app.use("/api/quotes", require("./quotes"));
  app.use("/api/projects", require("./projects"));
  app.use("/api/production", require("./productionConfig"));
  app.use("/api/production-orders", require("./productionOrders"));
  tenantScope.enableStrictMode(true);

  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu Atlas", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const category = new mongoose.Types.ObjectId();
    const add = async (key, doc) => {
      const r = await Product.collection.insertOne({ company: company._id, category, unit: "u", isActive: true, baseProduct: null, finish: null, ...doc });
      P[key] = String(r.insertedId);
    };
    await add("profile", { name: "Profilé coulissant 67", internalReference: "P67", materialType: "profile", stockMode: "bar", barLength: 6500, perimeter: 250, quantity: 60, prices: [{ supplierName: "X", price: 195 }] });
    await add("gasket", { name: "Joint EPDM", materialType: "gasket", stockMode: "meter", quantity: 1000, prices: [{ supplierName: "X", price: 3 }] });
    await add("accessory", { name: "Accessoire coulissant", materialType: "accessory", stockMode: "unit", quantity: 5000, prices: [{ supplierName: "X", price: 4 }] });
    await add("consumable", { name: "Consommable", materialType: "consumable", stockMode: "unit", quantity: 500, prices: [{ supplierName: "X", price: 25 }] });
    await add("mesh", { name: "Toile moustiquaire", materialType: "panel", stockMode: "m2", quantity: 50, prices: [{ supplierName: "X", price: 20 }] });
    await add("glass", { name: "Float clair 4 mm", materialType: "glass", stockMode: "m2", quantity: 200, prices: [{ supplierName: "X", price: 85 }] });
    await add("spacer", { name: "Intercalaire alu 16", materialType: "profile", stockMode: "bar", barLength: 6000, quantity: 40, prices: [{ supplierName: "X", price: 30 }] });
    await add("powder", { name: "Poudre RAL 9016", materialType: "powder", stockMode: "kg", unit: "kg", coverage: 0.12, quantity: 80, prices: [{ supplierName: "X", price: 60 }] });

    const emp = await Employee.collection.insertOne({ company: company._id, firstName: "Youssef", lastName: "Vitrier", employmentStatus: "active" });
    memberEmployeeId = String(emp.insertedId);
    const member = await User.create({ firstName: "Y", lastName: "V", email: "vitrier@alu.ma", password: "secret12", role: "user", department: "quality_control", employee: emp.insertedId, tenant: tenant._id });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
    memberToken = jwt.sign({ id: String(member._id) }, process.env.JWT_SECRET);
  });
});

function mapComponents(components) {
  return components.map((c) => {
    if (c.kind === "model" || c.productParam) return c;
    const product = c.role.startsWith("intercalaire") ? P.spacer
      : c.kind === "profile" ? P.profile
        : c.kind === "gasket" ? P.gasket
          : c.kind === "panel" ? P.mesh
            : c.kind === "consumable" ? P.consumable : P.accessory;
    return { ...c, product };
  });
}

describe("aluminium production flow", () => {
  let windowModel;
  let dvModel;
  let finishId;
  let projectId;
  let orders;

  it("sets up the catalogue: workshops, series, templates, articles, colour", async () => {
    const ws = await request(app).get(`/api/production/workshops?companyId=${companyId}`).set(h());
    expect(ws.status).toBe(200);
    expect(ws.body.data.map((w) => w.code).sort()).toEqual(["ALU", "LAQ", "VIT"]);
    const laq = ws.body.data.find((w) => w.code === "LAQ");
    const alu = ws.body.data.find((w) => w.code === "ALU");
    const vit = ws.body.data.find((w) => w.code === "VIT");
    expect(laq.feeds.map((f) => f.code)).toEqual(["ALU"]);
    // Rates for labour costing + a member in the Vitrage workshop
    await request(app).put(`/api/production/workshops/${alu._id}`).set(h()).send({ hourlyRate: 60 }).expect(200);
    await request(app).put(`/api/production/workshops/${vit._id}`).set(h()).send({ members: [memberEmployeeId] }).expect(200);

    const cat = await request(app).get("/api/production/catalog").set(h());
    expect(cat.body.data.templates.length).toBeGreaterThan(40);

    const series = await request(app).post("/api/production/series").set(h()).send({ company: companyId, name: "Coulissant 67", supplier: "Profilés du Maroc" });
    expect(series.status).toBe(201);

    const imp = await request(app).post("/api/production/models/import").set(h()).send({ company: companyId, templateKey: "coulissant_2v", series: series.body.data._id });
    expect(imp.status).toBe(201);
    windowModel = imp.body.data._id;
    // The template's variables moved to the series
    const s2 = await request(app).get(`/api/production/series?companyId=${companyId}`).set(h());
    expect(s2.body.data[0].variables.map((v) => v.key)).toEqual(expect.arrayContaining(["jl", "rc", "jh", "cart"]));

    const dv = await request(app).post("/api/production/models/import").set(h()).send({ company: companyId, templateKey: "double_vitrage", name: "DV 4/16/4" });
    dvModel = dv.body.data._id;

    // Map the DV articles
    const dvFull = (await request(app).get(`/api/production/models/${dvModel}`).set(h())).body.data;
    const dvSave = await request(app).put(`/api/production/models/${dvModel}`).set(h()).send({
      parameters: dvFull.parameters.map((p) => ({ ...p, default: P.glass })),
      components: mapComponents(dvFull.components),
    });
    expect(dvSave.status).toBe(200);

    // Map the window articles, glass unit = the DV by default
    const full = (await request(app).get(`/api/production/models/${windowModel}`).set(h())).body.data;
    const bad = await request(app).put(`/api/production/models/${windowModel}`).set(h()).send({ derived: [...full.derived, { key: "zz", formula: "L - unknownVar" }] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/unknownVar/);
    const save = await request(app).put(`/api/production/models/${windowModel}`).set(h()).send({
      parameters: full.parameters.map((p) => (p.key === "vitrage" ? { ...p, default: dvModel } : p)),
      components: mapComponents(full.components),
    });
    expect(save.status).toBe(200);

    const fin = await request(app).post("/api/production/finishes").set(h()).send({ company: companyId, code: "RAL 9016", name: "Blanc", kind: "lacquer", powderProduct: P.powder, surchargePercent: 5 });
    expect(fin.status).toBe(201);
    expect(String(fin.body.data.processWorkshop)).toBe(String(laq._id));
    finishId = fin.body.data._id;
  });

  it("tests and prices a chassis", async () => {
    const t = await request(app).post(`/api/production/models/${windowModel}/test`).set(h()).send({ L: 1200, H: 1000, quantity: 1, finish: finishId, params: { vitrage: dvModel } });
    expect(t.status).toBe(200);
    expect(t.body.data.errors).toEqual([]);
    expect(t.body.data.lines.find((l) => l.role === "rail_haut").length).toBe(1200);
    expect(t.body.data.needs.some((n) => n.kind === "glass" && n.workshop === "VIT")).toBe(true);
    const price = await request(app).post(`/api/production/models/${windowModel}/price`).set(h()).send({ L: 1200, H: 1000, finish: finishId, params: { vitrage: dvModel, ms: 1 } });
    expect(price.status).toBe(200);
    expect(price.body.data.cost.materials).toBeGreaterThan(0);
    expect(price.body.data.cost.lacquer).toBeGreaterThan(0); // raw bars + powder
    expect(price.body.data.cost.labour).toBeGreaterThan(0);
    expect(price.body.data.unitPrice).toBeGreaterThan(price.body.data.cost.total);
    expect(price.body.data.description).toContain("RAL 9016");
    expect(price.body.data.description).toContain("Moustiquaire");
  });

  it("devis chassis line → project ouvrages → work orders", async () => {
    const c = await request(app).post("/api/customers").set(h()).send({ company: companyId, name: "Villa Anfa" });
    const q = await request(app).post("/api/quotes").set(h()).send({
      company: companyId, customer: c.body.data._id, subject: "Menuiserie villa",
      lines: [{ description: "Coulissant 2V 1200 × 1000 RAL 9016", quantity: 3, unitPrice: 2500, vatRate: 20, chassis: { model: windowModel, ref: "F1", L: 1200, H: 1000, finish: finishId, params: { vitrage: dvModel, ms: 0 } } }],
    });
    expect(q.status).toBe(201);
    expect(q.body.data.lines[0].chassis.L).toBe(1200);

    // Readable designation for the screen: structured parts + schematic
    const detail = await request(app).get(`/api/quotes/${q.body.data._id}`).set(h());
    const info = detail.body.data.chassisInfo[0];
    expect(info).toMatchObject({ ref: "F1", size: "1200 × 1000 mm", L: 1200, H: 1000, image: null });
    expect(info.name).toBeTruthy();
    expect(info.finish).toMatch(/RAL/);
    expect(info.drawing.type).toBeTruthy();
    expect(Array.isArray(info.options)).toBe(true);
    // …and in the PDF (schematic drawn with vector shapes)
    const binary = (res, cb) => { const chunks = []; res.on("data", (d) => chunks.push(d)); res.on("end", () => cb(null, Buffer.concat(chunks))); };
    const qpdf = await request(app).get(`/api/quotes/${q.body.data._id}/pdf`).set(h()).buffer(true).parse(binary);
    expect(qpdf.status).toBe(200);
    expect(qpdf.body.slice(0, 4).toString()).toBe("%PDF");

    await request(app).patch(`/api/quotes/${q.body.data._id}/status`).set(h()).send({ status: "accepted" }).expect(200);
    const p = await request(app).post(`/api/quotes/${q.body.data._id}/project`).set(h()).send({});
    expect(p.status).toBe(201);
    projectId = p.body.data._id;
    expect(p.body.data.items).toHaveLength(1);
    expect(p.body.data.items[0]).toMatchObject({ ref: "F1", L: 1200, H: 1000, quantity: 3 });

    // Site survey: one more window added on the project
    const add = await request(app).post(`/api/projects/${projectId}/items`).set(h()).send({ model: windowModel, ref: "F2", L: 1500, H: 1200, quantity: 1, finish: finishId, params: { vitrage: dvModel } });
    expect(add.status).toBe(201);

    const prev = await request(app).get(`/api/projects/${projectId}/production`).set(h());
    expect(prev.status).toBe(200);
    const codes = prev.body.data.plan.workshops.map((w) => w.workshop.code);
    expect(codes).toEqual(expect.arrayContaining(["LAQ", "ALU", "VIT"]));
    const laq = prev.body.data.plan.workshops.find((w) => w.workshop.code === "LAQ");
    expect(laq.outputs[0].quantity).toBeGreaterThan(0); // bars to lacquer (nothing lacquered in stock)
    expect(laq.needs.find((n) => n.kind === "powder").theoretical).toBeGreaterThan(0);
    const vit = prev.body.data.plan.workshops.find((w) => w.workshop.code === "VIT");
    expect(vit.items).toHaveLength(2); // the glass units of F1 and F2
    expect(prev.body.data.plan.errors).toEqual([]);

    const plan = await request(app).post(`/api/projects/${projectId}/production/plan`).set(h());
    expect(plan.status).toBe(201);
    // The Vitrage member is told about his new work order (in his language: key + params)
    const Notification = require("../models/Notification");
    const memberNotes = await tenantScope.runAsSystem(() => Notification.find({ key: "orderPlanned" }).lean());
    expect(memberNotes.length).toBe(1);
    expect(memberNotes[0].params.workshop).toBe("Vitrage");
    expect(memberNotes[0].link).toMatch(/^\/production\/orders\//);
    orders = Object.fromEntries(plan.body.data.orders.map((o) => [o.kind, o]));
    expect(Object.keys(orders).sort()).toEqual(["aluminium", "laquage", "vitrage"]);
    expect(orders.aluminium.dependsOn).toHaveLength(1); // Laquage only: the glass arrives later (received on the Aluminium order)
    expect(orders.laquage.number).toMatch(/^OF-\d{4}-\d{4}$/);
    // Aluminium consumes the lacquered VARIANT of the profile
    const aluProfile = orders.aluminium.needs.find((n) => n.kind === "profile" && n.cutPlan);
    const variant = await tenantScope.runAsSystem(() => Product.findById(aluProfile.product).lean());
    expect(variant.baseProduct && String(variant.baseProduct)).toBe(P.profile);
    expect(variant.name).toContain("RAL 9016");
    // Re-planning replaces orders not started
    const again = await request(app).post(`/api/projects/${projectId}/production/plan`).set(h());
    expect(again.status).toBe(201);
    orders = Object.fromEntries(again.body.data.orders.map((o) => [o.kind, o]));
  });

  it("runs the workshops: laquage → vitrage → aluminium", async () => {
    // Aluminium waits for its feeders
    const early = await request(app).post(`/api/production-orders/${orders.aluminium._id}/start`).set(h());
    expect(early.status).toBe(409);

    const rawBefore = await tenantScope.runAsSystem(() => Product.findById(P.profile).lean());
    const powderBefore = await tenantScope.runAsSystem(() => Product.findById(P.powder).lean());
    const laqOrder = (await request(app).get(`/api/production-orders/${orders.laquage._id}`).set(h())).body.data;
    const out = laqOrder.outputs[0];
    const doneLaq = await request(app).post(`/api/production-orders/${orders.laquage._id}/complete`).set(h()).send({ outputs: [{ output: out._id, produced: out.quantity - 1, rejected: 1 }] });
    expect(doneLaq.status).toBe(200);
    expect(doneLaq.body.data.status).toBe("done");
    const rawAfter = await tenantScope.runAsSystem(() => Product.findById(P.profile).lean());
    const powderAfter = await tenantScope.runAsSystem(() => Product.findById(P.powder).lean());
    const variant = await tenantScope.runAsSystem(() => Product.findById(out.variant._id).lean());
    expect(rawBefore.quantity - rawAfter.quantity).toBe(out.quantity);
    expect(powderAfter.quantity).toBeLessThan(powderBefore.quantity);
    expect(variant.quantity).toBe(out.quantity - 1); // one bar rejected
    expect(variant.standardCost).toBeGreaterThan(195); // raw price + powder

    // A Vitrage member works his workshop… but not the others
    const board = await request(app).get(`/api/production-orders/board?companyId=${companyId}`).set(h(memberToken));
    expect(board.status).toBe(200);
    expect(board.body.data.map((w) => w.code)).toEqual(["VIT"]);
    expect((await request(app).get(`/api/production-orders/${orders.aluminium._id}`).set(h(memberToken))).status).toBe(403);
    expect((await request(app).put(`/api/production/models/${windowModel}`).set(h(memberToken)).send({ name: "x" })).status).toBe(403);
    const vitDone = await request(app).post(`/api/production-orders/${orders.vitrage._id}/complete`).set(h(memberToken)).send({});
    expect(vitDone.status).toBe(200);
    // Laquage + Vitrage done → "OF … peut démarrer" and "terminé" for production (the admin)
    const Notification = require("../models/Notification");
    const notes = await tenantScope.runAsSystem(() => Notification.find({ type: "production" }).lean());
    expect(notes.some((n) => n.key === "orderDone" && n.params.workshop === "Vitrage")).toBe(true);

    // Aluminium: starts, books part of one need, then completes (the laquage
    // reject means one bar is missing → shortage unless forced)
    await request(app).post(`/api/production-orders/${orders.aluminium._id}/start`).set(h()).expect(200);
    const alu = (await request(app).get(`/api/production-orders/${orders.aluminium._id}`).set(h())).body.data;
    const gasket = alu.needs.find((n) => n.kind === "gasket");
    const c1 = await request(app).post(`/api/production-orders/${orders.aluminium._id}/consume`).set(h()).send({ lines: [{ need: gasket._id, quantity: 5 }] });
    expect(c1.status).toBe(200);
    const blocked = await request(app).post(`/api/production-orders/${orders.aluminium._id}/complete`).set(h()).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.shortages[0].product).toContain("RAL 9016");
    const forced = await request(app).post(`/api/production-orders/${orders.aluminium._id}/complete`).set(h()).send({ force: true });
    expect(forced.status).toBe(200);
    const g = forced.body.data.needs.find((n) => n.kind === "gasket");
    expect(g.consumed).toBeCloseTo(g.theoretical, 3);

    // Project cost: aluminium + vitrage consumptions, NOT the raw bars (no double count)
    const detail = await request(app).get(`/api/projects/${projectId}`).set(h());
    const fin = detail.body.data.financials;
    expect(fin.actual.materials).toBeGreaterThan(0);
    expect(detail.body.data.productionOrders).toHaveLength(3);
    const moves = detail.body.data.materials;
    expect(moves.some((m) => String(m.product._id) === P.profile)).toBe(false);

    const pdf = await request(app).get(`/api/production-orders/${orders.aluminium._id}/pdf`).set(h()).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  it("lacquers an outside customer's bars (powder only)", async () => {
    const ws = (await request(app).get(`/api/production/workshops?companyId=${companyId}`).set(h())).body.data;
    const laq = ws.find((w) => w.code === "LAQ");
    const c = await request(app).post("/api/customers").set(h()).send({ company: companyId, name: "Menuiserie Voisine" });
    const rawBefore = await tenantScope.runAsSystem(() => Product.findById(P.profile).lean());
    const o = await request(app).post("/api/production-orders").set(h()).send({
      company: companyId, workshop: laq._id, customer: c.body.data._id, customerMaterial: true, title: "Laquage 40 barres client",
      lacquer: [{ product: P.profile, finish: finishId, quantity: 40 }],
    });
    expect(o.status).toBe(201);
    expect(o.body.data.needs).toHaveLength(1);
    expect(o.body.data.needs[0].kind).toBe("powder");
    const done = await request(app).post(`/api/production-orders/${o.body.data._id}/complete`).set(h()).send({});
    expect(done.status).toBe(200);
    const rawAfter = await tenantScope.runAsSystem(() => Product.findById(P.profile).lean());
    expect(rawAfter.quantity).toBe(rawBefore.quantity);
  });
});
