import { describe, it, expect, beforeAll } from "vitest";

/**
 * The series is the profile library (AWS 60): profiles are articles with a
 * code (DOR, OUV), series variables are formulas over them (rec = OUV.ae - 2),
 * models use "the OUV of the series" and DOR.ch… — and when the dormant
 * article changes, the débit follows without touching any formula.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "series-library-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const InventoryCategory = require("../models/InventoryCategory");

let app;
let token;
let companyId;
let categoryId;
let seriesId;
let modelId;
const P = {};
const h = () => ({ Authorization: `Bearer ${token}` });
const api = (method, url) => request(app)[method](url).set(h());

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
    categoryId = String((await InventoryCategory.create({ company: company._id, name: "AWS 60" }))._id);
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

const profile = (name, code, geo) => api("post", "/api/products").send({
  company: companyId, category: categoryId, name, internalReference: `AWS-${code}-${name.length}`, unit: "barre", materialType: "profile", stockMode: "bar",
  profileSeries: seriesId, seriesCode: code, ...geo,
});

describe("series profile library", () => {
  it("creates the series and its profiles from the inventory (series + code on the article)", async () => {
    seriesId = (await api("post", "/api/production/series").send({ company: companyId, name: "AWS 60" }).expect(201)).body.data._id;
    P.dor = (await profile("Dormant AWS 60", "dor", { barLength: 6500, profileChamber: 30, profileOuterFin: 25, profileInnerFin: 10, profileWidth: 60 }).expect(201)).body.data._id;
    P.ouv = (await profile("Ouvrant AWS 60", "OUV", { barLength: 6500, profileChamber: 26, profileOuterFin: 8, profileInnerFin: 6, profileWidth: 60 }).expect(201)).body.data._id;
    const dup = await profile("Autre dormant", "DOR", {});
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/DOR/);
  });

  it("series variables are formulas over the profiles, with their current values", async () => {
    const bad = await api("put", `/api/production/series/${seriesId}`).send({ variables: [{ key: "x", formula: "PAR.ae + 1" }] });
    expect(bad.status).toBe(400);
    await api("put", `/api/production/series/${seriesId}`).send({ variables: [
      { key: "jeu", label: "Jeu de fonctionnement", formula: "5" },
      { key: "rec", label: "Recouvrement ouvrant", formula: "OUV.ae - 2" },
      { key: "fd", label: "Fond de feuillure dormant", formula: "DOR.ch + DOR.ai" },
    ] }).expect(200);
    const s = (await api("get", `/api/production/series/${seriesId}`).expect(200)).body.data;
    expect(Object.fromEntries(s.variables.map((v) => [v.key, v.current]))).toEqual({ jeu: 5, rec: 6, fd: 40 });
    expect(s.profiles.map((p) => p.seriesCode)).toEqual(["DOR", "OUV"]);
    expect(s.profiles[0].props.hp).toBe(65);
  });

  it("a model uses « the OUV of the series » and DOR.ae… in its formulas", async () => {
    const r = await api("post", "/api/production/models").send({
      company: companyId, name: "Fenêtre 1 vantail AWS 60", series: seriesId,
      components: [
        { role: "dormant", label: "Dormant", kind: "profile", measure: "length", seriesCode: "DOR", qty: "2", length: "L + 2*ae", angle: "45/45" },
        { role: "ouvrant", label: "Ouvrant", kind: "profile", measure: "length", seriesCode: "OUV", qty: "2", length: "L - 2*fd + 2*rec - jeu", angle: "45/45" },
        { role: "parclose", label: "Parclose", kind: "profile", measure: "length", seriesCode: "PAR", qty: "2", length: "L - 2*DOR.hp" },
      ],
    });
    expect(r.status).toBe(201);
    modelId = r.body.data._id;
    const t = (await api("post", `/api/production/models/${modelId}/test`).send({ L: 1000, H: 1000 }).expect(200)).body.data;
    const len = Object.fromEntries(t.lines.map((l) => [l.role, l.length]));
    expect(len.dormant).toBe(1050); // 1000 + 2×25
    expect(len.ouvrant).toBe(927); // 1000 - 2×40 + 2×6 - 5
    expect(t.lines.find((l) => l.role === "ouvrant").product).toBe(P.ouv);
    // PAR is not in the series yet: clear message, nothing silently wrong
    expect(t.errors.some((e) => /PAR/.test(e.message))).toBe(true);
    const s = (await api("get", `/api/production/series/${seriesId}`)).body.data;
    expect(s.missingCodes).toEqual(["PAR"]);
  });

  it("the dormant article changes → every débit of the series follows", async () => {
    await api("put", `/api/products/${P.dor}`).send({ profileOuterFin: 20, profileChamber: 32 }).expect(200);
    const t = (await api("post", `/api/production/models/${modelId}/test`).send({ L: 1000, H: 1000 })).body.data;
    const len = Object.fromEntries(t.lines.map((l) => [l.role, l.length]));
    expect(len.dormant).toBe(1040); // 1000 + 2×20
    expect(len.ouvrant).toBe(923); // fd = 32 + 10 = 42 → 1000 - 84 + 12 - 5
  });

  it("picker: articles not yet in the series with a suggested free code; add, edit, remove", async () => {
    const par = (await api("post", "/api/products").send({ company: companyId, category: categoryId, name: "Parclose AWS 60", internalReference: "AWS-PAR", unit: "barre", materialType: "profile", stockMode: "bar", profileWidth: 18 })).body.data._id;
    const ouv2 = (await api("post", "/api/products").send({ company: companyId, category: categoryId, name: "Ouvrant renforcé AWS 60", internalReference: "AWS-OR", unit: "barre", materialType: "profile", stockMode: "bar" })).body.data._id;
    const cands = (await api("get", `/api/production/series/${seriesId}/candidates`)).body.data;
    const code = Object.fromEntries(cands.map((c) => [c.name, c.suggestedCode]));
    expect(code).toMatchObject({ "Parclose AWS 60": "PAR", "Ouvrant renforcé AWS 60": "OUV2" });
    await api("post", `/api/production/series/${seriesId}/profiles`).send({ items: [{ product: par, code: "PAR" }, { product: ouv2, code: "OUV2" }] }).expect(201);
    const t = (await api("post", `/api/production/models/${modelId}/test`).send({ L: 1000, H: 1000 })).body.data;
    expect(t.lines.find((l) => l.role === "parclose").length).toBe(1000 - 2 * 62); // DOR.hp = 32 + 20 + 10
    expect(t.errors).toEqual([]);
    await api("patch", `/api/production/series/${seriesId}/profiles/${ouv2}`).send({ code: "OUVR", profileOuterFin: 10 }).expect(200);
    expect((await api("patch", `/api/production/series/${seriesId}/profiles/${ouv2}`).send({ code: "DOR" })).status).toBe(409);
    await api("delete", `/api/production/series/${seriesId}/profiles/${ouv2}`).expect(200);
    const s = (await api("get", `/api/production/series/${seriesId}`)).body.data;
    expect(s.profiles.map((p) => p.seriesCode)).toEqual(["DOR", "OUV", "PAR"]);
  });
});
