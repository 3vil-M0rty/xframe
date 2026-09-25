import { describe, it, expect } from "vitest";
const calc = require("./purchaseOrderCalc");

const line = (o) => ({ _id: "L0", description: "Gants", unitPrice: 100, vatRate: 20, receivedQuantity: 0, returnedQuantity: 0, ...o });

describe("closing a line short (70 ordered, 69 delivered — accepted as complete)", () => {
  it("a closed line has nothing outstanding, so the order becomes received", () => {
    const order = { status: "partially_received", lines: [line({ quantity: 70, receivedQuantity: 69 })] };
    expect(calc.deriveReceptionStatus(order)).toBe("partially_received");
    order.lines[0].closed = true;
    expect(calc.lineOutstanding(order.lines[0])).toBe(0);
    expect(calc.deriveReceptionStatus(order)).toBe("received");
  });

  it("a closed line refuses further receptions (reopen it first) but still accepts returns", () => {
    const order = { status: "received", lines: [line({ quantity: 70, receivedQuantity: 69, closed: true })] };
    expect(calc.validateReception(order, "reception", [{ lineId: "L0", quantity: 1 }])).toMatch(/closed/);
    expect(calc.validateReception(order, "return", [{ lineId: "L0", quantity: 1 }])).toBeNull();
  });

  it("the supplier should invoice what was KEPT: 69 × 120 TTC = 8 280, not 8 400", () => {
    const order = { totalTTC: 8400, lines: [line({ quantity: 70, receivedQuantity: 69, closed: true })], invoices: [], payments: [] };
    expect(calc.matchOrder(order)).toMatchObject({ orderedTTC: 8400, receivedTTC: 8280, status: "not_invoiced" });
  });

  it("paid at the invoiced amount = fully paid, even though it's less than the order total", () => {
    const order = { totalTTC: 8400, lines: [], invoices: [{ type: "invoice", amountTTC: 8280 }], payments: [{ amount: 8280 }] };
    expect(calc.derivePaymentStatus(order)).toMatchObject({ paymentStatus: "paid", amountDue: 0 });
  });
});

describe("three-way matching (order / reception / invoice)", () => {
  const base = (invoices) => ({ totalTTC: 12000, lines: [line({ quantity: 100, receivedQuantity: 100 })], invoices, payments: [] });

  it("invoice = received value -> matched (within 1 MAD rounding)", () => {
    expect(calc.matchOrder(base([{ type: "invoice", amountTTC: 12000.4 }])).status).toBe("matched");
  });
  it("billed for more than received -> over_invoiced, with the gap", () => {
    const m = calc.matchOrder({ ...base([{ type: "invoice", amountTTC: 12000 }]), lines: [line({ quantity: 100, receivedQuantity: 90 })] });
    expect(m.status).toBe("over_invoiced");
    expect(m.gap).toBe(1200);
  });
  it("a return expects a credit note until one is recorded", () => {
    const withReturn = { ...base([{ type: "invoice", amountTTC: 12000 }]), lines: [line({ quantity: 100, receivedQuantity: 100, returnedQuantity: 10 })] };
    expect(calc.matchOrder(withReturn).creditExpected).toBe(1200);
    withReturn.invoices.push({ type: "credit_note", amountTTC: 1200 });
    const m = calc.matchOrder(withReturn);
    expect(m.creditExpected).toBe(0);
    expect(m.invoicedNetTTC).toBe(10800);
    expect(m.status).toBe("matched");
  });
});

describe("invoices: oldest first allocation, overdue, Loi 69-21 terms", () => {
  const now = new Date("2026-06-30");
  const order = {
    invoices: [
      { type: "invoice", number: "F2", amountTTC: 500, date: "2026-05-10", dueDate: "2026-07-09" },
      { type: "invoice", number: "F1", amountTTC: 1000, date: "2026-04-01", dueDate: "2026-05-31" },
    ],
    payments: [{ amount: 1200 }],
  };

  it("payments go to the oldest invoice first", () => {
    const rows = calc.allocateInvoices(order, now);
    expect(rows.map((r) => [r.invoice.number, r.paid, r.status])).toEqual([["F1", 1000, "paid"], ["F2", 200, "partially_paid"]]);
  });

  it("an unpaid invoice past its due date is overdue, with the days late", () => {
    const rows = calc.allocateInvoices({ ...order, payments: [] }, now);
    expect(rows[0]).toMatchObject({ overdue: true, daysOverdue: 30 });
    expect(rows[1].overdue).toBe(false);
  });

  it("flags payment terms beyond 60 days (written agreement needed) and beyond 120 (legal max)", () => {
    const term = (days) => calc.allocateInvoices({ invoices: [{ type: "invoice", amountTTC: 1, date: "2026-01-01", dueDate: new Date(Date.parse("2026-01-01") + days * 864e5) }], payments: [] }, now)[0].legal;
    expect(term(60)).toBe("ok");
    expect(term(90)).toBe("needs_agreement");
    expect(term(150)).toBe("over_max");
  });

  it("credit notes count toward settling invoices", () => {
    const rows = calc.allocateInvoices({ invoices: [{ type: "invoice", amountTTC: 1000, date: "2026-01-01" }, { type: "credit_note", amountTTC: 1000, date: "2026-01-05" }], payments: [] }, now);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("paid");
  });
});
