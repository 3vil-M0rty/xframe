import { describe, it, expect, beforeAll } from "vitest";

/**
 * Technique → Données techniques: the article list filtered by technical
 * type, and a technical-only update that leaves prices / stock alone.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "products-technical-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Product = require("../models/Product");

let app;
let token;
let companyId;
const ids = {};
const h = () => ({ Authorization: `Bearer ${token}` });
const list = async (materialType) => (await request(app).get(`/api/products?companyId=${companyId}&materialType=${materialType}&limit=50`).set(h())).body.data.map((p) => p.name).sort();

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/products", require("./products"));
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const category = new mongoose.Types.ObjectId();
    const add = async (key, doc) => {
      const r = await Product.collection.insertOne({ company: company._id, category, unit: "u", isActive: true, quantity: 10, prices: [{ supplierName: "X", price: 100 }], ...doc });
      ids[key] = String(r.insertedId);
    };
    await add("profile", { name: "Dormant 67", materialType: "profile", stockMode: "bar", barLength: 6500 });
    await add("glass", { name: "Float 4", materialType: "glass", stockMode: "sheet", sheetWidth: 3210, sheetHeight: 2250 });
    await add("plain", { name: "Gants", materialType: null, stockMode: "unit" });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

describe("technical data of articles", () => {
  it("filters by technical type", async () => {
    expect(await list("any")).toEqual(["Dormant 67", "Float 4"]);
    expect(await list("profile")).toEqual(["Dormant 67"]);
    expect(await list("none")).toEqual(["Gants"]);
  });

  it("updates only the technical fields", async () => {
    const r = await request(app).put(`/api/products/${ids.profile}`).set(h())
      .send({ materialType: "profile", stockMode: "bar", barLength: 6000, profileChamber: 30, profileOuterFin: 12, profileInnerFin: 10, profileWidth: 50 });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ barLength: 6000, profileChamber: 30, profileWidth: 50, quantity: 10, name: "Dormant 67" });
    expect(r.body.data.prices[0].price).toBe(100);
  });
});
