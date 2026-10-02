import { describe, it, expect, beforeAll } from "vitest";

/**
 * Interface theme: the company's "Thème sombre" is the default for its
 * users; each user can override it (or go back to the company default).
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "users-theme-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");

let app;
let token;
let companyId;
const h = () => ({ Authorization: `Bearer ${token}` });
const me = async () => (await request(app).get("/api/users/me").set(h())).body.data;

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/users", require("./users"));
  app.use("/api/companies", require("./companies"));
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const owner = await User.create({ firstName: "O", lastName: "O", email: "o@alu.ma", password: "secret12", role: "owner", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: owner._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    token = jwt.sign({ id: String(owner._id) }, process.env.JWT_SECRET);
  });
});

describe("interface theme", () => {
  it("defaults to the company theme (dark unless the company says otherwise)", async () => {
    const u = await me();
    expect(u.companyTheme).toBe("dark");
    expect(u.preferences?.theme ?? null).toBeNull();
  });

  it("follows the company's « Thème sombre » setting", async () => {
    await request(app).put(`/api/companies/${companyId}`).set(h())
      .send({ name: "Alu", industry: "x", legalForm: "SARL", branding: { darkMode: false } }).expect(200);
    expect((await me()).companyTheme).toBe("light");
  });

  it("a user's own choice is saved, and null goes back to the company default", async () => {
    const r = await request(app).patch("/api/users/me/preferences").set(h()).send({ theme: "dark" });
    expect(r.status).toBe(200);
    expect((await me()).preferences.theme).toBe("dark");
    await request(app).patch("/api/users/me/preferences").set(h()).send({ theme: null }).expect(200);
    expect((await me()).preferences.theme).toBeNull();
    await request(app).patch("/api/users/me/preferences").set(h()).send({ theme: "pink" }).expect(400);
  });
});
