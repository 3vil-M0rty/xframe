import { describe, it, expect, vi, beforeEach } from "vitest";

const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = currentUser; next(); } };

const notifPath = require.resolve("../services/notificationService");
const notified = [];
require.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: {
  notify: vi.fn(), notifyMany: vi.fn(async (ids, payload) => notified.push({ ids, ...payload })),
  getProductionRecipientIds: vi.fn(async () => ["prodUser"]), getPurchasingRecipientIds: vi.fn(async () => ["buyer1"]),
  getHRRecipientIds: vi.fn(async () => []),
} };
const auditPath = require.resolve("../services/auditLogger");
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { logAudit: vi.fn() } };

const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseRequest = require("../models/PurchaseRequest");
const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");
const ordersRouter = require("./purchaseOrders");
const requestsRouter = require("./purchaseRequests");

const PRODUCTION = { id: "507f1f77bcf86cd799439101", role: "user", department: "production" };
const BUYER = { id: "507f1f77bcf86cd799439102", role: "user", department: "purchasing" };
const COMPANY = "507f1f77bcf86cd799439201";
const PRODUCT_ID = "507f1f77bcf86cd799439301";
const ORDER_ID = "507f1f77bcf86cd799439401";
const REQ_ID = "507f1f77bcf86cd799439501";

function app() {
  const a = express(); a.use(express.json());
  a.use("/api/purchase-orders", ordersRouter);
  a.use("/api/purchase-requests", requestsRouter);
  return a;
}

describe("receiving a purchase order moves stock and closes the request", () => {
  let order; let product; let movements; let linkedRequest;
  beforeEach(() => {
    vi.restoreAllMocks();
    notified.length = 0;
    movements = [];
    product = { _id: PRODUCT_ID, company: COMPANY, name: "Tôle acier 2mm", quantity: 40, async save() {} };
    order = new PurchaseOrder({
      _id: ORDER_ID, company: COMPANY, number: "BC-2026-0001", supplier: "507f1f77bcf86cd799439601", status: "sent",
      lines: [{ product: PRODUCT_ID, description: "Tôle acier 2mm", quantity: 200, unitPrice: 12.5, vatRate: 20 }],
      purchaseRequests: [REQ_ID],
    });
    vi.spyOn(order, "save").mockResolvedValue(order);
    linkedRequest = { _id: REQ_ID, company: COMPANY, status: "ordered", requestedQuantity: 200, requestedBy: PRODUCTION.id, product: { name: "Tôle" }, history: [], async save() {} };
    vi.spyOn(PurchaseOrder, "findById").mockImplementation(() => {
      const q = Promise.resolve(order); q.populate = () => Promise.resolve(order); return q;
    });
    vi.spyOn(Product, "findById").mockResolvedValue(product);
    vi.spyOn(InventoryMovement, "create").mockImplementation(async (m) => { movements.push(m); return m; });
    vi.spyOn(PurchaseRequest, "find").mockReturnValue({ populate: async () => [linkedRequest] });
  });

  const receive = (body) => { currentUser = BUYER; return request(app()).post(`/api/purchase-orders/${ORDER_ID}/receptions`).send(body); };

  it("refuses a reception without a BL number", async () => {
    const res = await receive({ type: "reception", lines: [{ lineId: String(order.lines[0]._id), quantity: 50 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/BL/);
    expect(movements).toHaveLength(0);
  });

  it("partial reception: +120 in stock, order partially received, request still open for production", async () => {
    const res = await receive({ type: "reception", reference: "BL-7781", lines: [{ lineId: String(order.lines[0]._id), quantity: 120 }] });
    expect(res.status).toBe(201);
    expect(product.quantity).toBe(160);
    expect(movements[0]).toMatchObject({ type: "in", quantity: 120, resultingQuantity: 160 });
    expect(movements[0].reason).toContain("BC-2026-0001");
    expect(movements[0].reason).toContain("BL-7781");
    expect(order.status).toBe("partially_received");
    expect(order.receptions[0].reference).toBe("BL-7781");
    expect(linkedRequest.status).toBe("ordered");
  });

  it("complete reception closes the linked request and notifies production", async () => {
    await receive({ type: "reception", reference: "BL-1", lines: [{ lineId: String(order.lines[0]._id), quantity: 200 }] });
    expect(order.status).toBe("received");
    expect(linkedRequest.status).toBe("received");
    expect(notified.some((n) => n.ids.includes(PRODUCTION.id) && /received/i.test(n.title))).toBe(true);
  });

  it("a return takes stock back out, but never below zero", async () => {
    order.lines[0].receivedQuantity = 200;
    order.status = "received";
    product.quantity = 15; // most of it already consumed
    const tooMuch = await receive({ type: "return", reference: "RET-1", lines: [{ lineId: String(order.lines[0]._id), quantity: 20 }] });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.message).toMatch(/only 15 in stock/);
    expect(product.quantity).toBe(15);
    const ok = await receive({ type: "return", reference: "RET-1", lines: [{ lineId: String(order.lines[0]._id), quantity: 10 }] });
    expect(ok.status).toBe(201);
    expect(product.quantity).toBe(5);
    expect(order.status).toBe("partially_received"); // 10 expected again
  });
});

describe("purchase request permissions", () => {
  beforeEach(() => { vi.restoreAllMocks(); notified.length = 0; });

  it("production creates a request; the purchasing team is notified", async () => {
    vi.spyOn(Product, "findOne").mockReturnValue({ select: async () => ({ name: "Tôle", unit: "kg" }) });
    vi.spyOn(PurchaseRequest, "create").mockImplementation(async (d) => ({ ...d, _id: REQ_ID, populate: async function p() { return this; } }));
    currentUser = PRODUCTION;
    const res = await request(app()).post("/api/purchase-requests").send({ company: COMPANY, product: PRODUCT_ID, requestedQuantity: 200 });
    expect(res.status).toBe(201);
    expect(notified[0]).toMatchObject({ ids: ["buyer1"], type: "purchase_request_pending", link: "/purchasing/requests" });
  });

  it("purchasing can't create requests, production can't process them", async () => {
    currentUser = BUYER;
    expect((await request(app()).post("/api/purchase-requests").send({ company: COMPANY, product: PRODUCT_ID, requestedQuantity: 1 })).status).toBe(403);
    currentUser = PRODUCTION;
    expect((await request(app()).patch(`/api/purchase-requests/${REQ_ID}/process`).send({ action: "ordered" })).status).toBe(403);
  });

  it("declining without a reason is refused; with a reason, production is told why", async () => {
    const doc = { _id: REQ_ID, company: COMPANY, status: "pending", requestedQuantity: 5, requestedBy: PRODUCTION.id, product: { name: "Tôle" }, history: [], async save() {} };
    vi.spyOn(PurchaseRequest, "findById").mockImplementation(() => {
      const q = Promise.resolve(doc); q.populate = () => { const r = Promise.resolve(doc); r.populate = () => r; return r; }; return q;
    });
    currentUser = BUYER;
    const noReason = await request(app()).patch(`/api/purchase-requests/${REQ_ID}/process`).send({ action: "declined" });
    expect(noReason.status).toBe(400);
    const withReason = await request(app()).patch(`/api/purchase-requests/${REQ_ID}/process`).send({ action: "declined", note: "Article discontinued" });
    expect(withReason.status).toBe(200);
    expect(doc.status).toBe("declined");
    expect(notified.at(-1).message).toContain("Article discontinued");
    expect(notified.at(-1).ids).toContain(PRODUCTION.id);
  });
});
