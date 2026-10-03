import { describe, it, expect, beforeAll } from "vitest";

/**
 * LogiKal-like technical base: each profile article carries its DXF
 * section (dimensions, kg/m, perimeter read from it), and NODES measured
 * on those sections drive the CAD deductions of every chassis of the
 * series — live: change a node and saved models follow.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { SAMPLES } = require("../scripts/sampleProfileDxf");
const dxf = require("../services/dxfSection");

process.env.JWT_SECRET = "profile-sections-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const InventoryCategory = require("../models/InventoryCategory");

let app;
let token;
let companyId;
let seriesId;
let otherSeries;
const ids = {};
const api = (method, url) => request(app)[method](url).set({ Authorization: `Bearer ${token}` });
const upload = (code, fields = {}) => {
  let r = api("post", `/api/production/profiles/${ids[code]}/section`).attach("file", Buffer.from(SAMPLES[code]()), `AWS60-${code}.dxf`);
  for (const [k, v] of Object.entries(fields)) r = r.field(k, typeof v === "string" ? v : JSON.stringify(v));
  return r;
};

const design = {
  frame: { code: "DOR", joint: "45" },
  beadCode: "PAR",
  root: { id: "o", kind: "cell", fill: "sash", infill: "glass", sash: { code: "OUV", leaves: 1, opening: "tilt-right" } },
  preview: { L: 1200, H: 1400, quantity: 1 },
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
    const admin = await User.create({ firstName: "A", lastName: "A", email: "dxf@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const cat = await InventoryCategory.create({ company: company._id, name: "Profilés" });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
    app.locals.cat = String(cat._id);
  });
  seriesId = (await api("post", "/api/production/series").send({ company: companyId, name: "AWS 60" })).body.data._id;
  otherSeries = (await api("post", "/api/production/series").send({ company: companyId, name: "AWS 75" })).body.data._id;
  for (const [code, name] of [["DOR", "Dormant AWS 60"], ["OUV", "Ouvrant AWS 60"], ["MEN", "Meneau AWS 60"], ["PAR", "Parclose AWS 60"], ["BAT", "Battement AWS 60"]]) {
    const r = await api("post", "/api/products").send({ company: companyId, category: app.locals.cat, name, internalReference: `AWS-${code}`, unit: "barre", materialType: "profile", stockMode: "bar", barLength: 6500 }).expect(201);
    ids[code] = r.body.data._id;
  }
  await api("post", `/api/production/series/${seriesId}/profiles`).send({ items: Object.keys(ids).map((code) => ({ product: ids[code], code })) }).expect(201);
  const x = await api("post", "/api/products").send({ company: companyId, category: app.locals.cat, name: "Dormant AWS 75", internalReference: "AWS75-DOR", unit: "barre", materialType: "profile", stockMode: "bar", barLength: 6500 }).expect(201);
  ids.X = x.body.data._id;
  await api("post", `/api/production/series/${otherSeries}/profiles`).send({ items: [{ product: ids.X, code: "DOR" }] }).expect(201);
});

describe("DXF sections of the profiles", () => {
  it("parses lines, arcs, bulges, blocks and chains loose segments into contours", () => {
    const ouv = dxf.build(dxf.parse(SAMPLES.OUV()).pieces);
    expect(ouv.metrics).toMatchObject({ width: 74, height: 48, loops: 3, holes: 2, openChains: 0 }); // LINE + ARC outline closed
    const dor = dxf.build(dxf.parse(SAMPLES.DOR()).pieces);
    expect(dor.metrics.holes).toBe(3); // 2 chambers + the screw port (block INSERT)
    // the drawing keeps every corner of the outline (12) and of each chamber (4)
    expect(dor.paths.map((p) => p.d.length / 2).slice(0, 3)).toEqual([12, 4, 4]);
    // outline 48×60 + 4×24 + 18×14 + 20×4 = 3308, minus 2 chambers 38×21 and the screw port
    expect(dor.metrics.area).toBeCloseTo(3308 - 2 * 798 - Math.PI * 2.2 * 2.2, 0);
    expect(() => dxf.parse("not a dxf")).toThrow();
  });

  it("imports the DXF on the article: dimensions, kg/m and perimeter come from the section", async () => {
    const r = await upload("DOR");
    expect(r.status).toBe(201);
    expect(r.body.data.section.metrics).toMatchObject({ width: 86, height: 60, outerPerimeter: 300 });
    const p = (await api("get", `/api/production/profiles/${ids.DOR}`)).body.data;
    expect(p.profileHeight).toBe(86);
    expect(p.profileWidth).toBe(60);
    expect(p.weightPerMeter).toBeCloseTo(r.body.data.section.metrics.kgm, 3);
    expect(p.perimeter).toBe(300);
    expect(p.profileRole).toBe("frame"); // from the code
    expect(p.section.fileName).toBe("AWS60-DOR.dxf");
    expect(p.section.paths.length).toBe(4);
  });

  it("previews and re-orients a section (quarter turns, mirrors) without re-importing", async () => {
    const prev = await api("post", "/api/production/profiles/section/preview").attach("file", Buffer.from(SAMPLES.MEN()), "men.dxf").field("transform", JSON.stringify({ rot: 90 }));
    expect(prev.status).toBe(200);
    expect(prev.body.data.metrics).toMatchObject({ width: 60, height: 92 });
    await upload("MEN");
    const r = await api("patch", `/api/production/profiles/${ids.MEN}/section`).send({ transform: { rot: 90, flipX: true } });
    expect(r.status).toBe(200);
    expect(r.body.data.section.metrics).toMatchObject({ width: 60, height: 92 });
    const back = await api("patch", `/api/production/profiles/${ids.MEN}/section`).send({ transform: { rot: 0 } });
    expect(back.body.data.product.profileHeight).toBe(92);
    const src = await api("get", `/api/production/profiles/${ids.MEN}/section/source`);
    expect(src.status).toBe(200);
    expect(src.text).toContain("LWPOLYLINE");
  });

  it("lists the sections of a series (node editor, CAD)", async () => {
    await upload("OUV");
    await upload("PAR");
    const list = (await api("get", `/api/production/series/${seriesId}/sections`)).body.data;
    const byCode = Object.fromEntries(list.map((x) => [x.code, x]));
    expect(byCode.OUV.section.metrics.width).toBe(74);
    expect(byCode.BAT.section).toBeNull();
    expect(byCode.OUV.role).toBe("sash");
  });
});

describe("Nodes drive the CAD", () => {
  let frameNode;
  it("refuses a node with a profile from another series, or without measured values", async () => {
    const r1 = await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "frame", main: ids.X, values: { cover: 20, clear: 48 } });
    expect(r1.status).toBe(400);
    const r2 = await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "frameSash", main: ids.DOR, values: { overlap: 8 } });
    expect(r2.status).toBe(400); // no sash
    const r3 = await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "frame", main: ids.DOR, values: {} });
    expect(r3.status).toBe(400);
  });

  it("frame + dormant/ouvrant + glazing nodes give the deductions (measured, not estimated)", async () => {
    frameNode = (await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "frame", main: ids.DOR, values: { cover: 20, clear: 48 }, placements: { cote: 20, jour: 68 } }).expect(201)).body.data;
    await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "frameSash", main: ids.DOR, second: ids.OUV, values: { overlap: 10 }, placements: { second: { x: 58, y: 4 } } }).expect(201);
    await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "sashGlazing", main: ids.OUV, bead: ids.PAR, glassThickness: 28, values: { glassEdge: 50, beadStart: 56 } }).expect(201);
    const d = (await api("post", "/api/production/designs/preview").send({ company: companyId, series: seriesId, design })).body.data;
    const link = (k) => d.links.find((l) => l.kind === k);
    expect(link("frameCover")).toMatchObject({ value: 20, source: "node" });
    expect(link("frameClear")).toMatchObject({ value: 48, source: "node" });
    expect(link("sashOverlap")).toMatchObject({ value: 10, source: "node" });
    const cut = (role) => d.lines.find((l) => l.role === role)?.length;
    expect(cut("dormant_top")).toBe(1240); // 1200 + 2 × 20
    // jour 1200 − 96 = 1104 ; vantail 1104 + 20 = 1124 ; verre 1124 − 100 = 1024 ; parclose 1124 − 112
    expect(cut("ouv_o_top")).toBe(1124);
    expect(cut("par_o_h")).toBe(1124 - 112);
    expect(d.layout.find((r) => r.type === "glass").w).toBe(1024);
  });

  it("saved models follow a node change without being saved again", async () => {
    const m = (await api("post", "/api/production/models").send({ company: companyId, name: "Fenêtre OB", series: seriesId, family: "ouvrant", design }).expect(201)).body.data;
    let t = (await api("post", `/api/production/models/${m._id}/test`).send({ L: 1200, H: 1400 })).body.data;
    expect(t.lines.find((l) => l.role === "dormant_top").length).toBe(1240);
    await api("put", `/api/production/nodes/${frameNode._id}`).send({ values: { cover: 25, clear: 50 } }).expect(200);
    t = (await api("post", `/api/production/models/${m._id}/test`).send({ L: 1200, H: 1400 })).body.data;
    expect(t.lines.find((l) => l.role === "dormant_top").length).toBe(1250);
  });

  it("a new DXF on a profile flags its nodes to check", async () => {
    await upload("DOR", { transform: { rot: 0 } });
    const list = (await api("get", `/api/production/series/${seriesId}/nodes`)).body.data;
    expect(list.find((n) => n.type === "frame").stale).toBe(true);
    expect(list.find((n) => n.type === "sashGlazing").stale).toBe(false);
  });
});
