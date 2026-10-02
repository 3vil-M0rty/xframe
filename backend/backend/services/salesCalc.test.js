import { describe, it, expect } from "vitest";
const {
  computeLineTotals, computeInvoiceTotals, depositLines, sumDeposits, paymentStatus, receivables, vatCollected, lineHT,
} = require("./salesCalc");
const { projectFinancials, progressFromTasks, hourlyCostFromSalary } = require("./projectCosts");

const quote = {
  number: "DV-2026-0001",
  lines: [
    { description: "Structure", quantity: 2, unitPrice: 1000, discount: 10, vatRate: 20 }, // 1 800
    { description: "Pose", quantity: 1, unitPrice: 500, vatRate: 14 }, // 500
  ],
};

describe("devis / invoice totals", () => {
  it("line discount, VAT per rate on the rate's total", () => {
    expect(lineHT(quote.lines[0])).toBe(1800);
    expect(computeLineTotals(quote.lines)).toEqual({ totalHT: 2300, totalVAT: 430, totalTTC: 2730 });
  });

  it("deposit: one line per VAT rate, same VAT as the devis", () => {
    const lines = depositLines(quote, 30);
    expect(lines.map((l) => [l.unitPrice, l.vatRate])).toEqual([[540, 20], [150, 14]]);
    expect(() => depositLines(quote, 0)).toThrow();
  });

  it("final invoice deducts issued deposits per rate", () => {
    const deposit = { vatBreakdown: computeInvoiceTotals({ lines: depositLines(quote, 30) }).vatBreakdown };
    const final = computeInvoiceTotals({ lines: quote.lines, depositBreakdown: sumDeposits([deposit]) });
    expect(final.depositsDeductedHT).toBe(690);
    expect(final.totalHT).toBe(1610);
    expect(final.totalTTC).toBe(Math.round((2730 - 690 * 1 - (108 + 21)) * 100) / 100);
    expect(final.vatBreakdown).toEqual([{ rate: 20, baseHT: 1260, vat: 252 }, { rate: 14, baseHT: 350, vat: 49 }]);
  });

  it("payment status", () => {
    expect(paymentStatus({ totalTTC: 100, payments: [] })).toBe("issued");
    expect(paymentStatus({ totalTTC: 100, payments: [{ amount: 40 }] })).toBe("partially_paid");
    expect(paymentStatus({ totalTTC: 100, payments: [{ amount: 60 }, { amount: 40 }] })).toBe("paid");
  });
});

describe("receivables & VAT collected", () => {
  const now = new Date("2026-09-30");
  const inv = (o) => ({ status: "issued", type: "invoice", amountPaid: 0, payments: [], ...o });
  const invoices = [
    inv({ customer: "a", totalTTC: 1200, dueDate: new Date("2026-10-15"), vatBreakdown: [{ rate: 20, baseHT: 1000, vat: 200 }], date: new Date("2026-09-01") }),
    inv({ customer: "a", totalTTC: 600, amountPaid: 100, status: "partially_paid", dueDate: new Date("2026-08-15"), vatBreakdown: [{ rate: 20, baseHT: 500, vat: 100 }], payments: [{ date: new Date("2026-09-10"), amount: 100 }], date: new Date("2026-07-01") }),
    inv({ customer: "a", type: "credit_note", totalTTC: 120, vatBreakdown: [{ rate: 20, baseHT: 100, vat: 20 }], date: new Date("2026-09-20") }),
  ];

  it("ages what's due and deducts unused credit notes", () => {
    const r = receivables(invoices, now);
    expect(r.totals).toMatchObject({ notDue: 1200, d31_60: 500, credits: 120, total: 1580 });
  });

  it("VAT on payments received vs on invoices issued", () => {
    const v = vatCollected(invoices, new Date("2026-09-01"), new Date("2026-09-30T23:59:59"));
    expect(v.onPayments.totalVAT).toBe(16.67); // 100 TTC at 20%
    expect(v.onInvoices.totalVAT).toBe(200 - 20);
  });
});

describe("project costs", () => {
  it("hourly cost = employer monthly cost / 191 h", () => {
    const h = hourlyCostFromSalary({ baseSalary: 6000 });
    expect(h).toBeGreaterThan(6000 / 191);
    expect(h).toBeLessThan((6000 * 1.3) / 191);
  });

  it("progress weighted by estimated hours", () => {
    expect(progressFromTasks([{ status: "done", estimatedHours: 30 }, { status: "todo", estimatedHours: 10 }])).toBe(75);
    expect(progressFromTasks([{ status: "done" }, { status: "todo" }])).toBe(50);
  });

  it("actual cost, invoiced and margin", () => {
    const f = projectFinancials({
      project: { budget: { revenue: 10000, materials: 3000, labour: 2000 }, expenses: [{ amount: 500 }] },
      movements: [{ type: "out", quantity: 10, unitCost: 100 }, { type: "in", quantity: 2, unitCost: 100 }],
      purchaseOrders: [{ status: "received", lines: [{ quantity: 1, unitPrice: 1500 }] }, { status: "draft", lines: [{ quantity: 1, unitPrice: 999 }] }],
      timeEntries: [{ hours: 10, cost: 400 }],
      invoices: [{ type: "deposit", status: "paid", totalHT: 3000, amountPaid: 3600 }, { type: "credit_note", status: "issued", totalHT: 500 }],
      tasks: [],
    });
    expect(f.actual).toMatchObject({ materials: 800, purchases: 1500, labour: 400, other: 500, total: 3200, hours: 10 });
    expect(f.invoiced).toBe(2500);
    expect(f.actualMargin).toEqual({ amount: 6800, percent: 68 });
    expect(f.overBudget).toBe(false);
  });
});
