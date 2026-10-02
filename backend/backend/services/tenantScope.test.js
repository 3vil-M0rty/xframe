import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

const ts = require("./tenantScope");
const fake = require("../test/fakeMongo");
const mongoose = require("mongoose");
const Company = require("../models/Company");
const Supplier = require("../models/Supplier");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const AuditLog = require("../models/AuditLog");
const Employee = require("../models/Employee");
const { migrateLegacyDataToTenants } = require("./tenantService");
const { getPurchasingRecipientIds, getHRRecipientIds } = require("./notificationService");

const oid = () => new mongoose.Types.ObjectId();
const COMPANY_FIELDS = { industry: "x", legalForm: "SARL" };

let tA;
let tB;
let cA;
let cB;
let ctxA;

beforeAll(() => fake.connect());

beforeEach(async () => {
  fake.reset();
  ts.enableStrictMode(false);
  tA = oid();
  tB = oid();
  const owner = oid();
  await ts.runAsSystem(async () => {
    cA = await Company.create({ name: "Alpha", tenant: tA, owner, ...COMPANY_FIELDS });
    cB = await Company.create({ name: "Beta", tenant: tB, owner, ...COMPANY_FIELDS });
    await Supplier.create({ company: cA._id, name: "A supplier" });
    await Supplier.create({ company: cB._id, name: "B supplier" });
  });
  ctxA = ts.tenantContext({ tenantId: tA, companyIds: [cA._id] });
});

afterEach(() => ts.enableStrictMode(false));

describe("tenant scope plugin", () => {
  it("find / findById / count / distinct / aggregate only see the client's data", async () => {
    await ts.runInTenant(ctxA, async () => {
      expect((await Supplier.find()).map((s) => s.name)).toEqual(["A supplier"]);
      expect((await Company.find()).map((c) => c.name)).toEqual(["Alpha"]);
      expect(await Company.findById(cB._id)).toBeNull();
      expect(await Supplier.countDocuments()).toBe(1);
      expect(await Supplier.distinct("name")).toEqual(["A supplier"]);
      expect(await Supplier.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }])).toEqual([{ _id: null, n: 1 }]);
      // An explicit filter for the other client's company still finds nothing.
      expect(await Supplier.find({ company: cB._id })).toEqual([]);
    });
  });

  it("updates and deletes cannot touch another client's records", async () => {
    await ts.runInTenant(ctxA, async () => {
      expect((await Supplier.updateMany({}, { $set: { notes: "x" } })).matchedCount).toBe(1);
      expect((await Supplier.deleteMany({})).deletedCount).toBe(1);
    });
    const left = await ts.runAsSystem(() => Supplier.find());
    expect(left.map((s) => s.name)).toEqual(["B supplier"]);
    expect(left[0].notes).toBeUndefined();
  });

  it("refuses to create a record in another client's company", async () => {
    await ts.runInTenant(ctxA, async () => {
      await expect(Supplier.create({ company: cB._id, name: "evil" })).rejects.toMatchObject({ status: 404 });
    });
  });

  it("refuses to move a record to another client's company", async () => {
    await ts.runInTenant(ctxA, async () => {
      const s = await Supplier.findOne();
      await expect(Supplier.updateOne({ _id: s._id }, { $set: { company: cB._id } })).rejects.toMatchObject({ status: 404 });
      await expect(Supplier.findByIdAndUpdate(s._id, { company: cB._id })).rejects.toMatchObject({ status: 404 });
      s.company = cB._id;
      await expect(s.save()).rejects.toMatchObject({ status: 404 });
    });
  });

  it("a company created in a request belongs to the client and is usable right away", async () => {
    await ts.runInTenant(ctxA, async () => {
      const c = await Company.create({ name: "Alpha 2", owner: oid(), ...COMPANY_FIELDS });
      expect(String(c.tenant)).toBe(String(tA));
      await expect(Supplier.create({ company: c._id, name: "new" })).resolves.toBeTruthy();
    });
  });

  it("new accounts and audit entries are attached to the client automatically", async () => {
    await ts.runInTenant(ctxA, async () => {
      const u = await User.create({ firstName: "a", lastName: "b", email: "new@a.test", password: "secret12" });
      expect(String(u.tenant)).toBe(String(tA));
      const log = await AuditLog.create({ company: cA._id, actor: u._id, action: "create", resourceType: "X", resourceId: oid() });
      expect(String(log.tenant)).toBe(String(tA));
    });
  });

  it("a client admin can never create or promote a platform_admin", async () => {
    await ts.runInTenant(ctxA, async () => {
      await expect(User.create({ firstName: "a", lastName: "b", email: "p@a.test", password: "secret12", role: "platform_admin" })).rejects.toMatchObject({ status: 403 });
      const u = await User.create({ firstName: "a", lastName: "b", email: "q@a.test", password: "secret12" });
      await expect(User.findByIdAndUpdate(u._id, { role: "platform_admin" })).rejects.toMatchObject({ status: 403 });
    });
  });

  it("emails stay unique platform-wide: skipTenantScope sees other clients' accounts", async () => {
    await ts.runAsSystem(() => User.create({ firstName: "b", lastName: "b", email: "taken@b.test", password: "secret12", tenant: tB }));
    await ts.runInTenant(ctxA, async () => {
      expect(await User.findOne({ email: "taken@b.test" })).toBeNull();
      expect(await User.findOne({ email: "taken@b.test" }).setOptions({ skipTenantScope: true })).not.toBeNull();
    });
  });

  it("the platform context sees no client data and cannot write it", async () => {
    await ts.runAsPlatform(async () => {
      expect(await Supplier.countDocuments()).toBe(0);
      expect(await Company.countDocuments()).toBe(0);
      await expect(Supplier.create({ company: cA._id, name: "x" })).rejects.toMatchObject({ status: 403 });
    });
  });

  it("strict mode: a query that lost its context throws instead of seeing everything", async () => {
    ts.enableStrictMode(true);
    await expect(Supplier.find()).rejects.toThrow(/Tenant context missing/);
    await expect(ts.runAsSystem(() => Supplier.countDocuments())).resolves.toBe(2);
  });

  it("every model that holds client data carries the plugin", () => {
    require("fs").readdirSync(require("path").join(__dirname, "..", "models")).forEach((f) => {
      if (f.endsWith(".js") && !f.endsWith(".test.js")) require(`../models/${f}`);
    });
    expect(ts.assertAllModelsScoped()).toBe(true);
  });
});

describe("background jobs pick recipients from the right client", () => {
  it("purchasing / HR alerts for a company only go to that client's people", async () => {
    const [a1, b1, hrA, hrB] = await ts.runAsSystem(() =>
      Promise.all([
        User.create({ firstName: "a", lastName: "a", email: "admin@a.test", password: "secret12", role: "admin", tenant: tA }),
        User.create({ firstName: "b", lastName: "b", email: "admin@b.test", password: "secret12", role: "admin", tenant: tB }),
        User.create({ firstName: "h", lastName: "a", email: "hr@a.test", password: "secret12", department: "hr", tenant: tA }),
        User.create({ firstName: "h", lastName: "b", email: "hr@b.test", password: "secret12", department: "hr", tenant: tB }),
      ])
    );
    await ts.runAsSystem(async () => {
      expect((await getPurchasingRecipientIds(cA._id)).sort()).toEqual([String(a1._id)]);
      expect((await getHRRecipientIds(cB)).sort()).toEqual([String(b1._id), String(hrB._id)].sort());
    });
    expect(hrA).toBeTruthy();
  });
});

describe("migration of data created before client isolation", () => {
  it("single-client install: creates one client and attaches everything", async () => {
    await ts.runAsSystem(async () => {
      await Company.updateMany({}, { $set: { tenant: null } });
      await User.create({ firstName: "o", lastName: "o", email: "old@x.test", password: "secret12", role: "admin" });
      await User.create({ firstName: "p", lastName: "p", email: "ops@x.test", password: "secret1234", role: "platform_admin" });
    });
    const report = await migrateLegacyDataToTenants({ log: () => {} });
    expect(report.createdTenant).toBeTruthy();
    expect(report.companies).toBe(2);
    expect(report.users).toBe(1);
    await ts.runAsSystem(async () => {
      expect(await Tenant.countDocuments()).toBe(1);
      expect(await Company.countDocuments({ tenant: report.createdTenant })).toBe(2);
      expect((await User.findOne({ email: "ops@x.test" })).tenant).toBeNull();
    });
    // Idempotent.
    const again = await migrateLegacyDataToTenants({ log: () => {} });
    expect(again.createdTenant).toBeNull();
  });

  it("clients already exist: attaches only what can be derived, never guesses", async () => {
    await ts.runAsSystem(async () => {
      await Tenant.create({ _id: tA, name: "A" });
      const owner = await User.create({ firstName: "o", lastName: "o", email: "own@a.test", password: "secret12", role: "owner", tenant: tA });
      await Company.create({ name: "Orphan owned by A", owner: owner._id, ...COMPANY_FIELDS, tenant: null });
      await Company.create({ name: "Orphan, unknown owner", owner: oid(), ...COMPANY_FIELDS, tenant: null });
      const emp = await Employee.collection.insertOne({ company: cA._id, firstName: "e", lastName: "e" });
      await User.create({ firstName: "e", lastName: "e", email: "emp@a.test", password: "secret12", employee: emp.insertedId });
    });
    const report = await migrateLegacyDataToTenants({ log: () => {} });
    expect(report.createdTenant).toBeNull();
    expect(report.companies).toBe(1);
    expect(report.users).toBe(1);
    expect(report.unresolved).toBe(1);
    await ts.runAsSystem(async () => {
      expect(String((await User.findOne({ email: "emp@a.test" })).tenant)).toBe(String(tA));
      expect((await Company.findOne({ name: "Orphan, unknown owner" })).tenant).toBeNull();
    });
  });
});
