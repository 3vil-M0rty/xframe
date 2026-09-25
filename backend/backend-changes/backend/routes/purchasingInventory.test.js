import { describe, it, expect, vi, beforeEach } from "vitest";

const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = currentUser; next(); } };
const auditPath = require.resolve("../services/auditLogger");
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { logAudit: vi.fn() } };

const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const Supplier = require("../models/Supplier");
const InventoryCategory = require("../models/InventoryCategory");
const InventoryMovement = require("../models/InventoryMovement");
const productsRouter = require("./products");
const ordersRouter = require("./purchaseOrders");

const BUYER = { id: "507f1f77bcf86cd799439102", role: "user", department: "purchasing" };
const PRODUCTION = { id: "507f1f77bcf86cd799439101", role: "user", department: "production" };
const EMPLOYEE = { id: "507f1f77bcf86cd799439103", role: "user", department: undefined };
const PRODUCT_ID = "507f1f77bcf86cd799439301";
const ORDER_ID = "507f1f77bcf86cd799439401";
const COMPANY = "507f1f77bcf86cd799439201";
const CATEGORY = "507f1f77bcf86cd799439701";

const app = () => {
  const a = express(); a.use(express.json());
  a.use("/api/products", productsRouter);
  a.use("/api/purchase-orders", ordersRouter);
  return a;
};

describe("purchasing edits an article's supplier prices & references", () => {
  let product;
  beforeEach(() => {
    vi.restoreAllMocks();
    product = { _id: PRODUCT_ID, name: "Tôle", internalReference: "", prices: [], saved: false, async save() { this.saved = true; } };
    vi.spyOn(Product, "findById").mockImplementation(async () => product);
  });
  const patch = (user, body) => { currentUser = user; return request(app()).patch(`/api/products/${PRODUCT_ID}/supplier-info`).send(body); };

  it("adds supplier prices and references, and fills a MISSING internal reference", async () => {
    const res = await patch(BUYER, {
      prices: [{ supplierName: "AcierPlus", supplierReference: "AP-2MM", price: 12.5 }, { supplierName: "MetalSud", price: "11.9" }],
      internalReference: "rm-steel-2mm",
    });
    expect(res.status).toBe(200);
    expect(product.prices).toEqual([
      { supplierName: "AcierPlus", supplierReference: "AP-2MM", price: 12.5 },
      { supplierName: "MetalSud", supplierReference: undefined, price: 11.9 },
    ]);
    expect(product.internalReference).toBe("RM-STEEL-2MM");
  });

  it("SECURITY: purchasing can't CHANGE an existing internal reference; production can", async () => {
    product.internalReference = "RM-OLD";
    expect((await patch(BUYER, { internalReference: "RM-NEW" })).status).toBe(403);
    expect(product.internalReference).toBe("RM-OLD");
    expect((await patch(PRODUCTION, { internalReference: "RM-NEW" })).status).toBe(200);
    expect(product.internalReference).toBe("RM-NEW");
  });

  it("rejects a price without supplier name or with a negative amount", async () => {
    expect((await patch(BUYER, { prices: [{ supplierName: "", price: 1 }] })).status).toBe(400);
    expect((await patch(BUYER, { prices: [{ supplierName: "X", price: -1 }] })).status).toBe(400);
    expect(product.saved).toBe(false);
  });

  it("a duplicate internal reference is a clear 409", async () => {
    product.save = async () => { const e = new Error("dup"); e.code = 11000; throw e; };
    expect((await patch(BUYER, { internalReference: "TAKEN" })).status).toBe(409);
  });

  it("SECURITY: someone outside production/purchasing is refused", async () => {
    expect((await patch(EMPLOYEE, { prices: [] })).status).toBe(403);
  });
});

describe("adding a typed-in order line to the inventory", () => {
  let order; let created; let movements;
  beforeEach(() => {
    vi.restoreAllMocks();
    movements = [];
    created = null;
    order = new PurchaseOrder({
      _id: ORDER_ID, company: COMPANY, number: "BC-2026-0007", supplier: "507f1f77bcf86cd799439601", status: "partially_received",
      lines: [{ description: "Gants anti-coupure", quantity: 50, unit: "paire", unitPrice: 18, vatRate: 20, receivedQuantity: 30 }],
    });
    vi.spyOn(order, "save").mockResolvedValue(order);
    vi.spyOn(PurchaseOrder, "findById").mockImplementation(() => { const q = Promise.resolve(order); q.populate = () => Promise.resolve(order); return q; });
    vi.spyOn(InventoryCategory, "exists").mockResolvedValue(true);
    vi.spyOn(Supplier, "findById").mockReturnValue({ select: async () => ({ name: "EquipPro" }) });
    vi.spyOn(Product, "create").mockImplementation(async (d) => { created = { ...d, _id: PRODUCT_ID, quantity: 0, async save() {} }; return created; });
    vi.spyOn(InventoryMovement, "create").mockImplementation(async (m) => { movements.push(m); return m; });
  });
  const post = (body) => { currentUser = BUYER; return request(app()).post(`/api/purchase-orders/${ORDER_ID}/lines/${order.lines[0]._id}/create-article`).send(body); };

  it("creates the article with this supplier's price, links the line, and stocks what was already received", async () => {
    const res = await post({ category: CATEGORY, threshold: 10 });
    expect(res.status).toBe(201);
    expect(created).toMatchObject({ name: "Gants anti-coupure", unit: "paire", threshold: 10, prices: [{ supplierName: "EquipPro", price: 18 }] });
    expect(created.internalReference).toBeUndefined(); // can be added later
    expect(String(order.lines[0].product)).toBe(PRODUCT_ID);
    expect(movements[0]).toMatchObject({ type: "in", quantity: 30, resultingQuantity: 30 });
    expect(created.quantity).toBe(30);
  });

  it("requires a category, and refuses a line that's already an article", async () => {
    expect((await post({})).status).toBe(400);
    order.lines[0].product = PRODUCT_ID;
    expect((await post({ category: CATEGORY })).status).toBe(400);
  });
});
