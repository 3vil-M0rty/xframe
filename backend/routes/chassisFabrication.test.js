import { describe, it, expect, beforeAll } from "vitest";

/**
 * LogiKal-like fabrication: the series AWS 60 knows its accessories and
 * machining once (rules); a CAD chassis gets them automatically —
 * équerres per corner, connecteurs per T-joint, joint de frappe per
 * piece length, ferrure chosen by the leaf size (group of alternatives),
 * cales per pane; drainages, perçages paumelles, fraisage serrure and
 * the meneau connection drilled where the meneau meets the dormant.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "chassis-fab-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const InventoryCategory = require("../models/InventoryCategory");

let app;
let token;
let companyId;
let seriesId;
const ids = {};
const h = () => ({ Authorization: `Bearer ${token}` });
const api = (method, url) => request(app)[method](url).set(h());

// L 1600 × H 1400: fixe à gauche, oscillo-battant à droite (paumelles à droite), meneau MEN
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
    const admin = await User.create({ firstName: "A", lastName: "A", email: "fab@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const cat = await InventoryCategory.create({ company: company._id, name: "AWS 60" });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
    app.locals.cat = String(cat._id);
  });
  seriesId = (await api("post", "/api/production/series").send({ company: companyId, name: "AWS 60" })).body.data._id;
  const add = async (key, body) => {
    const r = await api("post", "/api/products").send({ company: companyId, category: app.locals.cat, internalReference: `REF-${key}`, ...body }).expect(201);
    ids[key] = r.body.data._id;
  };
  const profile = (key, name, geo) => add(key, { name, unit: "barre", materialType: "profile", stockMode: "bar", barLength: 6500, profileSeries: seriesId, seriesCode: key, ...geo });
  await profile("DOR", "Dormant AWS 60", { profileChamber: 30, profileOuterFin: 25, profileInnerFin: 10, profileWidth: 60 });
  await profile("MEN", "Meneau AWS 60", { profileChamber: 50, profileOuterFin: 10, profileInnerFin: 10, profileWidth: 60 });
  await profile("OUV", "Ouvrant AWS 60", { profileChamber: 26, profileOuterFin: 8, profileInnerFin: 6, profileWidth: 60, weightPerMeter: 1.5 });
  await profile("PAR", "Parclose AWS 60", { profileChamber: 18, profileWidth: 18 });
  await add("EQD", { name: "Équerre dormant", unit: "u", materialType: "accessory" });
  await add("EQO", { name: "Équerre ouvrant", unit: "u", materialType: "accessory" });
  await add("CON", { name: "Connecteur de meneau", unit: "u", materialType: "accessory" });
  await add("JF", { name: "Joint de frappe", unit: "m", materialType: "gasket", stockMode: "meter" });
  await add("FS", { name: "Ferrure OB taille S", unit: "u", materialType: "accessory" });
  await add("FL", { name: "Ferrure OB taille L", unit: "u", materialType: "accessory" });
  await add("CAL", { name: "Cale de vitrage", unit: "u", materialType: "accessory" });
});

describe("Fabrication rules of a series", () => {
  it("rules live on the profile articles and on the nodes (validated formulas and articles)", async () => {
    const bad = await api("put", `/api/production/profiles/${ids.DOR}/fab-rules`).send({ accessories: [{ product: ids.EQD, trigger: "corner", qty: "1 +" }] });
    expect(bad.status).toBe(400);
    const put = (code, body) => api("put", `/api/production/profiles/${ids[code]}/fab-rules`).send(body).expect(200);
    await put("DOR", {
      accessories: [{ label: "Équerres dormant", product: ids.EQD, trigger: "corner", qty: "1" }],
      machining: [
        { label: "Drainage", kind: "drain", tags: ["bottom"], face: "ext", place: "pitch", offset: "100", pitch: "600", size: "30×5" },
        { label: "Fixation meneau", kind: "drill", tags: ["top", "bottom"], place: "joints", size: "Ø 5.5" },
      ],
    });
    await put("OUV", {
      accessories: [
        { label: "Équerres ouvrant", product: ids.EQO, trigger: "corner", qty: "1" },
        { label: "Joint de frappe ouvrant", product: ids.JF, trigger: "piece", measure: "length", length: "long + 10" },
        { label: "Ferrure S", product: ids.FS, trigger: "leaf", group: "Ferrure", openings: ["tilt-left", "tilt-right"], maxW: 800, maxKg: 60 },
        { label: "Ferrure L", product: ids.FL, trigger: "leaf", group: "Ferrure", openings: ["tilt-left", "tilt-right"], minW: 800.1, maxW: 1300 },
      ],
      machining: [
        { label: "Perçage paumelle", kind: "drill", tags: ["hinge"], place: "at", at: "200; -200", size: "Ø 8" },
        { label: "Serrure", kind: "mill", tags: ["lock"], place: "center", size: "120×24" },
      ],
    });
    await put("MEN", { accessories: [{ label: "Connecteurs", product: ids.CON, trigger: "joint", qty: "1" }] });
    // glazing nodes (same deductions as the estimates) carrying the setting blocks
    const cales = [{ label: "Cales", product: ids.CAL, trigger: "pane", infill: "glass", qty: "gw > 1000 ? 8 : 6" }];
    await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "fixedGlazing", main: ids.DOR, bead: ids.PAR, glassThickness: 24, values: { bite: 7, beadExtra: 0 }, rules: cales }).expect(201);
    await api("post", `/api/production/series/${seriesId}/nodes`).send({ type: "sashGlazing", main: ids.OUV, bead: ids.PAR, glassThickness: 24, values: { glassEdge: 37, beadStart: 40 }, rules: cales }).expect(201);
    const p = (await api("get", `/api/production/profiles/${ids.OUV}`)).body.data;
    expect(p.fabRules.accessories).toHaveLength(4);
    expect(p.fabRules.accessories[0].product.name).toBe("Équerre ouvrant");
    expect(p.nodes.map((n) => n.type)).toEqual(["sashGlazing"]);
  });

  it("the CAD chassis gets its accessories, hardware and machining automatically", async () => {
    const r = await api("post", "/api/production/designs/preview").send({ company: companyId, series: seriesId, design, L: 1600, H: 1400, quantity: 2 });
    expect(r.status).toBe(200);
    const d = r.body.data;
    const qtyOf = (name) => d.lines.filter((l) => l.fromRule && l.productName === name).reduce((s, l) => s + l.pieces, 0);
    expect(qtyOf("Équerre dormant")).toBe(8); // 4 corners × 2 chassis
    expect(qtyOf("Équerre ouvrant")).toBe(8);
    expect(qtyOf("Connecteur de meneau")).toBe(4); // 2 ends × 2
    expect(qtyOf("Cale de vitrage")).toBe(2 * (6 + 6)); // 2 panes (< 1000 wide) per chassis
    // ferrure chosen by leaf size: 741 wide → S, never L
    expect(qtyOf("Ferrure OB taille S")).toBe(2);
    expect(qtyOf("Ferrure OB taille L")).toBe(0);
    // joint de frappe = each sash piece + 10 → (741+10)×2 + (1336+10)×2 per chassis
    const jf = d.lines.filter((l) => l.productName === "Joint de frappe").reduce((s, l) => s + l.length * l.pieces, 0);
    expect(jf).toBe(2 * (2 * 751 + 2 * 1346));
    // machining on the pieces
    const piece = (role) => d.fabrication.pieces.find((p) => p.role === role);
    const ops = (role, label) => piece(role).ops.find((o) => o.label === label)?.positions;
    expect(ops("dormant_bottom", "Drainage")).toEqual([100, 583.3, 1066.7, 1550]); // 1650 long, ≤ 600 apart
    expect(ops("dormant_top", "Fixation meneau")).toEqual([825]); // meneau axis 800 + couvre-joint 25
    expect(ops("dormant_bottom", "Fixation meneau")).toEqual([825]);
    expect(ops("ouv_o_hinge", "Perçage paumelle")).toEqual([200, 1136]);
    expect(ops("ouv_o_lock", "Serrure")).toEqual([668]);
    expect(piece("ouv_o_hinge").tags).toContain("right");
    // the leaf: size, weight (profiles 1.5 kg/m, no glass composition), hardware that fits
    const leaf = d.fabrication.leaves[0];
    expect(leaf).toMatchObject({ lw: 741, lh: 1336, opening: "tilt-right" });
    expect(leaf.poids).toBeCloseTo((2 * (741 + 1336) / 1000) * 1.5, 1);
    expect(leaf.fits.Ferrure).toEqual(["Ferrure S"]);
    // machining travels with the cuts into the débit (workshop printouts)
    const dor = d.report.bars.find((b) => b.name === "Dormant AWS 60");
    expect(dor.cuts.find((c) => c.label === "Dormant — traverse basse").ops[0].label).toBe("Drainage");
    // accessories in the débit (stock units)
    expect(d.report.accessories.find((a) => a.name === "Équerre dormant").theoretical).toBe(8);
  });

  it("flags a leaf no hardware of the group fits (contrôle de faisabilité)", async () => {
    const big = { ...design, preview: { L: 3200, H: 1400, quantity: 1 } };
    const d = (await api("post", "/api/production/designs/preview").send({ company: companyId, series: seriesId, design: big, L: 3200, H: 2600 })).body.data;
    expect(d.fabrication.leaves[0].lw).toBeGreaterThan(1300);
    expect(d.warnings.some((w) => /aucune « Ferrure »/.test(w.message))).toBe(true);
    expect(d.fabrication.checks.some((c) => c.level === "warning")).toBe(true);
  });

  it("a saved CAD model brings the rules to every calculation (model test, devis, projets)", async () => {
    const m = (await api("post", "/api/production/models").send({ company: companyId, name: "Fenêtre AWS 60", series: seriesId, family: "ouvrant", design }).expect(201)).body.data;
    const t = (await api("post", `/api/production/models/${m._id}/test`).send({ L: 1200, H: 1300 })).body.data;
    expect(t.lines.some((l) => l.fromRule && l.label === "Équerres dormant")).toBe(true);
    expect(t.lines.find((l) => l.role === "dormant_bottom").ops.length).toBeGreaterThan(0);
  });

  it("prints the dossier de fabrication (PDF)", async () => {
    const r = await api("post", "/api/production/designs/dossier").send({ company: companyId, series: seriesId, design, L: 1600, H: 1400, quantity: 2, name: "Fenêtre AWS 60" })
      .buffer(true).parse((res, cb) => { const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/pdf/);
    expect(r.body.slice(0, 4).toString()).toBe("%PDF");
    expect(r.body.length).toBeGreaterThan(5000);
  });
});
