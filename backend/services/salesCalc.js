/**
 * ============================================================
 * SALES RULES (pure — no database)
 * ============================================================
 * Devis and invoice totals, deposits (acomptes), payment status,
 * receivables ageing and VAT collected. Amounts are rounded to the
 * centime; VAT is computed per rate on the HT total of that rate
 * (the way it's printed on the document), not line by line.
 * ============================================================
 */

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

function lineHT(line) {
  const gross = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
  return gross * (1 - (Number(line.discount) || 0) / 100);
}

/** VAT per rate from lines: [{ rate, baseHT, vat }] sorted by rate desc. */
function vatBreakdown(lines = []) {
  const byRate = new Map();
  for (const line of lines) {
    const rate = Number(line.vatRate) || 0;
    byRate.set(rate, (byRate.get(rate) || 0) + lineHT(line));
  }
  return [...byRate.entries()]
    .map(([rate, base]) => ({ rate, baseHT: round2(base), vat: round2(base * (rate / 100)) }))
    .sort((a, b) => b.rate - a.rate);
}

function computeLineTotals(lines = []) {
  const breakdown = vatBreakdown(lines);
  const totalHT = round2(breakdown.reduce((s, r) => s + r.baseHT, 0));
  const totalVAT = round2(breakdown.reduce((s, r) => s + r.vat, 0));
  return { totalHT, totalVAT, totalTTC: round2(totalHT + totalVAT) };
}

/** Invoice totals: lines minus deposits already invoiced (per VAT rate). */
function computeInvoiceTotals(invoice) {
  const lines = vatBreakdown(invoice.lines || []);
  const deposits = invoice.depositBreakdown || [];
  const rates = new Set([...lines.map((r) => r.rate), ...deposits.map((r) => r.rate)]);
  const breakdown = [...rates]
    .map((rate) => {
      const l = lines.find((r) => r.rate === rate) || { baseHT: 0, vat: 0 };
      const d = deposits.find((r) => r.rate === rate) || { baseHT: 0, vat: 0 };
      return { rate, baseHT: round2(l.baseHT - d.baseHT), vat: round2(l.vat - d.vat) };
    })
    .filter((r) => r.baseHT !== 0 || r.vat !== 0)
    .sort((a, b) => b.rate - a.rate);
  const totalHT = round2(breakdown.reduce((s, r) => s + r.baseHT, 0));
  const totalVAT = round2(breakdown.reduce((s, r) => s + r.vat, 0));
  return {
    vatBreakdown: breakdown,
    depositsDeductedHT: round2(deposits.reduce((s, r) => s + (r.baseHT || 0), 0)),
    depositsDeductedVAT: round2(deposits.reduce((s, r) => s + (r.vat || 0), 0)),
    totalHT,
    totalVAT,
    totalTTC: round2(totalHT + totalVAT),
  };
}

/**
 * Deposit invoice lines for `percent` % of a devis: one line per VAT
 * rate of the devis, so the deposit carries the right VAT.
 */
function depositLines(quote, percent) {
  const pct = Number(percent);
  if (!(pct > 0 && pct <= 100)) throw Object.assign(new Error("The deposit must be between 1 and 100%"), { status: 400 });
  return vatBreakdown(quote.lines).map((r) => ({
    description: `Acompte de ${pct}% sur le devis ${quote.number}${vatBreakdown(quote.lines).length > 1 ? ` (TVA ${r.rate}%)` : ""}`,
    quantity: 1,
    unit: "",
    unitPrice: round2((r.baseHT * pct) / 100),
    discount: 0,
    vatRate: r.rate,
  }));
}

/** Sum of the given (issued) deposit invoices, per rate. */
function sumDeposits(deposits = []) {
  const byRate = new Map();
  for (const inv of deposits) {
    for (const r of inv.vatBreakdown || []) {
      const cur = byRate.get(r.rate) || { rate: r.rate, baseHT: 0, vat: 0 };
      cur.baseHT = round2(cur.baseHT + r.baseHT);
      cur.vat = round2(cur.vat + r.vat);
      byRate.set(r.rate, cur);
    }
  }
  return [...byRate.values()];
}

function paymentStatus(invoice) {
  const paid = round2((invoice.payments || []).reduce((s, p) => s + (p.amount || 0), 0));
  if (paid >= round2(invoice.totalTTC) - 0.005 && invoice.totalTTC > 0) return "paid";
  if (paid > 0) return "partially_paid";
  return "issued";
}

const OPEN = new Set(["issued", "partially_paid"]);

/** Remaining to collect on an issued invoice (0 for others). */
function amountDue(invoice) {
  if (!OPEN.has(invoice.status) || invoice.type === "credit_note") return 0;
  return Math.max(round2(invoice.totalTTC - (invoice.amountPaid || 0)), 0);
}

/**
 * Receivables per customer with ageing buckets (by due date).
 * Issued credit notes reduce the customer's balance.
 */
function receivables(invoices = [], now = new Date()) {
  const buckets = () => ({ notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, credits: 0, total: 0 });
  const byCustomer = new Map();
  const totals = buckets();
  for (const inv of invoices) {
    const key = String(inv.customer?._id || inv.customer);
    if (!byCustomer.has(key)) byCustomer.set(key, { customer: inv.customer, ...buckets(), invoices: 0 });
    const row = byCustomer.get(key);
    if (inv.type === "credit_note") {
      if (!OPEN.has(inv.status) && inv.status !== "paid") continue;
      const unused = inv.status === "paid" ? 0 : round2(inv.totalTTC - (inv.amountPaid || 0));
      row.credits = round2(row.credits + unused);
      totals.credits = round2(totals.credits + unused);
      continue;
    }
    const due = amountDue(inv);
    if (!due) continue;
    const days = inv.dueDate ? Math.floor((now - new Date(inv.dueDate)) / 86400000) : 0;
    const bucket = days <= 0 ? "notDue" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "d90plus";
    row[bucket] = round2(row[bucket] + due);
    totals[bucket] = round2(totals[bucket] + due);
    row.invoices += 1;
  }
  const rows = [...byCustomer.values()]
    .map((r) => ({ ...r, total: round2(r.notDue + r.d1_30 + r.d31_60 + r.d61_90 + r.d90plus - r.credits) }))
    .filter((r) => r.total !== 0 || r.invoices > 0)
    .sort((a, b) => b.total - a.total);
  totals.total = round2(totals.notDue + totals.d1_30 + totals.d31_60 + totals.d61_90 + totals.d90plus - totals.credits);
  return { rows, totals };
}

/**
 * VAT collected in [from, to]:
 *  - on payments received (régime des encaissements, the default in
 *    Morocco): each payment carries VAT in the invoice's VAT/TTC ratio;
 *  - on invoices issued (régime des débits), for companies that opted.
 * Credit notes count negative.
 */
function vatCollected(invoices = [], from, to) {
  const inRange = (d) => d && new Date(d) >= from && new Date(d) <= to;
  const cashRows = [];
  const accrualRows = [];
  for (const inv of invoices) {
    if (!["issued", "partially_paid", "paid"].includes(inv.status)) continue;
    const sign = inv.type === "credit_note" ? -1 : 1;
    if (inRange(inv.date)) {
      for (const r of inv.vatBreakdown || []) {
        accrualRows.push({ invoice: inv.number, date: inv.date, customer: inv.customer, rate: r.rate, baseHT: sign * r.baseHT, vat: sign * r.vat });
      }
    }
    const ttc = inv.totalTTC || 0;
    if (!ttc) continue;
    for (const p of inv.payments || []) {
      if (!inRange(p.date)) continue;
      for (const r of inv.vatBreakdown || []) {
        const share = (r.baseHT + r.vat) / ttc;
        const paidForRate = p.amount * share;
        const vat = round2((paidForRate * r.rate) / (100 + r.rate));
        cashRows.push({ invoice: inv.number, date: p.date, customer: inv.customer, rate: r.rate, baseHT: sign * round2(paidForRate - vat), vat: sign * vat });
      }
    }
  }
  const sumByRate = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const cur = m.get(r.rate) || { rate: r.rate, baseHT: 0, vat: 0 };
      cur.baseHT = round2(cur.baseHT + r.baseHT);
      cur.vat = round2(cur.vat + r.vat);
      m.set(r.rate, cur);
    }
    return [...m.values()].sort((a, b) => b.rate - a.rate);
  };
  return {
    onPayments: { rows: cashRows, byRate: sumByRate(cashRows), totalVAT: round2(cashRows.reduce((s, r) => s + r.vat, 0)) },
    onInvoices: { rows: accrualRows, byRate: sumByRate(accrualRows), totalVAT: round2(accrualRows.reduce((s, r) => s + r.vat, 0)) },
  };
}

/** Is the devis past its validity date? */
function isExpired(quote, now = new Date()) {
  return quote.status === "sent" && quote.validUntil && new Date(quote.validUntil) < now;
}

module.exports = {
  round2,
  lineHT,
  vatBreakdown,
  computeLineTotals,
  computeInvoiceTotals,
  depositLines,
  sumDeposits,
  paymentStatus,
  amountDue,
  receivables,
  vatCollected,
  isExpired,
};
