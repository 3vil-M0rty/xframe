import { describe, it, expect, beforeAll, beforeEach } from "vitest";

const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");

process.env.JWT_SECRET = "platform-test-secret";

let app;
let platformToken;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  a.use("/api/auth", require("./auth"));
  a.use("/api/platform", require("./platform"));
  a.use("/api/companies", require("./companies"));
  a.use("/api/users", require("./users"));
  return a;
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });

beforeAll(() => {
  fake.connect();
  app = buildApp();
  tenantScope.enableStrictMode(true);
});

beforeEach(async () => {
  fake.reset();
  const ops = await tenantScope.runAsSystem(() =>
    User.create({ firstName: "Ops", lastName: "Ops", email: "ops@frame.ma", password: "platform-pass-1", role: "platform_admin" })
  );
  platformToken = jwt.sign({ id: String(ops._id) }, process.env.JWT_SECRET);
});

async function createClient(name, email) {
  return request(app)
    .post("/api/platform/tenants")
    .set(bearer(platformToken))
    .send({ name, admin: { firstName: "Ad", lastName: "Min", email, password: "Client-pass-1" } });
}

describe("platform: client management", () => {
  it("creates a client with its first admin, who can log in", async () => {
    const res = await createClient("Atlas Group", "admin@atlas.ma");
    expect(res.status).toBe(201);
    expect(res.body.data.admin.email).toBe("admin@atlas.ma");

    const l = await login("admin@atlas.ma", "Client-pass-1");
    expect(l.status).toBe(200);
    expect(l.body.data.token).toBeTruthy();
  });

  it("refuses an admin email already used by ANOTHER client (emails are platform-wide)", async () => {
    await createClient("A", "same@x.ma");
    const res = await createClient("B", "same@x.ma");
    expect(res.status).toBe(400);
    const tenants = await tenantScope.runAsSystem(() => Tenant.find().lean());
    expect(tenants.map((t) => t.name)).toEqual(["A"]); // no half-created client left behind
  });

  it("suspending a client blocks login AND sessions already open; reactivating restores", async () => {
    const created = await createClient("Atlas Group", "admin@atlas.ma");
    const tenantId = created.body.data.tenant._id;
    const token = (await login("admin@atlas.ma", "Client-pass-1")).body.data.token;
    expect((await request(app).get("/api/companies").set(bearer(token))).status).toBe(200);

    await request(app).patch(`/api/platform/tenants/${tenantId}`).set(bearer(platformToken)).send({ status: "suspended" }).expect(200);
    expect((await login("admin@atlas.ma", "Client-pass-1")).status).toBe(403);
    expect((await request(app).get("/api/companies").set(bearer(token))).status).toBe(401); // open session ends

    await request(app).patch(`/api/platform/tenants/${tenantId}`).set(bearer(platformToken)).send({ status: "active" }).expect(200);
    expect((await request(app).get("/api/companies").set(bearer(token))).status).toBe(200);
  });

  it("lists clients with counts only — no business data", async () => {
    await createClient("Atlas Group", "admin@atlas.ma");
    const res = await request(app).get("/api/platform/tenants").set(bearer(platformToken));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ name: "Atlas Group", status: "active", counts: { companies: 0, users: 1, employees: 0 } });
  });

  it("the platform account itself cannot read client data through the normal routes", async () => {
    const created = await createClient("Atlas Group", "admin@atlas.ma");
    await tenantScope.runAsSystem(() =>
      Company.create({ name: "Atlas Industries", tenant: created.body.data.tenant._id, owner: created.body.data.admin._id, industry: "x", legalForm: "SARL" })
    );
    const res = await request(app).get("/api/companies").set(bearer(platformToken));
    expect(JSON.stringify(res.body)).not.toContain("Atlas Industries");
  });

  it("a company created by a client admin belongs to that client, and only that client sees it", async () => {
    await createClient("A", "admin@a.ma");
    await createClient("B", "admin@b.ma");
    const tokenA = (await login("admin@a.ma", "Client-pass-1")).body.data.token;
    const tokenB = (await login("admin@b.ma", "Client-pass-1")).body.data.token;

    const created = await request(app).post("/api/companies").set(bearer(tokenA)).send({ name: "Alpha Industries", industry: "Manufacturing", legalForm: "SARL" });
    expect(created.status).toBe(201);
    const tenantA = (await tenantScope.runAsSystem(() => Tenant.findOne({ name: "A" }).lean()))._id;
    expect(String(created.body.data.tenant)).toBe(String(tenantA));

    const listA = await request(app).get("/api/companies").set(bearer(tokenA));
    expect(JSON.stringify(listA.body)).toContain("Alpha Industries");
    const listB = await request(app).get("/api/companies").set(bearer(tokenB));
    expect(JSON.stringify(listB.body)).not.toContain("Alpha Industries");
    expect((await request(app).get(`/api/companies/${created.body.data._id}`).set(bearer(tokenB))).status).toBe(404);

    // Trying to plant a company inside another client is refused.
    const tenantB = (await tenantScope.runAsSystem(() => Tenant.findOne({ name: "B" }).lean()))._id;
    const planted = await request(app).post("/api/companies").set(bearer(tokenA)).send({ name: "Trojan", industry: "x", legalForm: "SARL", tenant: String(tenantB) });
    expect(planted.status).toBeGreaterThanOrEqual(400);
    expect(await tenantScope.runAsSystem(() => Company.countDocuments({ tenant: tenantB }))).toBe(0);
  });

  it("client admins cannot use platform routes", async () => {
    await createClient("Atlas Group", "admin@atlas.ma");
    const token = (await login("admin@atlas.ma", "Client-pass-1")).body.data.token;
    expect((await request(app).get("/api/platform/tenants").set(bearer(token))).status).toBe(403);
    expect((await request(app).post("/api/platform/tenants").set(bearer(token)).send({ name: "x" })).status).toBe(403);
  });

  it("a client admin creating a user with an email taken by another client gets a clean error", async () => {
    await createClient("A", "admin@a.ma");
    await createClient("B", "admin@b.ma");
    const token = (await login("admin@a.ma", "Client-pass-1")).body.data.token;
    const res = await request(app).post("/api/users").set(bearer(token)).send({
      firstName: "X", lastName: "Y", email: "admin@b.ma", password: "Whatever-1", role: "user",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/);
  });

  it("attaches records left without a client, and never moves a record between clients", async () => {
    const a = await createClient("A", "admin@a.ma");
    const b = await createClient("B", "admin@b.ma");
    const [orphan, owned] = await tenantScope.runAsSystem(() =>
      Promise.all([
        Company.create({ name: "Orphan Co", tenant: null, owner: a.body.data.admin._id, industry: "x", legalForm: "SARL" }),
        Company.create({ name: "B Co", tenant: b.body.data.tenant._id, owner: b.body.data.admin._id, industry: "x", legalForm: "SARL" }),
      ])
    );
    const list = await request(app).get("/api/platform/orphans").set(bearer(platformToken));
    expect(list.body.data.companies.map((c) => c.name)).toEqual(["Orphan Co"]);

    const res = await request(app)
      .post("/api/platform/orphans/assign")
      .set(bearer(platformToken))
      .send({ tenantId: a.body.data.tenant._id, companyIds: [String(orphan._id), String(owned._id)] });
    expect(res.body.data.companies).toBe(1);
    const bCo = await tenantScope.runAsSystem(() => Company.findById(owned._id).lean());
    expect(String(bCo.tenant)).toBe(String(b.body.data.tenant._id));
  });
});
