import { describe, it, expect, vi, beforeEach } from "vitest";
const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = currentUser; next(); } };
const notifPath = require.resolve("../services/notificationService");
const notified = [];
require.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: {
  notify: vi.fn(async (id, p) => notified.push({ ids: [String(id)], ...p })), notifyMany: vi.fn(async (ids, p) => notified.push({ ids, ...p })),
  getProductionRecipientIds: vi.fn(async () => []), getPurchasingRecipientIds: vi.fn(async () => ["buyer"]), getHRRecipientIds: vi.fn(async () => []) } };
const auditPath = require.resolve("../services/auditLogger");
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { logAudit: vi.fn() } };

const PurchaseOrder = require("../models/PurchaseOrder");
const PriceRequest = require("../models/PriceRequest");
const Company = require("../models/Company");
const Department = require("../models/Department");
const User = require("../models/User");
const EmailOutbox = require("../models/EmailOutbox");
const ordersRouter = require("./purchaseOrders");
const priceRouter = require("./priceRequests");
const { checkLateDeliveries, checkMissingInvoices } = require("../services/purchasingScheduledChecks");

const ID = "507f1f77bcf86cd799439401";
const COMPANY = "507f1f77bcf86cd799439201";
const OWNER = "507f1f77bcf86cd799439111";
const BUYER = { id: "507f1f77bcf86cd799439102", role: "user", department: "purchasing", managedDepartments: [] };
const MANAGER = { id: "507f1f77bcf86cd799439103", role: "user", department: "purchasing", managedDepartments: ["507f1f77bcf86cd799439701"] };
const app = () => { const a = express(); a.use(express.json()); a.use("/api/purchase-orders", ordersRouter); a.use("/api/price-requests", priceRouter); return a; };

let order; let company;
function mockOrder(status = "draft", unitPrice = 1000) {
  order = new PurchaseOrder({ _id: ID, company: COMPANY, number: "BC-2026-0020", supplier: "507f1f77bcf86cd799439601", status,
    lines: [{ description: "Compresseur", quantity: 10, unitPrice, vatRate: 20 }] }); // 12 000 TTC at 1000
  vi.spyOn(order, "save").mockImplementation(async function save() { await this.validate(); return this; });
  vi.spyOn(PurchaseOrder, "findById").mockImplementation(() => {
    const q = Promise.resolve(order); q.populate = () => q; return q;
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  notified.length = 0;
  company = { _id: COMPANY, owner: OWNER, name: "Atlas", settings: { purchaseApprovalThreshold: 10000 } };
  vi.spyOn(Company, "findById").mockImplementation(() => { const q = Promise.resolve(company); q.select = () => Promise.resolve(company); return q; });
  vi.spyOn(User, "find").mockReturnValue({ select: () => ({ lean: async () => [] }) });
  vi.spyOn(Department, "find").mockReturnValue({ select: () => ({ lean: async () => [] }) });
});

describe("purchase order approval above a threshold", () => {
  it("over the threshold: 'mark as ordered' asks for approval instead, approvers notified", async () => {
    mockOrder();
    currentUser = BUYER;
    const res = await request(app()).patch(`/api/purchase-orders/${ID}/status`).send({ status: "sent" });
    expect(res.body.message).toBe("approval_requested");
    expect(order.status).toBe("pending_approval");
    expect(notified[0].ids).toContain(OWNER);
  });

  it("under the threshold: ordered directly", async () => {
    mockOrder("draft", 100); // 1 200 TTC
    currentUser = BUYER;
    await request(app()).patch(`/api/purchase-orders/${ID}/status`).send({ status: "sent" });
    expect(order.status).toBe("sent");
  });

  it("the purchasing manager approves -> ordered; the buyer is notified", async () => {
    mockOrder("pending_approval");
    order.approval = { requestedBy: BUYER.id, requestedAt: new Date() };
    vi.spyOn(Department, "exists").mockResolvedValue(true);
    currentUser = MANAGER;
    const res = await request(app()).patch(`/api/purchase-orders/${ID}/approve`);
    expect(res.status).toBe(200);
    expect(order.status).toBe("sent");
    expect(order.approval.approvedAmount).toBe(12000);
    expect(notified.at(-1).ids).toEqual([BUYER.id]);
  });

  it("SECURITY: a plain buyer can't approve; nobody (but admin/owner) approves their own order", async () => {
    mockOrder("pending_approval");
    order.approval = { requestedBy: MANAGER.id };
    vi.spyOn(Department, "exists").mockResolvedValue(false);
    currentUser = BUYER;
    expect((await request(app()).patch(`/api/purchase-orders/${ID}/approve`)).status).toBe(403);
    vi.spyOn(Department, "exists").mockResolvedValue(true);
    currentUser = MANAGER;
    expect((await request(app()).patch(`/api/purchase-orders/${ID}/approve`)).status).toBe(403);
    expect(order.status).toBe("pending_approval");
  });

  it("refusing needs a reason and sends it back to draft", async () => {
    mockOrder("pending_approval");
    order.approval = { requestedBy: BUYER.id };
    currentUser = { id: OWNER, role: "owner" };
    const noReason = await request(app()).patch(`/api/purchase-orders/${ID}/reject-approval`).send({});
    expect(noReason.status).toBe(400);
    await request(app()).patch(`/api/purchase-orders/${ID}/reject-approval`).send({ reason: "Trop cher, renégocier" });
    expect(order.status).toBe("draft");
    expect(order.approval.rejectReason).toBe("Trop cher, renégocier");
  });

  it("LOOPHOLE: an approved order edited to a higher amount needs approval again", async () => {
    mockOrder("sent");
    order.approval = { approvedAt: new Date(), approvedAmount: 12000 };
    currentUser = BUYER;
    const res = await request(app()).put(`/api/purchase-orders/${ID}`).send({ lines: [{ description: "Compresseur", quantity: 20, unitPrice: 1000, vatRate: 20 }] });
    expect(res.body.message).toBe("approval_requested");
    expect(order.status).toBe("pending_approval");
  });
});

describe("emailing documents (placeholder mode, no SMTP)", () => {
  it("a draft can't be sent; an ordered BC is 'sent' to the outbox as simulated", async () => {
    delete process.env.SMTP_HOST;
    const outbox = [];
    vi.spyOn(EmailOutbox, "create").mockImplementation(async (d) => { outbox.push(d); return { _id: "o1", ...d }; });
    mockOrder("draft");
    currentUser = BUYER;
    expect((await request(app()).post(`/api/purchase-orders/${ID}/email`).send({ to: "contact@acierplus.ma" })).status).toBe(400);
    mockOrder("sent");
    company = { ...company, address: { city: "Casablanca" } };
    const res = await request(app()).post(`/api/purchase-orders/${ID}/email`).send({ to: "contact@acierplus.ma" });
    expect(res.status).toBe(200);
    expect(res.body.simulated).toBe(true);
    expect(outbox[0]).toMatchObject({ to: "contact@acierplus.ma", status: "simulated", attachments: [{ filename: "BC-2026-0020.pdf" }] });
    expect(outbox[0].attachments[0].size).toBeGreaterThan(1000); // a real PDF was built
    expect(order.emails[0]).toMatchObject({ to: "contact@acierplus.ma", simulated: true });
  });

  it("rejects an invalid address", async () => {
    mockOrder("sent");
    currentUser = BUYER;
    expect((await request(app()).post(`/api/purchase-orders/${ID}/email`).send({ to: "not-an-email" })).status).toBe(400);
  });
});

describe("late delivery alert", () => {
  it("alerts the purchasing team once per late order", async () => {
    const late = { number: "BC-9", company: COMPANY, expectedDate: new Date("2026-01-01"), supplier: { name: "AcierPlus" }, lateNotifiedAt: null, save: vi.fn() };
    vi.spyOn(PurchaseOrder, "find").mockReturnValue({ populate: async () => [late] });
    expect(await checkLateDeliveries(new Date("2026-02-01"))).toBe(1);
    expect(late.lateNotifiedAt).toBeInstanceOf(Date);
    expect(notified.at(-1)).toMatchObject({ ids: ["buyer"], title: "Late delivery" });
  });
});

describe("quote comparison across suppliers", () => {
  it("shows each supplier's price per line and the cheapest complete offer", async () => {
    const mk = (id, name, prices) => ({ _id: id, number: `DP-${id}`, status: "answered", supplier: { name },
      lines: prices.map((p, i) => ({ description: `L${i}`, quantity: 10, vatRate: 20, quotedUnitPrice: p })) });
    const docs = [mk("a", "AcierPlus", [12.5, 30]), mk("b", "MetalSud", [11.9, 32]), mk("c", "Incomplet", [10, null])];
    vi.spyOn(PriceRequest, "find").mockReturnValue({ populate: () => ({ sort: async () => docs }) });
    currentUser = BUYER;
    const res = await request(app()).get("/api/price-requests/compare/CMP-x");
    expect(res.status).toBe(200);
    expect(res.body.data.lines[0].quotes.find((q) => q.best).supplier).toBe("Incomplet"); // cheapest on that line
    expect(res.body.data.cheapestId).toBe("a"); // 12.5*10+30*10=425 < 119+320=439 ; "c" incomplete excluded
  });
});

describe("missing supplier invoice alert", () => {
  it("goods received 7+ days ago with no invoice -> purchasing alerted once", async () => {
    const o = { number: "BC-7", company: COMPANY, supplier: { name: "AcierPlus" }, missingInvoiceNotifiedAt: null, save: vi.fn() };
    let query;
    vi.spyOn(PurchaseOrder, "find").mockImplementation((q) => { query = q; return { populate: async () => [o] }; });
    expect(await checkMissingInvoices(new Date("2026-03-20"))).toBe(1);
    expect(o.missingInvoiceNotifiedAt).toBeInstanceOf(Date);
    expect(notified.at(-1)).toMatchObject({ ids: ["buyer"], title: "Supplier invoice missing" });
    // only orders not alerted yet, received at least 7 days before "now"
    expect(query.missingInvoiceNotifiedAt).toBeNull();
    expect(query.receptions.$elemMatch.date.$lte.toISOString().slice(0, 10)).toBe("2026-03-13");
  });
});
