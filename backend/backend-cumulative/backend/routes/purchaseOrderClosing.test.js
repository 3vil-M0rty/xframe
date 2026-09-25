import { describe, it, expect, vi, beforeEach } from "vitest";
const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = { id: "507f1f77bcf86cd799439102", role: "user", department: "purchasing" }; next(); } };
const notifPath = require.resolve("../services/notificationService");
const notified = [];
require.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: {
  notify: vi.fn(), notifyMany: vi.fn(async (ids, p) => notified.push(p)), getProductionRecipientIds: vi.fn(async () => ["prod"]),
  getPurchasingRecipientIds: vi.fn(async () => []), getHRRecipientIds: vi.fn(async () => []) } };
const auditPath = require.resolve("../services/auditLogger");
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { logAudit: vi.fn() } };

const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseRequest = require("../models/PurchaseRequest");
const Supplier = require("../models/Supplier");
const router = require("./purchaseOrders");

const ID = "507f1f77bcf86cd799439401";
const REQ = "507f1f77bcf86cd799439501";
const app = () => { const a = express(); a.use(express.json()); a.use("/api/purchase-orders", router); return a; };

describe("closing a line short and paying against invoices", () => {
  let order; let linkedRequest;
  beforeEach(() => {
    vi.restoreAllMocks();
    notified.length = 0;
    order = new PurchaseOrder({
      _id: ID, company: "507f1f77bcf86cd799439201", number: "BC-2026-0010", supplier: "507f1f77bcf86cd799439601", status: "partially_received",
      lines: [{ description: "Gants anti-coupure", quantity: 70, unitPrice: 100, vatRate: 20, receivedQuantity: 69 }],
      purchaseRequests: [REQ],
    });
    vi.spyOn(order, "save").mockImplementation(async function save() { await this.validate(); return this; });
    linkedRequest = { _id: REQ, company: order.company, status: "ordered", requestedQuantity: 70, product: { name: "Gants" }, history: [], async save() {} };
    vi.spyOn(PurchaseOrder, "findById").mockImplementation(() => { const q = Promise.resolve(order); q.populate = () => Promise.resolve(order); return q; });
    vi.spyOn(PurchaseRequest, "find").mockReturnValue({ populate: async () => [linkedRequest] });
    vi.spyOn(Supplier, "findById").mockReturnValue({ select: async () => ({ paymentDays: 30 }) });
  });
  const lineUrl = (action) => `/api/purchase-orders/${ID}/lines/${order.lines[0]._id}/${action}`;

  it("69/70 + 'solder la ligne' -> order received, request closed, production notified", async () => {
    const res = await request(app()).patch(lineUrl("close")).send({ reason: "Reliquat abandonné" });
    expect(res.status).toBe(200);
    expect(order.lines[0].closed).toBe(true);
    expect(order.lines[0].closeReason).toBe("Reliquat abandonné");
    expect(order.status).toBe("received");
    expect(linkedRequest.status).toBe("received");
    expect(notified.some((n) => /received/i.test(n.title))).toBe(true);
    expect(res.body.data.analysis.match.receivedTTC).toBe(8280);
  });

  it("reopening puts the missing unit back as expected", async () => {
    await request(app()).patch(lineUrl("close")).send({});
    const res = await request(app()).patch(lineUrl("reopen")).send({});
    expect(res.status).toBe(200);
    expect(order.lines[0].closed).toBe(false);
    expect(order.status).toBe("partially_received");
  });

  it("invoice due date defaults to invoice date + the supplier's payment days", async () => {
    const res = await request(app()).post(`/api/purchase-orders/${ID}/invoices`).field("number", "F-778").field("date", "2026-09-01").field("amountTTC", "8280");
    expect(res.status).toBe(201);
    expect(new Date(order.invoices[0].dueDate).toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("once invoiced at 8 280, paying 8 280 settles it (not blocked by the 8 400 order total)", async () => {
    order.invoices.push({ type: "invoice", number: "F-778", date: new Date(), amountTTC: 8280 });
    const over = await request(app()).post(`/api/purchase-orders/${ID}/payments`).send({ date: "2026-09-10", amount: 8400, method: "virement" });
    expect(over.status).toBe(400);
    const ok = await request(app()).post(`/api/purchase-orders/${ID}/payments`).send({ date: "2026-09-10", amount: 8280, method: "virement" });
    expect(ok.status).toBe(201);
    expect(order.paymentStatus).toBe("paid");
    expect(order.amountDue).toBe(0);
  });

  it("a credit note (avoir) has no due date and reduces what's owed", async () => {
    order.invoices.push({ type: "invoice", number: "F-1", date: new Date(), amountTTC: 8400 });
    const res = await request(app()).post(`/api/purchase-orders/${ID}/invoices`).field("type", "credit_note").field("number", "AV-12").field("date", "2026-09-05").field("amountTTC", "120");
    expect(res.status).toBe(201);
    expect(order.invoices[1].dueDate).toBeNull();
    expect(order.amountDue).toBe(8280);
  });
});
