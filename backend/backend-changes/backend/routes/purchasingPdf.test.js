import { describe, it, expect, vi, beforeEach } from "vitest";
const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = currentUser; next(); } };

const PurchaseOrder = require("../models/PurchaseOrder");
const PriceRequest = require("../models/PriceRequest");
const Company = require("../models/Company");
const ordersRouter = require("./purchaseOrders");
const priceRouter = require("./priceRequests");

const ID = "507f1f77bcf86cd799439401";
const BUYER = { id: "b", role: "user", department: "purchasing" };
const company = { _id: "c1", name: "Atlas Industries", address: { city: "Casablanca" } }; // no logo -> no network call
const supplier = { name: "AcierPlus", paymentTerms: "30 jours" };
const lines = [{ description: "Tôle acier 2mm", quantity: 200, unit: "kg", unitPrice: 12.5, vatRate: 20, product: null }];

const app = () => { const a = express(); a.use("/api/purchase-orders", ordersRouter); a.use("/api/price-requests", priceRouter); return a; };
const chain = (doc) => { const q = { populate: () => q, then: (r, j) => Promise.resolve(doc).then(r, j) }; return q; };
const binary = (r) => r.buffer(true).parse((res, cb) => { const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => cb(null, Buffer.concat(c))); });

describe("purchasing PDFs", () => {
  beforeEach(() => { vi.restoreAllMocks(); currentUser = BUYER; vi.spyOn(Company, "findById").mockResolvedValue(company); });

  it("streams the bon de commande as a real PDF", async () => {
    vi.spyOn(PurchaseOrder, "findById").mockReturnValue(chain({ company: "c1", number: "BC-2026-0007", date: new Date(), status: "sent", supplier, lines, totalHT: 2500, totalTTC: 3000 }));
    const res = await binary(request(app()).get(`/api/purchase-orders/${ID}/pdf`));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("streams the demande de prix as a real PDF", async () => {
    vi.spyOn(PriceRequest, "findById").mockReturnValue(chain({ company: "c1", number: "DP-2026-0003", date: new Date(), supplier, lines }));
    const res = await binary(request(app()).get(`/api/price-requests/${ID}/pdf`));
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("404 for an unknown order; outsiders are refused", async () => {
    vi.spyOn(PurchaseOrder, "findById").mockReturnValue(chain(null));
    expect((await request(app()).get(`/api/purchase-orders/${ID}/pdf`)).status).toBe(404);
    currentUser = { id: "e", role: "user" };
    expect((await request(app()).get(`/api/purchase-orders/${ID}/pdf`)).status).toBe(403);
  });
});
