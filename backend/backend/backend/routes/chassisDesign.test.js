import { describe, it, expect, beforeAll } from "vitest";

/**
 * CAD design → model: "Fenêtre AWS 60" = dormant DOR 45°, a meneau MEN,
 * a fixed glazed part on the left and an opening sash OUV on the right,
 * parcloses PAR. The design generates the parts; the usual engine gives
 * the cut lengths and the bar plans; parts added by hand are kept.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "chassis-design-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const InventoryCategory = require("../models/InventoryCategory");

let app;
let token;
let companyId;
let seriesId;
let modelId;
const h = () => ({ Authorization: `Bearer ${token}` });
const api = (method, url) => request(app)[method](url).set(h());

// L 1600 × H 1400; DOR ch30 ae25 ai10 (hp 65); MEN hp 70; OUV ch26 ae8 ai6; PAR
const design = {
  frame: { code: "DOR", joint: "45" },
  beadCode: "PAR",
  root: {
    id: "r", kind: "split", dir: "v", code: "MEN",
    parts: [
      { size: null, node: { id: "f", kind: "cell", fill: "fixed", infill: "glass" } },
      { size: null, node: { id: "o", kind: "cell", fill: "sash", infill: "glass", sash: { code: "OUV", leaves: 1, opening: "tilt-right" } } },
    ],
  },
  preview: { L: 1600, H: 1400, quantity: 1 },
};

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/production", require("./productionConfig"));
  app.use("/api/products", require("./products"));
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const cat = await InventoryCategory.create({ company: company._id, name: "AWS 60" });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
    app.locals.cat = String(cat._id);
  });
  seriesId = (await api("post", "/api/production/series").send({ company: companyId, name: "AWS 60" })).body.data._id;
  const add = (name, code, geo) => api("post", "/api/products").send({
    company: companyId, category: app.locals.cat, name, internalReference: `AWS-${code}`, unit: "barre", materialType: "profile", stockMode: "bar", barLength: 6500,
    profileSeries: seriesId, seriesCode: code, ...geo,
  }).expect(201);
  await add("Dormant AWS 60", "DOR", { profileChamber: 30, profileOuterFin: 25, profileInnerFin: 10, profileWidth: 60 });
  await add("Meneau AWS 60", "MEN", { profileChamber: 50, profileOuterFin: 10, profileInnerFin: 10, profileWidth: 60 });
  await add("Ouvrant AWS 60", "OUV", { profileChamber: 26, profileOuterFin: 8, profileInnerFin: 6, profileWidth: 60 });
  await add("Parclose AWS 60", "PAR", { profileChamber: 18, profileWidth: 18 });
});

describe("CAD design", () => {
  it("preview: drawing, liaisons and cut lengths from the profiles of the series", async () => {
    const r = await api("post", "/api/production/designs/preview").send({ company: companyId, series: seriesId, design, L: 1600, H: 1400 });
    expect(r.status).toBe(200);
    const d = r.body.data;
    const cut = (role) => d.lines.find((l) => l.role === role)?.length;
    // jour dormant = cote − 2×(30+10) → 1520 × 1320 ; meneau axe→jour = 35
    expect(cut("dormant_top")).toBe(1650); // 1600 + 2×25 (45/45)
    expect(cut("dormant_bottom")).toBe(1650);
    expect(cut("dormant_left")).toBe(1450);
    expect(cut("div_r_m0")).toBe(1320); // meneau = hauteur du jour
    // 2 parts: (1520 − 70) / 2 = 725 each
    const cellF = d.layout.find((x) => x.id === "f");
    expect(cellF).toMatchObject({ x: 40, y: 40, w: 725, h: 1320 });
    // ouvrant: recouvrement 8 → 725 + 16 = 741 × 1336
    expect(cut("ouv_o_top")).toBe(741);
    expect(cut("ouv_o_hinge")).toBe(1336); // tilt-right: montant côté paumelles = droit
    expect(cut("ouv_o_lock")).toBe(1336);
    // parcloses fixe = jour of the cell; ouvrant = vantail − 2×(8+26+6)
    expect(cut("par_f_h")).toBe(725);
    expect(cut("par_o_v")).toBe(1336 - 80);
    expect(d.layout.find((x) => x.type === "leaf").opening).toBe("tilt-right");
    expect(d.links.find((l) => l.key === "x_jd")).toMatchObject({ formula: "DOR.ch + DOR.ai", value: 40 });
    // the débit: bars plans per profile
    const dor = d.report.bars.find((b) => b.name === "Dormant AWS 60");
    expect(dor.plan.bars).toBeGreaterThan(0);
    expect(d.errors).toEqual([]);
  });

  it("an adjusted liaison (measured in the coupe) changes the cuts", async () => {
    const adjusted = { ...design, frame: { ...design.frame, clear: "45" } };
    const d = (await api("post", "/api/production/designs/preview").send({ company: companyId, series: seriesId, design: adjusted })).body.data;
    expect(d.lines.find((l) => l.role === "div_r_m0").length).toBe(1400 - 90);
  });

  it("saved as a catalogue model: generated parts + parts added by hand are kept", async () => {
    const r = await api("post", "/api/production/models").send({ company: companyId, name: "Fenêtre AWS 60", series: seriesId, family: "ouvrant", design });
    expect(r.status).toBe(201);
    modelId = r.body.data._id;
    const m = r.body.data;
    expect(m.drawing.type).toBe("design");
    expect(m.design.layout.length).toBeGreaterThan(4);
    expect(m.components.every((c) => c.generated)).toBe(true);
    expect(m.parameters.map((p) => p.key)).toEqual(["vitrage"]);
    // add hardware by hand, then change the design: the hardware stays
    const withHinges = [...m.components, { role: "paumelles", label: "Paumelles", kind: "accessory", measure: "count", qty: "3" }];
    await api("put", `/api/production/models/${modelId}`).send({ components: withHinges }).expect(200);
    const twoLeaves = JSON.parse(JSON.stringify(design));
    twoLeaves.root.parts[1].node.sash.leaves = 2;
    const u = await api("put", `/api/production/models/${modelId}`).send({ design: twoLeaves });
    expect(u.status).toBe(200);
    const roles = u.body.data.components.map((c) => c.role);
    expect(roles).toContain("paumelles");
    expect(u.body.data.components.find((c) => c.role === "ouv_o_top").qty).toBe("2");
    expect(u.body.data.components.find((c) => c.role === "ouv_o_hinge").qty).toBe("2");
    // the model behaves like any other: test it at another size
    const t = (await api("post", `/api/production/models/${modelId}/test`).send({ L: 2000, H: 1500 })).body.data;
    expect(t.lines.find((l) => l.role === "dormant_top").length).toBe(2050);
    expect(t.errors).toEqual([]);
  });

  it("refuses a design without its profiles", async () => {
    const r = await api("post", "/api/production/designs/preview").send({ company: companyId, series: seriesId, design: { root: { kind: "cell" } } });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/dormant/);
  });
});
