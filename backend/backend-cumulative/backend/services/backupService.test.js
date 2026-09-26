import { describe, it, expect, beforeEach } from "vitest";

const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const { createFakeDb } = require("../test/fakeMongo");
const { backupDatabase, restoreDatabase } = require("./backupService");

const oid = () => new mongoose.Types.ObjectId();
let dir;
let source;
const T_A = oid();
const T_B = oid();
const C_A = oid();
const C_B = oid();
const U_A = oid();
const U_B = oid();

function seed(db) {
  db.collection("tenants").docs.push({ _id: T_A, name: "A" }, { _id: T_B, name: "B" });
  db.collection("companies").docs.push({ _id: C_A, tenant: T_A, name: "Alpha" }, { _id: C_B, tenant: T_B, name: "Beta" });
  db.collection("users").docs.push({ _id: U_A, tenant: T_A, email: "a@a" }, { _id: U_B, tenant: T_B, email: "b@b" });
  db.collection("employees").docs.push(
    { _id: oid(), company: C_A, firstName: "Ali", hireDate: new Date("2020-01-02T00:00:00Z"), salary: mongoose.mongo.BSON.Decimal128.fromString("1234.56") },
    { _id: oid(), company: C_B, firstName: "Bea" }
  );
  db.collection("notifications").docs.push({ _id: oid(), user: U_A, title: "x" }, { _id: oid(), user: U_B, title: "y" });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "frame-backup-"));
  source = createFakeDb("live");
  seed(source);
});

describe("backup and restore", () => {
  it("full backup → restore into an empty database gives back every document with exact types", async () => {
    const manifest = await backupDatabase(source, dir);
    expect(manifest.collections).toEqual({ companies: 2, employees: 2, notifications: 2, tenants: 2, users: 2 });

    const target = createFakeDb("restore-test");
    await restoreDatabase(target, dir);
    const ali = target.collection("employees").docs.find((e) => e.firstName === "Ali");
    expect(ali._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(ali.company.equals(C_A)).toBe(true);
    expect(ali.hireDate).toBeInstanceOf(Date);
    expect(ali.hireDate.toISOString()).toBe("2020-01-02T00:00:00.000Z");
    expect(String(ali.salary)).toBe("1234.56");
    expect(target.collection("users").docs).toHaveLength(2);
  });

  it("refuses to restore over a database that already has data, unless --drop", async () => {
    await backupDatabase(source, dir);
    await expect(restoreDatabase(source, dir)).rejects.toThrow(/not empty/);
    source.collection("companies").docs.push({ _id: oid(), name: "added after backup" });
    await restoreDatabase(source, dir, { mode: "drop" });
    expect(source.collection("companies").docs.map((c) => c.name).sort()).toEqual(["Alpha", "Beta"]);
  });

  it("one-client backup contains only that client's data", async () => {
    const manifest = await backupDatabase(source, dir, { tenantId: T_A });
    expect(manifest.tenant).toBe(String(T_A));
    const target = createFakeDb("export");
    await restoreDatabase(target, dir);
    expect(target.collection("companies").docs.map((c) => c.name)).toEqual(["Alpha"]);
    expect(target.collection("users").docs.map((u) => u.email)).toEqual(["a@a"]);
    expect(target.collection("employees").docs.map((e) => e.firstName)).toEqual(["Ali"]);
    expect(target.collection("notifications").docs).toHaveLength(1);
    expect(target.collection("tenants").docs.map((t) => t.name)).toEqual(["A"]);
  });

  it("merge puts one client back into a live database without touching the others", async () => {
    await backupDatabase(source, dir, { tenantId: T_A });
    // Client A's employees get lost; client B keeps working meanwhile.
    source.collection("employees").docs = source.collection("employees").docs.filter((e) => !e.company.equals(C_A));
    source.collection("employees").docs.push({ _id: oid(), company: C_B, firstName: "New B hire" });
    await restoreDatabase(source, dir, { mode: "merge" });
    expect(source.collection("employees").docs.map((e) => e.firstName).sort()).toEqual(["Ali", "Bea", "New B hire"]);
  });
});
