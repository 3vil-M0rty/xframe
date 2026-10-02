import { describe, it, expect, vi, beforeEach } from "vitest";
const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = { id: "507f1f77bcf86cd799439102", role: "user", department: "purchasing" }; next(); } };
const auditPath = require.resolve("../services/auditLogger");
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { logAudit: vi.fn() } };

const PurchaseOrder = require("../models/PurchaseOrder");
const Supplier = require("../models/Supplier");
const router = require("./purchaseOrders");
const COMPANY = "507f1f77bcf86cd799439201";
const SUPPLIER = "507f1f77bcf86cd799439601";
const app = () => { const a = express(); a.use(express.json()); a.use("/api/purchase-orders", router); return a; };

const mk = (number, invoices, supplier = SUPPLIER) => {
  const o = new PurchaseOrder({ company: COMPANY, number, supplier, status: "received",
    lines: [{ description: "X", quantity: 1, unitPrice: 5000, vatRate: 20, receivedQuantity: 1 }], invoices });
  vi.spyOn(o, "save").mockImplementation(async function () { await this.validate(); return this; });
  return o;
};

describe("one supplier payment across several invoices and orders", () => {
  let A; let B; let byId;
  beforeEach(() => {
    vi.restoreAllMocks();
    A = mk("BC-A", [{ type: "invoice", number: "F-1", date: "2026-01-10", amountTTC: 1000 }, { type: "invoice", number: "F-2", date: "2026-02-10", amountTTC: 2000 }]);
    B = mk("BC-B", [{ type: "invoice", number: "F-3", date: "2026-03-10", amountTTC: 1500 }]);
    byId = new Map([[String(A._id), A], [String(B._id), B]]);
    vi.spyOn(PurchaseOrder, "findById").mockImplementation(async (id) => byId.get(String(id)) || null);
  });
  const pay = (allocations, extra = {}) => request(app()).post("/api/purchase-orders/supplier-payments")
    .send({ company: COMPANY, supplier: SUPPLIER, date: "2026-04-01", method: "virement", reference: "VIR-2026-0412", allocations, ...extra });

  it("one transfer settles F-2 (BC-A) and F-3 (BC-B): each order gets its part, linked to its invoice", async () => {
    const res = await pay([
      { orderId: A._id, invoiceId: A.invoices[1]._id, amount: 2000 },
      { orderId: B._id, invoiceId: B.invoices[0]._id, amount: 1500 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ total: 3500, invoices: 2, orders: 2, batchRef: "VIR-2026-0412" });
    expect(A.payments[0]).toMatchObject({ amount: 2000, method: "virement", batchRef: "VIR-2026-0412" });
    expect(String(A.payments[0].invoiceId)).toBe(String(A.invoices[1]._id));
    // F-2 is paid, F-1 (older) is untouched — the payment went where it was meant to
    const { allocateInvoices } = require("../services/purchaseOrderCalc");
    expect(allocateInvoices(A).map((r) => [r.invoice.number, r.status])).toEqual([["F-1", "unpaid"], ["F-2", "paid"]]);
    expect(B.paymentStatus).toBe("paid");
  });

  it("refuses paying more than an invoice's balance — and saves NOTHING", async () => {
    const res = await pay([
      { orderId: A._id, invoiceId: A.invoices[0]._id, amount: 500 },
      { orderId: B._id, invoiceId: B.invoices[0]._id, amount: 9999 },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/F-3: only 1500 left/);
    expect(A.payments).toHaveLength(0);
  });

  it("refuses an invoice of another supplier", async () => {
    const other = mk("BC-X", [{ type: "invoice", number: "F-9", date: "2026-01-01", amountTTC: 100 }], "507f1f77bcf86cd799439699");
    byId.set(String(other._id), other);
    const res = await pay([{ orderId: other._id, invoiceId: other.invoices[0]._id, amount: 100 }]);
    expect(res.status).toBe(400);
  });
});

describe("invoice with exact VAT breakdown", () => {
  let order;
  beforeEach(() => {
    vi.restoreAllMocks();
    order = mk("BC-V", []);
    order.status = "sent";
    vi.spyOn(PurchaseOrder, "findById").mockImplementation(() => { const q = Promise.resolve(order); q.populate = () => Promise.resolve(order); return q; });
    vi.spyOn(Supplier, "findById").mockReturnValue({ select: async () => ({ paymentDays: 60 }) });
  });
  const post = (breakdown, amount) => {
    let r = request(app()).post(`/api/purchase-orders/${order._id}/invoices`).field("number", "F-77").field("date", "2026-05-01")
      .field("vatBreakdown", JSON.stringify(breakdown));
    if (amount !== undefined) r = r.field("amountTTC", String(amount));
    return r;
  };

  it("stores the per-rate lines; the total can be computed from them", async () => {
    const res = await post([{ rate: 20, baseHT: 1000, vat: 200 }, { rate: 10, baseHT: 500, vat: 50 }]);
    expect(res.status).toBe(201);
    expect(order.invoices[0].amountTTC).toBe(1750);
    expect(order.invoices[0].vatBreakdown.map((r) => r.rate)).toEqual([20, 10]);
  });

  it("refuses lines that don't add up to the total, and duplicate rates", async () => {
    expect((await post([{ rate: 20, baseHT: 1000, vat: 200 }], 1300)).body.message).toMatch(/add up to 1200/);
    expect((await post([{ rate: 20, baseHT: 1, vat: 0.2 }, { rate: 20, baseHT: 2, vat: 0.4 }])).status).toBe(400);
  });
});
