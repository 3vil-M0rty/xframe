import { describe, it, expect, beforeAll } from "vitest";

/**
 * Profile types of a series: the geometry of "AWS 60 › Ouvrant" is typed
 * once and every ouvrant of the series (and its colour variants) gets it.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "profile-types-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Product = require("../models/Product");
const InventoryCategory = require("../models/InventoryCategory");

let app;
let token;
let companyId;
let seriesId;
const P = {};
const h = () => ({ Authorization: `Bearer ${token}` });
const get = (id) => tenantScope.runAsSystem(() => Product.findById(id).lean());

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
    const root = await InventoryCategory.create({ company: company._id, name: "Profilés aluminium" });
    const aws = await InventoryCategory.create({ company: company._id, name: "AWS 60", parent: root._id });
    const add = async (key, doc) => {
      const r = await Product.collection.insertOne({ company: company._id, category: aws._id, unit: "barre", isActive: true, quantity: 5, materialType: "profile", stockMode: "bar", baseProduct: null, ...doc });
      P[key] = String(r.insertedId);
    };
    await add("ouv1", { name: "Ouvrant fenêtre 60" });
    await add("ouv2", { name: "Ouvrant renforcé", internalReference: "AWS-OR" });
    await add("ouvP", { name: "Ouvrant porte 60" });
    await add("dor", { name: "Dormant 60", profileChamber: 99 });
    await add("other", { name: "Tube 40x20" });
    await add("ouv1Ral", { name: "Ouvrant fenêtre 60 — RAL 9016", baseProduct: new mongoose.Types.ObjectId(P.ouv1) });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

describe("profile types of a series", () => {
  it("are saved with the series", async () => {
    const r = await request(app).post("/api/production/series").set(h()).send({
      company: companyId, name: "AWS 60",
      profileTypes: [
        { label: "Ouvrant", ch: 26, ae: 8, ai: 6, lp: 60, barLength: 6500 },
        { label: "Ouvrant porte", ch: 40, ae: 8, ai: 6, lp: 60 },
        { label: "Dormant", keywords: "cadre", ch: 30, ae: 25, ai: 10, lp: 60 },
      ],
    });
    expect(r.status).toBe(201);
    seriesId = r.body.data._id;
    expect(r.body.data.profileTypes.map((t) => t.key)).toEqual(["ouvrant", "ouvrant_porte", "dormant"]);
  });

  it("suggests series › type from names and categories (the longest match wins)", async () => {
    const r = await request(app).get(`/api/production/profile-types/suggestions?companyId=${companyId}`).set(h());
    const by = Object.fromEntries(r.body.data.suggestions.map((s) => [s.product.name, s.type.key]));
    expect(by).toMatchObject({ "Ouvrant fenêtre 60": "ouvrant", "Ouvrant renforcé": "ouvrant", "Ouvrant porte 60": "ouvrant_porte", "Dormant 60": "dormant" });
    expect(by["Tube 40x20"]).toBeUndefined();
    expect(r.body.data.suggestions.find((s) => s.product.name === "Dormant 60").changes.profileChamber).toEqual([99, 30]);
  });

  it("matches a series by its number and takes the type word that comes first", async () => {
    await tenantScope.runAsSystem(async () => {
      const c = new mongoose.Types.ObjectId(companyId);
      await Product.collection.insertMany([
        { company: c, name: "Montant dormant coulissant 67", materialType: "profile", stockMode: "bar", unit: "barre", isActive: true, baseProduct: null },
        { company: c, name: "Traverse vantail 67", materialType: "profile", stockMode: "bar", unit: "barre", isActive: true, baseProduct: null },
      ]);
    });
    await request(app).post("/api/production/series").set(h()).send({
      company: companyId, name: "Coulissant 67",
      profileTypes: [{ label: "Dormant", ch: 30 }, { label: "Montant", keywords: ["vantail"], ch: 28 }, { label: "Traverse", ch: 28 }],
    }).expect(201);
    const r = await request(app).get(`/api/production/profile-types/suggestions?companyId=${companyId}`).set(h());
    const by = Object.fromEntries(r.body.data.suggestions.map((x) => [x.product.name, `${x.series.name} › ${x.type.key}`]));
    expect(by["Montant dormant coulissant 67"]).toBe("Coulissant 67 › montant");
    expect(by["Traverse vantail 67"]).toBe("Coulissant 67 › traverse");
    expect(by["Ouvrant fenêtre 60"]).toBe("AWS 60 › ouvrant");
  });

  it("attaching copies the type's geometry onto the articles and their colour variants", async () => {
    const r = await request(app).post("/api/production/profile-types/attach").set(h()).send({
      company: companyId,
      groups: [
        { series: seriesId, type: "ouvrant", products: [P.ouv1, P.ouv2] },
        { series: seriesId, type: "dormant", products: [P.dor] },
      ],
      keepOwn: true,
    });
    expect(r.body.data.attached).toBe(3);
    const o1 = await get(P.ouv1);
    expect(o1).toMatchObject({ profileType: "ouvrant", profileChamber: 26, profileOuterFin: 8, profileInnerFin: 6, profileHeight: 40, profileWidth: 60, barLength: 6500 });
    expect((await get(P.ouv1Ral)).profileOuterFin).toBe(8);
    // keepOwn: the chamber already typed on the dormant stays its own
    const d = await get(P.dor);
    expect(d.profileChamber).toBe(99);
    expect(d.geometryOwn).toEqual(["profileChamber"]);
    expect(d.profileOuterFin).toBe(25);
  });

  it("changing the type in the series updates every ouvrant — except values set on one article", async () => {
    await request(app).put(`/api/products/${P.ouv2}`).set(h()).send({ profileOuterFin: 12 }).expect(200);
    const s = (await request(app).get(`/api/production/series?companyId=${companyId}`).set(h())).body.data[0];
    expect(s.typeCounts).toMatchObject({ ouvrant: 2, dormant: 1 });
    const types = s.profileTypes.map((t) => (t.key === "ouvrant" ? { ...t, ae: 10, ch: 28 } : t));
    const r = await request(app).put(`/api/production/series/${seriesId}`).set(h()).send({ profileTypes: types });
    expect(r.body.data.updatedArticles).toBe(3);
    expect(await get(P.ouv1)).toMatchObject({ profileOuterFin: 10, profileChamber: 28, profileHeight: 44 });
    expect((await get(P.ouv1Ral)).profileChamber).toBe(28);
    expect(await get(P.ouv2)).toMatchObject({ profileOuterFin: 12, profileChamber: 28, geometryOwn: ["profileOuterFin"] });
  });

  it("an article can go back to the type's values", async () => {
    await request(app).put(`/api/products/${P.ouv2}`).set(h()).send({ resetToType: true }).expect(200);
    expect(await get(P.ouv2)).toMatchObject({ profileOuterFin: 10, geometryOwn: [] });
  });

  it("removing a type detaches its articles (values kept); detach works on a selection", async () => {
    const s = (await request(app).get(`/api/production/series?companyId=${companyId}`).set(h())).body.data[0];
    await request(app).put(`/api/production/series/${seriesId}`).set(h()).send({ profileTypes: s.profileTypes.filter((t) => t.key !== "dormant") }).expect(200);
    expect(await get(P.dor)).toMatchObject({ profileSeries: null, profileType: null, profileChamber: 99 });
    await request(app).post("/api/production/profile-types/detach").set(h()).send({ company: companyId, products: [P.ouv1] }).expect(200);
    expect(await get(P.ouv1)).toMatchObject({ profileSeries: null, profileOuterFin: 10 });
  });
});
