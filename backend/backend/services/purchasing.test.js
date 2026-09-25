import { describe, it, expect } from "vitest";
const calc = require("./purchaseOrderCalc");
const { planProcessAction, normalizeStatus } = require("./purchaseRequestWorkflow");

const order = (lines, status = "sent", extra = {}) => ({ status, lines: lines.map((l, i) => ({ _id: `L${i}`, description: `Item ${i}`, ...l })), ...extra });

describe("purchase order totals (HT / TVA / TTC)", () => {
  it("sums lines with their own VAT rate", () => {
    const t = calc.computeTotals([
      { quantity: 10, unitPrice: 12.5, vatRate: 20 }, // 125 HT, 25 TVA
      { quantity: 2, unitPrice: 100, vatRate: 10 },   // 200 HT, 20 TVA
    ]);
    expect(t).toEqual({ totalHT: 325, totalVAT: 45, totalTTC: 370 });
  });
});

describe("receptions and returns", () => {
  it("partial reception, then the rest -> partially_received, then received", () => {
    const o = order([{ quantity: 100, receivedQuantity: 0, returnedQuantity: 0 }]);
    expect(calc.validateReception(o, "reception", [{ lineId: "L0", quantity: 60 }])).toBeNull();
    calc.applyReceptionToLines(o, "reception", [{ lineId: "L0", quantity: 60 }]);
    expect(calc.deriveReceptionStatus(o)).toBe("partially_received");
    calc.applyReceptionToLines(o, "reception", [{ lineId: "L0", quantity: 40 }]);
    expect(calc.deriveReceptionStatus(o)).toBe("received");
  });

  it("refuses receiving more than is still expected", () => {
    const o = order([{ quantity: 100, receivedQuantity: 90, returnedQuantity: 0 }]);
    expect(calc.validateReception(o, "reception", [{ lineId: "L0", quantity: 11 }])).toMatch(/only 10 still expected/);
  });

  it("a return re-opens the quantity: 100 received, 20 returned -> 20 expected again", () => {
    const o = order([{ quantity: 100, receivedQuantity: 100, returnedQuantity: 0 }], "received");
    expect(calc.validateReception(o, "return", [{ lineId: "L0", quantity: 20 }])).toBeNull();
    calc.applyReceptionToLines(o, "return", [{ lineId: "L0", quantity: 20 }]);
    expect(calc.lineOutstanding(o.lines[0])).toBe(20);
    expect(calc.deriveReceptionStatus(o)).toBe("partially_received");
  });

  it("refuses returning more than was received and kept", () => {
    const o = order([{ quantity: 100, receivedQuantity: 30, returnedQuantity: 10 }], "partially_received");
    expect(calc.validateReception(o, "return", [{ lineId: "L0", quantity: 21 }])).toMatch(/only 20 received/);
  });

  it("refuses receiving a draft or cancelled order, unknown or duplicate lines, zero quantities", () => {
    expect(calc.validateReception(order([{ quantity: 5 }], "draft"), "reception", [{ lineId: "L0", quantity: 1 }])).toMatch(/sent/);
    expect(calc.validateReception(order([{ quantity: 5 }], "cancelled"), "reception", [{ lineId: "L0", quantity: 1 }])).toMatch(/sent/);
    const o = order([{ quantity: 5 }]);
    expect(calc.validateReception(o, "reception", [{ lineId: "nope", quantity: 1 }])).toMatch(/Unknown/);
    expect(calc.validateReception(o, "reception", [{ lineId: "L0", quantity: 1 }, { lineId: "L0", quantity: 1 }])).toMatch(/twice/);
    expect(calc.validateReception(o, "reception", [{ lineId: "L0", quantity: 0 }])).toMatch(/greater than zero/);
    expect(calc.validateReception(o, "reception", [])).toMatch(/at least one/);
  });

  it("multi-line order is only 'received' once EVERY line is complete", () => {
    const o = order([{ quantity: 10, receivedQuantity: 10 }, { quantity: 5, receivedQuantity: 0 }]);
    expect(calc.deriveReceptionStatus(o)).toBe("partially_received");
  });
});

describe("payment status", () => {
  it("unpaid -> partially_paid -> paid", () => {
    expect(calc.derivePaymentStatus({ totalTTC: 1200, payments: [] }).paymentStatus).toBe("unpaid");
    expect(calc.derivePaymentStatus({ totalTTC: 1200, payments: [{ amount: 500 }] })).toEqual({ amountPaid: 500, paymentStatus: "partially_paid" });
    expect(calc.derivePaymentStatus({ totalTTC: 1200, payments: [{ amount: 500 }, { amount: 700 }] }).paymentStatus).toBe("paid");
  });
});

describe("purchase request workflow (production asks, purchasing answers)", () => {
  it("declining requires a reason; delaying requires an explanation", () => {
    expect(planProcessAction("pending", "declined", "  ").error).toMatch(/reason/);
    expect(planProcessAction("pending", "declined", "Article discontinued").set).toEqual({ status: "declined", declineReason: "Article discontinued" });
    expect(planProcessAction("pending", "delayed", "").error).toMatch(/why/);
    expect(planProcessAction("pending", "delayed", "Supplier out of stock until the 15th").set.status).toBe("delayed");
  });

  it("a delayed request can still be ordered or declined", () => {
    expect(planProcessAction("delayed", "ordered").status).toBe("ordered");
    expect(planProcessAction("delayed", "declined", "Budget").status).toBe("declined");
  });

  it("an ordered/received request can't be declined or delayed anymore", () => {
    expect(planProcessAction("ordered", "declined", "x").error).toBeTruthy();
    expect(planProcessAction("received", "delayed", "x").error).toBeTruthy();
    expect(planProcessAction("approved", "declined", "x").error).toBeTruthy(); // legacy "approved" = ordered
  });

  it("a note can be added at any stage without changing the status", () => {
    const plan = planProcessAction("ordered", "note", "Delivery moved to Monday");
    expect(plan.status).toBe("ordered");
    expect(plan.set).toEqual({ purchasingNote: "Delivery moved to Monday" });
  });

  it("legacy statuses read as their new equivalents", () => {
    expect(normalizeStatus("approved")).toBe("ordered");
    expect(normalizeStatus("rejected")).toBe("declined");
  });
});
