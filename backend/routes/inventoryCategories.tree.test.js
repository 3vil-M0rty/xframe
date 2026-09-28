import { describe, it, expect, beforeAll } from "vitest";

/**
 * Sub-categories: "Profilés aluminium" › "Série ATLAS 78 — coulissants",
 * "Série garde-corps"… Names unique among siblings only, no loops,
 * filtering a category lists its sub-categories' articles too, and a
 * category with sub-categories can't be deleted.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "categories-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Product = require("../models/Product");

let app;
let token;
let companyId;
const h = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/inventory-categories", require("./inventoryCategories"));
  app.use("/api/products", require("./products"));
  tenantScope.enableStrictMode(true);
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const a = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: a._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    token = jwt.sign({ id: String(a._id) }, process.env.JWT_SECRET);
  });
});

describe("inventory sub-categories", () => {
  const ids = {};
  const create = (name, parent) => request(app).post("/api/inventory-categories").set(h()).send({ company: companyId, name, parent });

  it("builds a tree with full names", async () => {
    ids.alu = (await create("Profilés aluminium")).body.data._id;
    ids.s78 = (await create("Série ATLAS 78 — coulissants", ids.alu)).body.data._id;
    ids.gc = (await create("Série garde-corps", ids.alu)).body.data._id;
    ids.acc78 = (await create("Accessoires", ids.s78)).body.data._id;
    // same name under another parent is fine…
    expect((await create("Accessoires", ids.gc)).status).toBe(201);
    // …but not twice under the same one
    expect((await create("Accessoires", ids.s78)).status).toBe(409);

    const r = await request(app).get(`/api/inventory-categories?companyId=${companyId}`).set(h());
    const names = r.body.data.map((c) => [c.fullName, c.depth]);
    expect(names).toEqual([
      ["Profilés aluminium", 0],
      ["Profilés aluminium › Série ATLAS 78 — coulissants", 1],
      ["Profilés aluminium › Série ATLAS 78 — coulissants › Accessoires", 2],
      ["Profilés aluminium › Série garde-corps", 1],
      ["Profilés aluminium › Série garde-corps › Accessoires", 2],
    ]);
  });

  it("refuses loops and too deep trees", async () => {
    const loop = await request(app).put(`/api/inventory-categories/${ids.alu}`).set(h()).send({ parent: ids.acc78 });
    expect(loop.status).toBe(400);
    const d4 = (await create("Niveau 4", ids.acc78)).body.data._id;
    expect((await create("Niveau 5", d4)).status).toBe(400);
    // move a series to the top level
    await request(app).put(`/api/inventory-categories/${ids.gc}`).set(h()).send({ parent: null }).expect(200);
    const r = await request(app).get(`/api/inventory-categories?companyId=${companyId}`).set(h());
    expect(r.body.data.find((c) => c._id === ids.gc).fullName).toBe("Série garde-corps");
  });

  it("a category lists its sub-categories' articles; can't delete a parent", async () => {
    await tenantScope.runAsSystem(async () => {
      await Product.create({ company: companyId, category: ids.s78, name: "Dormant 78", internalReference: "A78-D", quantity: 10, unit: "barre" });
      await Product.create({ company: companyId, category: ids.acc78, name: "Roulette 78", internalReference: "A78-R", quantity: 10, unit: "u" });
      await Product.create({ company: companyId, category: ids.gc, name: "Main courante", internalReference: "GC-MC", quantity: 10, unit: "barre" });
    });
    const list = async (cat) => {
      const r = await request(app).get(`/api/products?companyId=${companyId}&category=${cat}&limit=50`).set(h());
      const rows = r.body.data?.products || r.body.data?.items || r.body.data || r.body.products;
      return rows.map((p) => p.internalReference).sort();
    };
    expect(await list(ids.alu)).toEqual(["A78-D", "A78-R"]);
    expect(await list(ids.s78)).toEqual(["A78-D", "A78-R"]);
    expect(await list(ids.acc78)).toEqual(["A78-R"]);
    const del = await request(app).delete(`/api/inventory-categories/${ids.alu}`).set(h());
    expect(del.status).toBe(400);
    expect(del.body.message).toMatch(/sub-categor/);
  });
});

describe("sub-category accounting", () => {
  const { arrangeTree, effectiveAccounting } = require("../services/categoryTree");
  it("inherits the parent's account and fixed-asset flag when empty", () => {
    const tree = arrangeTree([
      { _id: "a", name: "Profilés", parent: null, accountingAccount: "6121" },
      { _id: "b", name: "Série 78", parent: "a", accountingAccount: "" },
      { _id: "c", name: "Outillage", parent: null, accountingAccount: "2332", isFixedAsset: true },
      { _id: "d", name: "Machines", parent: "c", accountingAccount: "23321" },
    ]);
    const acc = effectiveAccounting(tree);
    expect(acc.get("b")).toEqual({ accountingAccount: "6121", isFixedAsset: false });
    expect(acc.get("d")).toEqual({ accountingAccount: "23321", isFixedAsset: true });
  });
});
