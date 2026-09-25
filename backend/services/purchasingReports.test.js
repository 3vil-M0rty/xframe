import { describe, it, expect } from "vitest";
const R = require("./purchasingReports");

// 1 000 HT at 20% = 1 200 TTC
const order = (extra = {}) => ({
  number: "BC-2026-0001", status: "received",
  supplier: { _id: "s1", name: "AcierPlus", identifiantFiscal: "33445566", ice: "002233445000067" },
  lines: [{ description: "Tôle acier", quantity: 100, unitPrice: 10, vatRate: 20 }],
  totalHT: 1000, totalVAT: 200, totalTTC: 1200,
  invoices: [{ type: "invoice", number: "F-1", date: "2026-03-01", dueDate: "2026-04-30", amountTTC: 1200 }],
  payments: [],
  ...extra,
});

describe("TVA deduction listing", () => {
  it("one row per payment applied to an invoice, with the VAT portion", () => {
    const rows = R.vatDeductionRows([order({ payments: [{ date: "2026-04-10", amount: 600, method: "virement", reference: "VIR-1" }, { date: "2026-05-05", amount: 600, method: "cheque" }] })]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ supplierIF: "33445566", supplierICE: "002233445000067", invoiceNumber: "F-1", amountTTC: 600, amountHT: 500, vatAmount: 100, vatRate: 20, paymentMethod: "virement" });
  });

  it("filters by PAYMENT date (deduction follows payment)", () => {
    const rows = R.vatDeductionRows([order({ payments: [{ date: "2026-04-10", amount: 600, method: "virement" }, { date: "2026-05-05", amount: 600, method: "cheque" }] })], { from: "2026-05-01", to: "2026-05-31" });
    expect(rows).toHaveLength(1);
    expect(rows[0].paymentMethod).toBe("cheque");
  });

  it("cancelled orders never appear", () => {
    expect(R.vatDeductionRows([order({ status: "cancelled", payments: [{ date: "2026-04-10", amount: 1200, method: "virement" }] })])).toHaveLength(0);
  });
});

describe("accounting journal", () => {
  const entries = R.accountingEntries([order({ payments: [{ date: "2026-04-10", amount: 1200, method: "virement" }] })]);

  it("invoice: 6111 HT + 34552 VAT against 4411 TTC; payment: 4411 against bank 5141", () => {
    const acc = (a) => entries.filter((e) => e.account === a);
    expect(acc("6111")[0].debit).toBe(1000);
    expect(acc("34552")[0].debit).toBe(200);
    expect(acc("4411").map((e) => [e.debit, e.credit])).toEqual([[0, 1200], [1200, 0]]);
    expect(acc("5141")[0].credit).toBe(1200);
  });

  it("every journal balances: total debits = total credits", () => {
    const withCredit = R.accountingEntries([order({ invoices: [...order().invoices, { type: "credit_note", number: "AV-1", date: "2026-03-05", amountTTC: 120 }], payments: [{ date: "2026-04-10", amount: 1080, method: "especes" }] })]);
    const debit = withCredit.reduce((s, e) => s + e.debit, 0);
    const credit = withCredit.reduce((s, e) => s + e.credit, 0);
    expect(Math.round(debit * 100)).toBe(Math.round(credit * 100));
    expect(withCredit.some((e) => e.account === "5161" && e.journal === "CAI")).toBe(true); // cash -> caisse
  });
});

describe("aged balance", () => {
  it("puts what's owed in the right lateness bucket", () => {
    const now = new Date("2026-06-15");
    const rows = R.agedBalance([order(), order({ number: "BC-2", invoices: [{ type: "invoice", number: "F-2", date: "2026-06-01", dueDate: "2026-07-31", amountTTC: 500 }] })], now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ supplierName: "AcierPlus", total: 1700, notDue: 500, d31_60: 1200 }); // F-1 due 30/04 -> 46 days late
  });
});

describe("supplier statement", () => {
  it("running balance: invoices add, credit notes and payments subtract; opening balance before 'from'", () => {
    const s = R.supplierStatement([order({ payments: [{ date: "2026-04-10", amount: 700, method: "virement" }] })], { from: "2026-04-01" });
    expect(s.openingBalance).toBe(1200); // the March invoice
    expect(s.rows.map((r) => r.balance)).toEqual([500]);
    expect(s.closingBalance).toBe(500);
  });
});

describe("restocking suggestions", () => {
  const products = [
    { _id: "p1", name: "Tôle", quantity: 40, threshold: 100, prices: [{ supplierName: "AcierPlus", price: 12.5 }, { supplierName: "MetalSud", price: 11.9 }] },
    { _id: "p2", name: "Gants", quantity: 500, threshold: 50, prices: [] },
  ];

  it("suggests up to 2× the minimum, minus what's already on order, from the cheapest supplier", () => {
    const groups = R.restockSuggestions(products, [{ status: "sent", lines: [{ product: "p1", quantity: 60, receivedQuantity: 0 }] }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].supplierName).toBe("MetalSud");
    expect(groups[0].items[0]).toMatchObject({ name: "Tôle", incoming: 60, suggestedQuantity: 100 }); // 200 - 40 - 60
  });

  it("nothing to suggest once enough is already coming", () => {
    expect(R.restockSuggestions(products, [{ status: "sent", lines: [{ product: "p1", quantity: 200, receivedQuantity: 0 }] }])).toHaveLength(0);
  });
});

describe("period filter accepts both date forms", () => {
  it("REGRESSION: a Date object as `to` includes that whole day (it used to match nothing)", () => {
    const o = order({ payments: [{ date: new Date(2026, 4, 5, 15, 30), amount: 1200, method: "virement" }] });
    const asString = R.vatDeductionRows([o], { from: "2026-05-01", to: "2026-05-05" });
    const asDate = R.vatDeductionRows([o], { from: new Date(2026, 4, 1), to: new Date(2026, 4, 5) });
    expect(asString).toHaveLength(1);
    expect(asDate).toHaveLength(1);
  });
});

describe("payments without an invoice (why the TVA listing can look empty)", () => {
  it("a payment on an order with no invoice is listed as 'no_invoice', not silently dropped", () => {
    const o = order({ invoices: [], payments: [{ date: "2026-05-05", amount: 1200, method: "virement", reference: "VIR-9" }] });
    expect(R.vatDeductionRows([o], { from: "2026-05-01", to: "2026-05-31" })).toHaveLength(0);
    const missing = R.paymentsWithoutInvoice([o], { from: "2026-05-01", to: "2026-05-31" });
    expect(missing).toEqual([expect.objectContaining({ orderNumber: "BC-2026-0001", amount: 1200, reason: "no_invoice", paymentReference: "VIR-9" })]);
  });

  it("only the part paid BEYOND the invoices is reported, as 'overpaid'", () => {
    const o = order({ payments: [{ date: "2026-05-05", amount: 1500, method: "virement" }] }); // invoice 1 200
    expect(R.paymentsWithoutInvoice([o])).toEqual([expect.objectContaining({ amount: 300, reason: "overpaid" })]);
  });

  it("nothing reported when payments are fully covered by invoices", () => {
    expect(R.paymentsWithoutInvoice([order({ payments: [{ date: "2026-05-05", amount: 1200, method: "cheque" }] })])).toHaveLength(0);
  });
});
