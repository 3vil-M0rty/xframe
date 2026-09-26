import { describe, it, expect, beforeAll } from "vitest";

/**
 * ============================================================
 * CROSS-CLIENT ATTACK TEST — every route, real auth, real models
 * ============================================================
 * Two clients share the database. Client B's records are all marked
 * "SECRET-B". Logged in as client A's ADMIN (the most powerful client
 * role), this test calls EVERY route of the API (discovered from the
 * routers themselves, so a new route is covered automatically), with
 * every id parameter, query parameter and body field pointing at
 * client B's records.
 *
 * It then proves that:
 *   1. no response ever contains client B's data;
 *   2. none of client B's records was changed or deleted;
 *   3. nothing new was created inside client B's company;
 *   4. the request context never got lost (strict mode is on, so a
 *      lost context would throw instead of silently seeing all).
 *
 * The database is the in-memory stand-in (test/fakeMongo.js): real
 * Mongoose, real hooks, real middleware/auth.js.
 * ============================================================
 */

const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const mongoose = require("mongoose");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "isolation-test-secret";

// Mounted exactly like server.js.
const MOUNTS = [
  ["/api/auth", "./auth"],
  ["/api/2fa", "./twoFactor"],
  ["/api/companies", "./companies"],
  ["/api/users", "./users"],
  ["/api/employees", "./employees"],
  ["/api/salaries", "./salaries"],
  ["/api/absences", "./absences"],
  ["/api/advances", "./advances"],
  ["/api/payroll", "./payroll"],
  ["/api/contracts", "./contracts"],
  ["/api/documents", "./documents"],
  ["/api/attendance", "./attendance"],
  ["/api/notifications", "./notifications"],
  ["/api/audit-logs", "./auditLogs"],
  ["/api/reports", "./reports"],
  ["/api/me", "./me"],
  ["/api/work-schedule", "./workSchedule"],
  ["/api/inventory-categories", "./inventoryCategories"],
  ["/api/departments", "./departments"],
  ["/api/job-positions", "./jobPositions"],
  ["/api/products", "./products"],
  ["/api/purchase-requests", "./purchaseRequests"],
  ["/api/performance-reviews", "./performanceReviews"],
  ["/api/disciplinary-actions", "./disciplinaryActions"],
  ["/api/holidays", "./holidays"],
  ["/api/suppliers", "./suppliers"],
  ["/api/purchase-orders", "./purchaseOrders"],
  ["/api/price-requests", "./priceRequests"],
  ["/api/platform", "./platform"],
  ["/api/files", "./files"],
];

// Which client-B record an `:id` under each mount should point at.
const MOUNT_MODEL = {
  "/api/companies": "Company",
  "/api/users": "User",
  "/api/employees": "Employee",
  "/api/salaries": "Salary",
  "/api/absences": "Absence",
  "/api/advances": "Advance",
  "/api/payroll": "PayrollRun",
  "/api/contracts": "Contract",
  "/api/documents": "EmployeeDocument",
  "/api/attendance": "Attendance",
  "/api/notifications": "Notification",
  "/api/audit-logs": "AuditLog",
  "/api/reports": "Company",
  "/api/me": "Absence",
  "/api/work-schedule": "WorkSchedule",
  "/api/inventory-categories": "InventoryCategory",
  "/api/departments": "Department",
  "/api/job-positions": "JobPosition",
  "/api/products": "Product",
  "/api/purchase-requests": "PurchaseRequest",
  "/api/performance-reviews": "PerformanceReview",
  "/api/disciplinary-actions": "DisciplinaryAction",
  "/api/holidays": "PublicHoliday",
  "/api/suppliers": "Supplier",
  "/api/purchase-orders": "PurchaseOrder",
  "/api/price-requests": "PriceRequest",
  "/api/platform": "Company",
  "/api/files": "EmployeeDocument",
};

const SECRET = "SECRET-B";
const oid = () => new mongoose.Types.ObjectId();

const T_A = oid();
const T_B = oid();
const ADMIN_A = oid();
const ADMIN_B = oid();
const COMPANY_A = oid();
const COMPANY_B = oid();
const EMP_A = oid();
const EMP_B = oid();
const LINE_B = oid();
const SUB_B = oid();
const SUB_A = oid();
const B = {}; // modelName -> client B record id

let app;
let routes = [];
let token;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  for (const [path, mod] of MOUNTS) {
    const r = require(mod);
    a.use(path, r.router || r);
  }
  a.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.message }));
  return a;
}

/** Every (method, full path) the routers declare. */
function discoverRoutes() {
  const out = [];
  for (const [mount, mod] of MOUNTS) {
    const r = require(mod);
    const router = r.router || r;
    for (const layer of router.stack || []) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ mount, method, path: mount + layer.route.path });
      }
    }
  }
  return out;
}

function rawDocs(Model) {
  return fake.rawCollection(Model.collection.name).docs;
}

function snapshotB() {
  const snap = {};
  for (const Model of Object.values(mongoose.models)) {
    const docs = rawDocs(Model).filter(
      (d) =>
        String(d.company) === String(COMPANY_B) ||
        String(d.tenant) === String(T_B) ||
        String(d._id) === String(COMPANY_B) ||
        String(d._id) === String(T_B) ||
        String(d.user) === String(ADMIN_B)
    );
    snap[Model.modelName] = JSON.stringify(docs.map((d) => ({ ...d })).sort((x, y) => String(x._id).localeCompare(String(y._id))));
  }
  return snap;
}

function countInCompanyB() {
  let n = 0;
  for (const Model of Object.values(mongoose.models)) {
    n += rawDocs(Model).filter((d) => String(d.company) === String(COMPANY_B)).length;
  }
  return n;
}

function seed() {
  const Tenant = require("../models/Tenant");
  const push = (Model, doc) => rawDocs(Model).push(doc);
  const now = new Date();
  push(Tenant, { _id: T_A, name: "Client A", status: "active", createdAt: now });
  push(Tenant, { _id: T_B, name: `Client ${SECRET}`, status: "active", createdAt: now });

  const User = mongoose.model("User");
  push(User, { _id: ADMIN_A, firstName: "Alice", lastName: "A", email: "a@a.test", password: "x", role: "admin", status: "active", tenant: T_A, createdAt: now });
  push(User, { _id: ADMIN_B, firstName: SECRET, lastName: SECRET, email: "secret-b@b.test", password: "x", role: "admin", status: "active", tenant: T_B, createdAt: now });
  B.User = ADMIN_B;

  const Company = mongoose.model("Company");
  push(Company, { _id: COMPANY_A, name: "Alpha", tenant: T_A, owner: ADMIN_A, legalForm: "SARL", industry: "x", isActive: true, createdAt: now });
  push(Company, { _id: COMPANY_B, name: SECRET, tenant: T_B, owner: ADMIN_B, legalForm: "SARL", industry: SECRET, isActive: true, createdAt: now });
  B.Company = COMPANY_B;

  // One client-B record in every collection that holds company data,
  // with every common text field set to the marker.
  for (const Model of Object.values(mongoose.models)) {
    if (["User", "Company", "Tenant"].includes(Model.modelName)) continue;
    const common = {
      name: SECRET, notes: SECRET, title: SECRET, label: SECRET, description: SECRET, reason: SECRET,
      firstName: SECRET, lastName: SECRET, number: SECRET, jobTitle: SECRET, message: SECRET,
      status: "pending", createdAt: now, updatedAt: now, date: now, year: 2026, month: 1, day: "2026-01-01",
    };
    const idB = Model.modelName === "Employee" ? EMP_B : oid();
    B[Model.modelName] = idB;
    if (Model.modelName === "Notification") {
      push(Model, { _id: idB, user: ADMIN_B, type: "other", ...common, read: false });
      continue;
    }
    const docB = { _id: idB, company: COMPANY_B, tenant: T_B, employee: EMP_B, supplier: oid(), ...common };
    if (Model.modelName === "PurchaseOrder") docB.lines = [{ _id: LINE_B, description: SECRET, quantity: 5, unitPrice: 10, receivedQuantity: 0 }];
    // Private files on client B's records (HR document, supplier
    // document, delivery note, invoice, quote).
    const fileB = { url: "https://files.test/SECRET-B.pdf", publicId: SECRET, originalName: `${SECRET}.pdf` };
    docB.file = fileB;
    docB.quoteFile = fileB;
    docB.documents = [{ _id: SUB_B, type: "rc", file: fileB }];
    docB.receptions = [{ _id: SUB_B, type: "reception", reference: SECRET, file: fileB, lines: [] }];
    docB.invoices = [{ _id: SUB_B, type: "invoice", number: SECRET, amountTTC: 1, date: now, file: fileB }];
    if (!Model.schema.path("tenant")) delete docB.tenant;
    push(Model, docB);

    // Client A gets its own record too, so the "A can use its own
    // data" checks below aren't vacuous.
    const docA = { _id: Model.modelName === "Employee" ? EMP_A : oid(), company: COMPANY_A, tenant: T_A, employee: EMP_A, ...common, name: "A-data", notes: "A-data", title: "A-data", firstName: "A-data", lastName: "A-data", number: "A-1", jobTitle: "A-data" };
    if (!Model.schema.path("tenant")) delete docA.tenant;
    const fileA = { url: "https://files.test/a.pdf", publicId: "a", originalName: "a.pdf" };
    docA.file = fileA;
    docA.quoteFile = fileA;
    docA.documents = [{ _id: SUB_A, type: "rc", file: fileA }];
    docA.receptions = [{ _id: SUB_A, type: "reception", reference: "A", file: fileA, lines: [] }];
    docA.invoices = [{ _id: SUB_A, type: "invoice", number: "A", amountTTC: 1, date: now, file: fileA }];
    push(Model, docA);
  }
}

function paramValue(name, mount) {
  const n = name.toLowerCase();
  if (n.includes("company")) return String(COMPANY_B);
  if (n.includes("employee")) return String(EMP_B);
  if (n.includes("line")) return String(LINE_B);
  if (n.includes("user")) return String(ADMIN_B);
  const model = MOUNT_MODEL[mount];
  return String(B[model] || COMPANY_B);
}

function fillPath(path, mount) {
  return path.replace(/:([A-Za-z_]+)\??/g, (_, name) => paramValue(name, mount));
}

const HOSTILE_QUERY = `company=${COMPANY_B}&companyId=${COMPANY_B}&employee=${EMP_B}&employeeId=${EMP_B}&tenant=${T_B}`;
const hostileBody = () => ({
  company: String(COMPANY_B),
  companyId: String(COMPANY_B),
  employee: String(EMP_B),
  employeeId: String(EMP_B),
  tenant: String(T_B),
  supplier: String(B.Supplier),
  product: String(B.Product),
  department: String(B.Department),
  jobPosition: String(B.JobPosition),
  category: String(B.InventoryCategory),
  ids: [String(B.Employee), String(B.Supplier)],
  employeeIds: [String(EMP_B)],
  name: "hijack",
  status: "approved",
});

beforeAll(() => {
  fake.connect();
  // Load every model + router first, then turn strict mode on: a
  // query that runs without a client context now throws.
  app = buildApp();
  routes = discoverRoutes();
  tenantScope.enableStrictMode(true);
  seed();
  token = jwt.sign({ id: String(ADMIN_A) }, process.env.JWT_SECRET);
});

describe("client data isolation (every route)", () => {
  it("discovers the whole API", () => {
    expect(routes.length).toBeGreaterThan(150);
  });

  it("client A's admin sees its own data (sanity — the attack test isn't vacuous)", async () => {
    const res = await request(app).get(`/api/suppliers?companyId=${COMPANY_A}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain("A-data");

    const companies = await request(app).get("/api/companies").set("Authorization", `Bearer ${token}`);
    expect(companies.status).toBe(200);
    expect(JSON.stringify(companies.body)).toContain("Alpha");
    expect(JSON.stringify(companies.body)).not.toContain(SECRET);
  });

  it("ATTACK: client A's admin cannot read, change, delete or create client B data on ANY route", async () => {
    const before = snapshotB();
    const countBefore = countInCompanyB();
    const leaks = [];
    const lostContext = [];

    for (const r of routes) {
      const url = `${fillPath(r.path, r.mount)}?${HOSTILE_QUERY}`;
      let req = request(app)[r.method](url).set("Authorization", `Bearer ${token}`).timeout(5000);
      if (["post", "put", "patch", "delete"].includes(r.method)) req = req.send(hostileBody());
      let res;
      try {
        // eslint-disable-next-line no-await-in-loop
        res = await req;
      } catch (err) {
        res = err.response || { status: 0, text: "" };
      }
      const text = `${res.text || ""}${res.body && Buffer.isBuffer(res.body) ? res.body.toString("latin1") : ""}`;
      if (text.includes(SECRET)) leaks.push(`${r.method.toUpperCase()} ${r.path} → ${res.status}`);
      if (text.includes("Tenant context missing")) lostContext.push(`${r.method.toUpperCase()} ${r.path}`);
    }

    expect(leaks).toEqual([]);
    expect(lostContext).toEqual([]);
    const after = snapshotB();
    for (const model of Object.keys(before)) {
      expect({ model, data: after[model] }).toEqual({ model, data: before[model] });
    }
    expect(countInCompanyB()).toBe(countBefore);
  }, 120000);

  it("ATTACK: no link to any of client B's private files; client A's own files open", async () => {
    const cases = [
      ["employee-document", "EmployeeDocument", null],
      ["supplier-document", "Supplier", true],
      ["order-reception", "PurchaseOrder", true],
      ["order-invoice", "PurchaseOrder", true],
      ["price-request-quote", "PriceRequest", null],
    ];
    for (const [kind, model, hasSub] of cases) {
      const qB = `kind=${kind}&id=${B[model]}${hasSub ? `&sub=${SUB_B}` : ""}`;
      // eslint-disable-next-line no-await-in-loop
      const resB = await request(app).get(`/api/files/link?${qB}`).set("Authorization", `Bearer ${token}`);
      expect({ kind, status: resB.status }).toEqual({ kind, status: 404 });
      expect(resB.text).not.toContain(SECRET);

      const idA = rawDocs(mongoose.model(model)).find((d) => String(d.company) === String(COMPANY_A))._id;
      const qA = `kind=${kind}&id=${idA}${hasSub ? `&sub=${SUB_A}` : ""}`;
      // eslint-disable-next-line no-await-in-loop
      const resA = await request(app).get(`/api/files/link?${qA}`).set("Authorization", `Bearer ${token}`);
      expect({ kind, status: resA.status, url: resA.body.data?.url }).toEqual({ kind, status: 200, url: "https://files.test/a.pdf" });
    }
  });

  it("client A's admin cannot reach the platform routes", async () => {
    const res = await request(app).get("/api/platform/tenants").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("keeps the client context through a multipart upload (multer)", async () => {
    const res = await request(app)
      .post(`/api/suppliers/${B.Supplier}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .field("type", "rc")
      .attach("file", Buffer.from("%PDF-1.4 test"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.text).not.toContain("Tenant context missing");
    expect(res.text).not.toContain(SECRET);
    expect([400, 403, 404]).toContain(res.status);
  });
});
