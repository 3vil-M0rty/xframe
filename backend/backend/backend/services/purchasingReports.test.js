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

describe("exact VAT per invoice (mixed rates)", () => {
  // goods 1 000 HT at 20% + transport 500 HT at 10% = 1 200 + 550 = 1 750 TTC
  const mixed = (extra = {}) => order({
    lines: [
      { description: "Tôle", quantity: 100, unitPrice: 10, vatRate: 20, product: { category: { accountingAccount: "6121" } } },
      { description: "Transport", quantity: 1, unitPrice: 500, vatRate: 10 },
    ],
    totalHT: 1500, totalVAT: 250, totalTTC: 1750,
    invoices: [{ _id: "i1", type: "invoice", number: "F-9", date: "2026-05-02", amountTTC: 1750,
      vatBreakdown: [{ rate: 20, baseHT: 1000, vat: 200 }, { rate: 10, baseHT: 500, vat: 50 }] }],
    payments: [{ date: "2026-05-10", amount: 1750, method: "virement" }],
    ...extra,
  });

  it("the TVA listing has one row per rate with the invoice's exact amounts", () => {
    const rows = R.vatDeductionRows([mixed()]);
    expect(rows.map((r) => [r.vatRate, r.amountHT, r.vatAmount, r.exactVat])).toEqual([[20, 1000, 200, true], [10, 500, 50, true]]);
  });

  it("a partial payment is shared across the rates in proportion (and stays exact to the cent)", () => {
    const rows = R.vatDeductionRows([mixed({ payments: [{ date: "2026-05-10", amount: 875, method: "virement" }] })]);
    expect(rows.map((r) => [r.vatRate, r.amountHT, r.vatAmount])).toEqual([[20, 500, 100], [10, 250, 25]]);
    expect(Math.round(rows.reduce((s, r) => s + r.amountTTC, 0) * 100) / 100).toBe(875);
  });

  it("the old proportional estimate would have been wrong here (why this matters)", () => {
    const old = R.vatDeductionRows([mixed({ invoices: [{ _id: "i1", type: "invoice", number: "F-9", date: "2026-05-02", amountTTC: 1750 }] })]);
    expect(old).toHaveLength(1);
    expect(old[0].exactVat).toBe(false); // flagged as estimated, single main rate
  });

  it("accounting: goods to the category's account 6121, transport to the default; VAT per rate; balanced", () => {
    const entries = R.accountingEntries([mixed({ payments: [] })], { accounts: { purchases: "6125" } });
    const debit = (acc) => entries.filter((e) => e.account === acc).reduce((s, e) => s + e.debit, 0);
    expect(debit("6121")).toBe(1000);
    expect(debit("6125")).toBe(500);
    expect(debit("34552")).toBe(250);
    const d = entries.reduce((s, e) => s + e.debit, 0);
    const c = entries.reduce((s, e) => s + e.credit, 0);
    expect(Math.round(d * 100)).toBe(Math.round(c * 100));
  });

  it("a fixed-asset category books its VAT on 34551", () => {
    const o = order({
      lines: [{ description: "Compresseur", quantity: 1, unitPrice: 10000, vatRate: 20, product: { category: { accountingAccount: "2332", isFixedAsset: true } } }],
      totalHT: 10000, totalVAT: 2000, totalTTC: 12000,
      invoices: [{ type: "invoice", number: "F-IM", date: "2026-05-02", amountTTC: 12000, vatBreakdown: [{ rate: 20, baseHT: 10000, vat: 2000 }] }],
    });
    const entries = R.accountingEntries([o]);
    expect(entries.find((e) => e.account === "2332").debit).toBe(10000);
    expect(entries.find((e) => e.account === "34551").debit).toBe(2000);
    expect(entries.some((e) => e.account === "34552")).toBe(false);
  });
});

describe("payments tied to a specific invoice", () => {
  const C = require("./purchaseOrderCalc");
  const two = (payments) => ({
    invoices: [
      { _id: "old", type: "invoice", number: "F-OLD", date: "2026-01-01", amountTTC: 1000 },
      { _id: "new", type: "invoice", number: "F-NEW", date: "2026-03-01", amountTTC: 500 },
    ],
    payments,
  });

  it("without a target, the oldest invoice is settled first", () => {
    const rows = C.allocateInvoices(two([{ date: "2026-04-01", amount: 500 }]));
    expect(rows.map((r) => [r.invoice.number, r.status])).toEqual([["F-OLD", "partially_paid"], ["F-NEW", "unpaid"]]);
  });

  it("a payment naming its invoice settles THAT invoice", () => {
    const rows = C.allocateInvoices(two([{ date: "2026-04-01", amount: 500, invoiceId: "new" }]));
    expect(rows.map((r) => [r.invoice.number, r.status])).toEqual([["F-OLD", "unpaid"], ["F-NEW", "paid"]]);
  });

  it("the excess of a targeted payment spills to the other invoices", () => {
    const rows = C.allocateInvoices(two([{ date: "2026-04-01", amount: 700, invoiceId: "new" }]));
    expect(rows.find((r) => r.invoice.number === "F-OLD").paid).toBe(200);
  });
});
