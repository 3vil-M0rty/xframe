import { describe, it, expect, beforeAll } from "vitest";

/**
 * Débit & vitrages, end to end through the real routes:
 *   cutting settings (blade, start / end of bar, space between cuts)
 *   → a glass composition "44.2 / 10 / 6" whose layers may be cut from
 *     several plateaux → a fixed window using it on a project →
 *     plan: bars optimised, plateaux chosen FROM STOCK and nested →
 *     cutting view with overrides → one PDF per material (project and
 *     work order) → devis → project → work orders still split
 *     Laquage / Vitrage / Aluminium.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "cutting-flow-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Product = require("../models/Product");

let app;
let token;
let companyId;
const P = {};
const h = () => ({ Authorization: `Bearer ${token}` });
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
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@verre.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Verre Atlas", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const category = new mongoose.Types.ObjectId();
    const add = async (key, doc) => {
      const r = await Product.collection.insertOne({ company: company._id, category, unit: "u", isActive: true, baseProduct: null, finish: null, ...doc });
      P[key] = String(r.insertedId);
    };
    await add("profile", { name: "Profilé dormant", internalReference: "PD", materialType: "profile", stockMode: "bar", barLength: 6500, profileChamber: 45, profileOuterFin: 25, profileInnerFin: 0, profileHeight: 70, profileWidth: 60, perimeter: 250, quantity: 100, prices: [{ supplierName: "X", price: 150 }] });
    await add("gasket", { name: "Joint", materialType: "gasket", stockMode: "meter", quantity: 1000, prices: [{ supplierName: "X", price: 3 }] });
    await add("accessory", { name: "Équerre", materialType: "accessory", stockMode: "unit", quantity: 5000, prices: [{ supplierName: "X", price: 2 }] });
    await add("consumable", { name: "Silicone", materialType: "consumable", stockMode: "unit", quantity: 500, prices: [{ supplierName: "X", price: 25 }] });
    // Plateaux
    await add("g4big", { name: "Float 4 mm 3000×1000", materialType: "glass", stockMode: "sheet", sheetWidth: 3000, sheetHeight: 1000, thickness: 4, quantity: 1, prices: [{ supplierName: "X", price: 300 }] });
    await add("g4small", { name: "Float 4 mm 2400×1000", materialType: "glass", stockMode: "sheet", sheetWidth: 2400, sheetHeight: 1000, thickness: 4, quantity: 2, prices: [{ supplierName: "X", price: 250 }] });
    await add("g10a", { name: "Clair 10 mm 3210×2250", materialType: "glass", stockMode: "sheet", sheetWidth: 3210, sheetHeight: 2250, thickness: 10, quantity: 0, prices: [{ supplierName: "X", price: 1500 }] });
    await add("g10b", { name: "Clair 10 mm 2550×1605", materialType: "glass", stockMode: "sheet", sheetWidth: 2550, sheetHeight: 1605, thickness: 10, quantity: 5, prices: [{ supplierName: "X", price: 900 }] });
    await add("g10c", { name: "Clair 10 mm 2000×1000", materialType: "glass", stockMode: "sheet", sheetWidth: 2000, sheetHeight: 1000, thickness: 10, quantity: 5, prices: [{ supplierName: "X", price: 500 }] });
    await add("g6", { name: "Clair 6 mm 2550×1605", materialType: "glass", stockMode: "sheet", sheetWidth: 2550, sheetHeight: 1605, thickness: 6, quantity: 10, prices: [{ supplierName: "X", price: 600 }] });
    await add("pvb", { name: "Film PVB 0.76", materialType: "consumable", stockMode: "m2", quantity: 100, prices: [{ supplierName: "X", price: 40 }] });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

const mapComponents = (components) => components.map((c) => {
  if (c.kind === "model" || c.productParam) return c;
  return { ...c, product: c.kind === "profile" ? P.profile : c.kind === "gasket" ? P.gasket : c.kind === "consumable" ? P.consumable : P.accessory };
});

describe("débit & vitrages", () => {
  let model;
  let glassType;
  let projectId;

  it("saves the bar-cutting and glass settings", async () => {
    const r = await request(app).put(`/api/production/settings?companyId=${companyId}`).set(h())
      .send({ kerf: 4, trimAllowance: 15, barEndTrim: 20, cutSpacing: 2, glassEdgeTrim: 10, glassCutGap: 3, glassAllowRotation: true });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ kerf: 4, trimAllowance: 15, barEndTrim: 20, cutSpacing: 2, glassEdgeTrim: 10, glassCutGap: 3 });
  });

  it("defines a glass composition 44.2 / 10 / 6 with its allowed plateaux", async () => {
    const r = await request(app).post("/api/production/glass-types").set(h()).send({
      company: companyId, name: "44.2 / 10 / 6", code: "442-10-6",
      layers: [
        { label: "Feuilleté 44.2 (2 × 4 mm)", thickness: 4, count: 2, sheets: [P.g4big, P.g4small] },
        { label: "Verre 10 mm", thickness: 10, count: 1, sheets: [P.g10a, P.g10b, P.g10c] },
        { label: "Verre 6 mm", thickness: 6, count: 1, sheets: [P.g6] },
      ],
      extras: [{ product: P.pvb, label: "Film PVB", measure: "area", qty: 1 }],
      labourPerPane: 10, labourPerM2: 5,
    });
    expect(r.status).toBe(201);
    glassType = r.body.data;
    expect(glassType.layers[0].sheets.map((s) => s.name)).toEqual(["Float 4 mm 3000×1000", "Float 4 mm 2400×1000"]);
    const list = await request(app).get(`/api/production/glass-types?companyId=${companyId}`).set(h());
    expect(list.body.data).toHaveLength(1);
    const bad = await request(app).post("/api/production/glass-types").set(h()).send({ company: companyId, name: "Vide", layers: [] });
    expect(bad.status).toBe(400);
  });

  it("uses it as the glass unit of a fixed window, priced from the plateaux", async () => {
    const imp = await request(app).post("/api/production/models/import").set(h()).send({ company: companyId, templateKey: "fixe" });
    expect(imp.status).toBe(201);
    model = imp.body.data._id;
    const full = (await request(app).get(`/api/production/models/${model}`).set(h())).body.data;
    await request(app).put(`/api/production/models/${model}`).set(h()).send({ components: mapComponents(full.components) }).expect(200);
    const t = await request(app).post(`/api/production/models/${model}/test`).set(h()).send({ L: 1200, H: 1000, quantity: 1, params: { vitrage: glassType._id } });
    expect(t.status).toBe(200);
    expect(t.body.data.errors).toEqual([]);
    const glassLines = t.body.data.lines.filter((l) => l.kind === "glass");
    expect(glassLines).toHaveLength(3);
    expect(glassLines[0].glassCandidates).toEqual([P.g4big, P.g4small]);
    expect(glassLines[0].pieces).toBe(2); // 44.2 = two 4 mm sheets
    const price = await request(app).post(`/api/production/models/${model}/price`).set(h()).send({ L: 1200, H: 1000, params: { vitrage: glassType._id } });
    expect(price.body.data.cost.materials).toBeGreaterThan(0);
    expect(price.body.data.description).toContain("44.2 / 10 / 6");
  });

  it("plans the project: bars optimised, plateaux picked from stock and nested", async () => {
    const p = await request(app).post("/api/projects").set(h()).send({ company: companyId, name: "Immeuble verre" });
    projectId = p.body.data._id;
    await request(app).post(`/api/projects/${projectId}/items`).set(h()).send({ model, ref: "F1", L: 1200, H: 1000, quantity: 4, params: { vitrage: glassType._id } }).expect(201);
    await request(app).post(`/api/projects/${projectId}/items`).set(h()).send({ model, ref: "F2", L: 700, H: 1100, quantity: 2, params: { vitrage: glassType._id } }).expect(201);

    const prev = await request(app).get(`/api/projects/${projectId}/production`).set(h());
    expect(prev.status).toBe(200);
    expect(prev.body.data.plan.errors).toEqual([]);
    const vit = prev.body.data.plan.workshops.find((w) => w.workshop.code === "VIT");
    const sheets4 = vit.needs.filter((n) => [P.g4big, P.g4small].includes(String(n.product)));
    // 2400×1000 nests best but only 2 are in stock → they are used, then the
    // single 3000×1000, and what is still missing is planned on 2400×1000 (to buy).
    const small = sheets4.find((n) => String(n.product) === P.g4small);
    expect(sheets4.find((n) => String(n.product) === P.g4big).theoretical).toBe(1);
    expect(small.theoretical).toBeGreaterThan(2);
    expect(small.warning).toMatch(/à acheter/);
    expect(sheets4.every((n) => n.unit === "plaque")).toBe(true);
    // 10 mm: 3210×2250 has no stock → the in-stock formats are used
    const sheets10 = vit.needs.filter((n) => [P.g10a, P.g10b, P.g10c].includes(String(n.product)));
    expect(sheets10.some((n) => String(n.product) === P.g10a)).toBe(false);
    // PVB film follows the panes (m²)
    expect(vit.needs.find((n) => String(n.product) === P.pvb).theoretical).toBeGreaterThan(0);
  });

  it("shows the débit with the settings, and recomputes with overrides", async () => {
    const r = await request(app).get(`/api/projects/${projectId}/production/cutting`).set(h());
    expect(r.status).toBe(200);
    const { report, source } = r.body.data;
    expect(source).toBe("plan");
    expect(report.settings).toMatchObject({ kerf: 4, trim: 15, endTrim: 20, spacing: 2, edgeTrim: 10, gap: 3 });
    expect(report.bars.length).toBeGreaterThan(0);
    const bar = report.bars.find((b) => b.name === "Profilé dormant");
    expect(bar.plan.patterns[0].cuts[0].pos).toBe(15); // first cut after the start of bar
    expect(report.glass.length).toBeGreaterThanOrEqual(4);
    expect(report.glass[0].plan.patterns[0].pieces[0]).toMatchObject({ x: 10, y: 10 });
    expect(report.panes).toHaveLength(2);
    expect(report.accessories.length).toBeGreaterThan(0);
    const thick = await request(app).get(`/api/projects/${projectId}/production/cutting?kerf=40&spacing=0&nest=false`).set(h());
    expect(thick.body.data.report.settings.kerf).toBe(40);
    const c0 = thick.body.data.report.bars.find((b) => b.plan).plan.patterns[0].cuts;
    if (c0.length > 1) expect(c0[1].pos - (c0[0].pos + c0[0].length)).toBe(40);
  });

  it("prints one paper per material", async () => {
    for (const section of ["bars", "accessories", "powder", "glass"]) {
      const pdf = await request(app).get(`/api/projects/${projectId}/production/pdf?section=${section}`).set(h()).buffer(true).parse(binary);
      expect(pdf.status).toBe(200);
      expect(pdf.body.slice(0, 4).toString()).toBe("%PDF");
    }
    const bad = await request(app).get(`/api/projects/${projectId}/production/pdf?section=nope`).set(h());
    expect(bad.status).toBe(400);
  });

  it("launches manufacturing; work orders keep the plans and print per material", async () => {
    const plan = await request(app).post(`/api/projects/${projectId}/production/plan`).set(h());
    expect(plan.status).toBe(201);
    const vit = plan.body.data.orders.find((o) => o.kind === "vitrage");
    const alu = plan.body.data.orders.find((o) => o.kind === "aluminium");
    expect(vit && alu).toBeTruthy();
    expect(vit.needs.find((n) => n.cutPlan?.type === "sheet").cutPlan.patterns.length).toBeGreaterThan(0);
    const cut = await request(app).get(`/api/production-orders/${vit._id}/cutting`).set(h());
    expect(cut.status).toBe(200);
    expect(cut.body.data.report.glass.length).toBeGreaterThan(0);
    expect(cut.body.data.report.glass[0].candidates.length).toBeGreaterThan(0);
    const pdf = await request(app).get(`/api/production-orders/${alu._id}/pdf?section=bars`).set(h()).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.slice(0, 4).toString()).toBe("%PDF");
    const full = await request(app).get(`/api/production-orders/${alu._id}/pdf`).set(h()).buffer(true).parse(binary);
    expect(full.status).toBe(200);
    const proj = await request(app).get(`/api/projects/${projectId}/production/cutting`).set(h());
    expect(proj.body.data.source).toBe("orders");
  });

  it("devis → project (edited) → start: still distributed to the workshops", async () => {
    const fin = await request(app).post("/api/production/finishes").set(h()).send({ company: companyId, code: "RAL 7016", kind: "lacquer" });
    const c = await request(app).post("/api/customers").set(h()).send({ company: companyId, name: "Client" });
    const q = await request(app).post("/api/quotes").set(h()).send({
      company: companyId, customer: c.body.data._id, subject: "Fixes",
      lines: [{ description: "Fixe", quantity: 2, unitPrice: 2000, vatRate: 20, chassis: { model, ref: "F1", L: 1000, H: 1000, finish: fin.body.data._id, params: { vitrage: glassType._id } } }],
    });
    await request(app).patch(`/api/quotes/${q.body.data._id}/status`).set(h()).send({ status: "accepted" }).expect(200);
    const p = await request(app).post(`/api/quotes/${q.body.data._id}/project`).set(h()).send({});
    const id = p.body.data._id;
    // Change the size from the site survey and add a chassis
    await request(app).put(`/api/projects/${id}/items/${p.body.data.items[0]._id}`).set(h()).send({ L: 1100 }).expect(200);
    await request(app).post(`/api/projects/${id}/items`).set(h()).send({ model, ref: "F9", L: 600, H: 600, quantity: 1, finish: fin.body.data._id, params: { vitrage: glassType._id } }).expect(201);
    const plan = await request(app).post(`/api/projects/${id}/production/plan`).set(h());
    expect(plan.status).toBe(201);
    expect(plan.body.data.orders.map((o) => o.kind).sort()).toEqual(["aluminium", "laquage", "vitrage"]);
  });

  it("débit professionnel: ailette externe 25 → 1000 coupé 1050 à 45/45, talons, tête-bêche, butée, étiquettes", async () => {
    const series = await request(app).post("/api/production/series").set(h()).send({ company: companyId, name: "Coulissant 67" });
    expect(series.status).toBe(201);
    const imp = await request(app).post("/api/production/models/import").set(h()).send({ company: companyId, templateKey: "coulissant_2v", series: series.body.data._id });
    const full = (await request(app).get(`/api/production/models/${imp.body.data._id}`).set(h())).body.data;
    await request(app).put(`/api/production/models/${imp.body.data._id}`).set(h()).send({ components: mapComponents(full.components) }).expect(200);
    const t = await request(app).post(`/api/production/models/${imp.body.data._id}/test`).set(h()).send({ L: 1000, H: 1000, quantity: 1, params: { vitrage: glassType._id } });
    const railHaut = t.body.data.lines.find((l) => l.role === "rail_haut");
    expect(railHaut.length).toBe(1050);
    expect(railHaut.angle).toBe("45/45");

    // Existing models of a series: changing the couvre-joint + "apply" updates their frame formulas.
    const s2 = await request(app).post("/api/production/series").set(h()).send({ company: companyId, name: "Fixe ancien" });
    const old = await request(app).post("/api/production/models/import").set(h()).send({ company: companyId, templateKey: "fixe", series: s2.body.data._id });
    const ChassisModel = require("../models/ChassisModel");
    await tenantScope.runAsSystem(() => ChassisModel.updateOne({ _id: old.body.data._id, "components.role": "dormant_h" }, { $set: { "components.$.length": "L" } }));
    const upd = await request(app).put(`/api/production/series/${s2.body.data._id}`).set(h()).send({ applyCoverJoint: true });
    expect(upd.body.data.updatedModels).toBe(1);
    const after = (await request(app).get(`/api/production/models/${old.body.data._id}`).set(h())).body.data;
    expect(after.components.find((c) => c.role === "dormant_h").length).toBe("L + 2*ae");
    // Other profiles' geometry is usable in formulas: ch_<role>, ae_<role>…
    const geo = await request(app).put(`/api/production/models/${old.body.data._id}`).set(h()).send({ derived: [...after.derived, { key: "clair", formula: "L - 2*(ch_dormant_v + ai_dormant_v)" }] });
    expect(geo.status).toBe(200);

    const p = await request(app).post("/api/projects").set(h()).send({ company: companyId, name: "Pro" });
    await request(app).post(`/api/projects/${p.body.data._id}/items`).set(h()).send({ model: imp.body.data._id, ref: "C1", L: 1000, H: 1000, quantity: 3, params: { vitrage: glassType._id } }).expect(201);
    const cut = await request(app).get(`/api/projects/${p.body.data._id}/production/cutting`).set(h());
    const bar = cut.body.data.report.bars.find((b) => b.name === "Profilé dormant");
    const c1050 = bar.cuts.find((c) => c.length === 1050);
    expect(c1050).toMatchObject({ angleL: 45, angleR: 45, heel: 910 });
    expect(bar.plan.savedByNesting).toBeGreaterThan(0);
    expect(bar.plan.patterns.some((pt) => pt.cuts.some((c) => c.nested))).toBe(true);
    expect(bar.plan.sawList.find((x) => x.length === 1050).qty).toBe(12); // 4 frame pieces × 3
    expect(bar.plan.patterns[0].firstBar).toBe(1);
    const off = await request(app).get(`/api/projects/${p.body.data._id}/production/cutting?nest=false`).set(h());
    expect(off.body.data.report.bars.find((b) => b.name === "Profilé dormant").plan.savedByNesting).toBe(0);
    for (const section of ["bars", "labels"]) {
      const pdf = await request(app).get(`/api/projects/${p.body.data._id}/production/pdf?section=${section}`).set(h()).buffer(true).parse(binary);
      expect(pdf.status).toBe(200);
    }
  });

  it("chassis without glass are flagged; once chosen, a running project gets its Vitrage order", async () => {
    const p = await request(app).post("/api/projects").set(h()).send({ company: companyId, name: "Sans vitrage" });
    const id = p.body.data._id;
    const item = await request(app).post(`/api/projects/${id}/items`).set(h()).send({ model, ref: "N1", L: 1000, H: 1000, quantity: 2, params: {} });
    const prev = await request(app).get(`/api/projects/${id}/production`).set(h());
    expect(prev.body.data.missingGlass).toEqual([expect.objectContaining({ ref: "N1", param: "vitrage", quantity: 2 })]);
    const plan = await request(app).post(`/api/projects/${id}/production/plan`).set(h());
    expect(plan.body.data.orders.map((o) => o.kind)).toEqual(["aluminium"]);
    const alu = plan.body.data.orders[0];
    await request(app).post(`/api/production-orders/${alu._id}/start`).set(h()).send({ force: true }).expect(200);
    // Re-planning a started project is refused, completing it is allowed
    expect((await request(app).post(`/api/projects/${id}/production/plan`).set(h())).status).toBe(409);
    expect((await request(app).post(`/api/projects/${id}/production/plan`).set(h()).send({ onlyMissing: true })).status).toBe(400);
    await request(app).put(`/api/projects/${id}/items/${item.body.data._id}`).set(h()).send({ params: { vitrage: glassType._id } }).expect(200);
    const after = await request(app).get(`/api/projects/${id}/production`).set(h());
    expect(after.body.data.missingGlass).toEqual([]);
    const complete = await request(app).post(`/api/projects/${id}/production/plan`).set(h()).send({ onlyMissing: true });
    expect(complete.status).toBe(201);
    expect(complete.body.data.orders.map((o) => o.kind)).toEqual(["vitrage"]);
    const cut = await request(app).get(`/api/projects/${id}/production/cutting`).set(h());
    expect(cut.body.data.report.glass.length).toBeGreaterThan(0);
    expect(cut.body.data.missingGlass).toEqual([]);
    const aluNow = await request(app).get(`/api/production-orders/${alu._id}`).set(h());
    expect(aluNow.body.data.status).toBe("in_progress");
  });
});
