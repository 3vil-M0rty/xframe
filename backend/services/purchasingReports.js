/**
 * ============================================================
 * PURCHASING REPORTS (pure — no database)
 * ============================================================
 * TVA deduction listing, accounting journal, aged balance, supplier
 * statement, restocking suggestions. The routes load the data, these
 * functions turn it into rows; the files (xlsx) are built from rows.
 *
 * Amounts: invoices store TTC only. Their HT / TVA split uses the
 * order's own ratio (totalVAT / totalTTC) — exact for single-rate
 * orders, a proportional split for mixed-rate ones.
 * ============================================================
 */
const { round2, allocateInvoices, allocatePayments, lineOutstanding } = require("./purchaseOrderCalc");

// `to` is inclusive of the whole day. Accepts "YYYY-MM-DD" (what the API
// receives) or a Date — slicing a Date's string form gave an Invalid
// Date and silently matched nothing.
const endOfDay = (to) => {
  if (typeof to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(to)) return new Date(`${to}T23:59:59.999`);
  const d = new Date(to);
  d.setHours(23, 59, 59, 999);
  return d;
};
const startOfDay = (from) => {
  if (typeof from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(from)) return new Date(`${from}T00:00:00`);
  return new Date(from);
};
const inRange = (date, from, to) => {
  const d = new Date(date);
  return (!from || d >= startOfDay(from)) && (!to || d <= endOfDay(to));
};
const vatRatio = (order) => (order.totalTTC > 0 ? (order.totalVAT || 0) / order.totalTTC : 0);
const mainVatRate = (order) => {
  const byRate = new Map();
  for (const l of order.lines || []) byRate.set(l.vatRate ?? 0, (byRate.get(l.vatRate ?? 0) || 0) + (l.quantity || 0) * (l.unitPrice || 0));
  return [...byRate.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 20;
};
const split = (ttc, order) => {
  const vat = round2(ttc * vatRatio(order));
  return { ht: round2(ttc - vat), vat, ttc: round2(ttc) };
};

/**
 * VAT rows of an invoice for an amount `ttc` of it (the whole invoice,
 * or the part a payment covers):
 *   - invoice with its exact VAT breakdown -> one row per rate, the
 *     amount shared in proportion to each rate's TTC (exact);
 *   - older invoice without it -> one row, split with the order's own
 *     VAT ratio at its main rate (the previous behaviour).
 */
function vatRowsFor(invoice, ttc, order) {
  const rows = (invoice.vatBreakdown || []).filter((r) => (Number(r.baseHT) || 0) + (Number(r.vat) || 0) !== 0);
  if (!rows.length) {
    const { ht, vat } = split(ttc, order);
    return [{ rate: mainVatRate(order), ht, vat, ttc: round2(ttc), exact: false }];
  }
  const invoiceTTC = rows.reduce((sum, r) => sum + r.baseHT + r.vat, 0);
  const share = invoiceTTC ? ttc / invoiceTTC : 0;
  const out = rows.map((r) => ({ rate: r.rate, ht: round2(r.baseHT * share), vat: round2(r.vat * share), exact: true }));
  // keep the cents exact: put any rounding difference on the last row
  const diff = round2(ttc - out.reduce((sum, r) => sum + r.ht + r.vat, 0));
  if (Math.abs(diff) >= 0.01) out[out.length - 1].ht = round2(out[out.length - 1].ht + diff);
  return out.map((r) => ({ ...r, ttc: round2(r.ht + r.vat) }));
}

// ------------------------------------------------------------
// TVA deduction listing (relevé des déductions)
// ------------------------------------------------------------
// VAT on purchases is deducted when the invoice is PAID, so each row
// is a payment (or the part of one) applied to an invoice — payments
// are applied to the order's invoices oldest first.
function vatDeductionRows(orders, { from, to } = {}) {
  const rows = [];
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const { pairs } = allocatePayments(order, { includeCredits: false });
    for (const { payment, invoice, amount } of pairs) {
      if (!inRange(payment.date, from, to)) continue;
      for (const v of vatRowsFor(invoice, amount, order)) {
        rows.push({
          supplierName: order.supplier?.name || "",
          supplierIF: order.supplier?.identifiantFiscal || "",
          supplierICE: order.supplier?.ice || "",
          invoiceNumber: invoice.number,
          invoiceDate: invoice.date,
          description: `${order.number} — ${order.lines?.[0]?.description || ""}${(order.lines?.length || 0) > 1 ? "…" : ""}`,
          amountHT: v.ht,
          vatRate: v.rate,
          vatAmount: v.vat,
          amountTTC: v.ttc,
          exactVat: v.exact,
          paymentMethod: payment.method,
          paymentDate: payment.date,
          paymentReference: payment.reference || "",
        });
      }
    }
  }
  return rows.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));
}

/**
 * Payments (in the period) that couldn't be matched to an invoice —
 * no invoice recorded yet, or paid beyond what was invoiced. They
 * can't appear in the TVA listing (VAT is deducted on an invoice), and
 * silently leaving them out made the report look empty/broken.
 */
function paymentsWithoutInvoice(orders, { from, to } = {}) {
  const rows = [];
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const { uncovered } = allocatePayments(order, { includeCredits: false });
    const hasInvoice = (order.invoices || []).some((i) => i.type !== "credit_note");
    for (const [payment, amount] of uncovered) {
      if (amount <= 0.005 || !inRange(payment.date, from, to)) continue;
      rows.push({
        orderId: order._id,
        orderNumber: order.number,
        supplierName: order.supplier?.name || "",
        paymentDate: payment.date,
        paymentMethod: payment.method,
        paymentReference: payment.reference || "",
        amount: round2(amount),
        reason: hasInvoice ? "overpaid" : "no_invoice",
      });
    }
  }
  return rows.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));
}

// ------------------------------------------------------------
// Accounting journal (Moroccan chart of accounts — PCGE)
// ------------------------------------------------------------
const DEFAULT_ACCOUNTS = {
  purchases: "6111",      // default purchase account (company setting overrides; categories override that)
  vatRecoverable: "34552", // État — TVA récupérable sur charges
  vatRecoverableAssets: "34551", // État — TVA récupérable sur immobilisations
  suppliers: "4411",       // Fournisseurs
  bank: "5141",            // Banques
  cash: "5161",            // Caisse
};

/**
 * How an invoice's HT and VAT spread over accounts. Each order line
 * carries its account (article category -> accountingAccount, else the
 * company default) and whether it's a fixed asset (VAT on 34551). For
 * each VAT row of the invoice, its HT/VAT go to the lines at that rate
 * (all lines if none match), in proportion to each line's value.
 * Returns [{ account, vatAccount, ht, vat }] grouped by account pair.
 */
function spreadOverAccounts(order, vatRows, A) {
  const lines = (order.lines || []).map((l) => {
    const kept = (l.receivedQuantity || 0) - (l.returnedQuantity || 0);
    const qty = kept > 0 ? kept : (l.quantity || 0);
    const category = l.product?.category;
    return {
      rate: l.vatRate ?? 0,
      weight: qty * (l.unitPrice || 0),
      account: (category?.accountingAccount || "").trim() || A.purchases,
      vatAccount: category?.isFixedAsset ? A.vatRecoverableAssets : A.vatRecoverable,
    };
  }).filter((l) => l.weight > 0);
  if (!lines.length) lines.push({ rate: 0, weight: 1, account: A.purchases, vatAccount: A.vatRecoverable });

  const groups = new Map();
  for (const row of vatRows) {
    const atRate = lines.filter((l) => l.rate === row.rate);
    const targets = atRate.length && row.exact !== false ? atRate : lines;
    const total = targets.reduce((sum, l) => sum + l.weight, 0);
    let htLeft = row.ht;
    let vatLeft = row.vat;
    targets.forEach((l, i) => {
      const last = i === targets.length - 1;
      const ht = last ? round2(htLeft) : round2(row.ht * (l.weight / total));
      const vat = last ? round2(vatLeft) : round2(row.vat * (l.weight / total));
      htLeft = round2(htLeft - ht);
      vatLeft = round2(vatLeft - vat);
      const k = `${l.account}|${l.vatAccount}`;
      const g = groups.get(k) || { account: l.account, vatAccount: l.vatAccount, ht: 0, vat: 0 };
      g.ht = round2(g.ht + ht);
      g.vat = round2(g.vat + vat);
      groups.set(k, g);
    });
  }
  return [...groups.values()];
}

function accountingEntries(orders, { from, to, accounts = {} } = {}) {
  const A = { ...DEFAULT_ACCOUNTS, ...Object.fromEntries(Object.entries(accounts).filter(([, v]) => v)) };
  const entries = [];
  const push = (e) => entries.push({ debit: 0, credit: 0, ...e });

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const supplier = order.supplier?.name || "";
    for (const inv of order.invoices || []) {
      if (!inRange(inv.date, from, to)) continue;
      const ttc = round2(inv.amountTTC);
      const parts = spreadOverAccounts(order, vatRowsFor(inv, ttc, order), A);
      const isCredit = inv.type === "credit_note";
      const label = `${isCredit ? "Avoir" : "Facture"} ${inv.number} ${supplier} (${order.number})`;
      const base = { date: inv.date, journal: "ACH", piece: inv.number, supplier, label };
      const side = (amount) => (isCredit ? { credit: amount } : { debit: amount });
      for (const p of parts) if (p.ht) push({ ...base, account: p.account, ...side(p.ht) });
      const vatByAccount = new Map();
      for (const p of parts) if (p.vat) vatByAccount.set(p.vatAccount, round2((vatByAccount.get(p.vatAccount) || 0) + p.vat));
      for (const [account, vat] of vatByAccount) push({ ...base, account, ...side(vat) });
      push({ ...base, account: A.suppliers, ...(isCredit ? { debit: ttc } : { credit: ttc }) });
    }
    for (const p of order.payments || []) {
      if (!inRange(p.date, from, to)) continue;
      const cash = p.method === "especes";
      const base = {
        date: p.date,
        journal: cash ? "CAI" : "BQ",
        piece: p.reference || p.batchRef || order.number,
        supplier,
        label: `Règlement ${supplier} (${order.number})`,
      };
      push({ ...base, account: A.suppliers, debit: round2(p.amount) });
      push({ ...base, account: cash ? A.cash : A.bank, credit: round2(p.amount) });
    }
  }
  return entries.sort((a, b) => new Date(a.date) - new Date(b.date) || a.journal.localeCompare(b.journal));
}

// ------------------------------------------------------------
// Aged balance (balance âgée) per supplier
// ------------------------------------------------------------
const BUCKETS = ["notDue", "d1_30", "d31_60", "d61_90", "d90plus"];
function bucketOf(row) {
  if (!row.overdue) return "notDue";
  if (row.daysOverdue <= 30) return "d1_30";
  if (row.daysOverdue <= 60) return "d31_60";
  if (row.daysOverdue <= 90) return "d61_90";
  return "d90plus";
}

function agedBalance(orders, now = new Date()) {
  const bySupplier = new Map();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const id = String(order.supplier?._id || order.supplier);
    if (!bySupplier.has(id)) {
      bySupplier.set(id, { supplierId: id, supplierName: order.supplier?.name || "", total: 0, ...Object.fromEntries(BUCKETS.map((b) => [b, 0])) });
    }
    const agg = bySupplier.get(id);
    for (const r of allocateInvoices(order, now)) {
      if (r.remaining <= 0) continue;
      agg[bucketOf(r)] = round2(agg[bucketOf(r)] + r.remaining);
      agg.total = round2(agg.total + r.remaining);
    }
  }
  return [...bySupplier.values()].filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
}

// ------------------------------------------------------------
// Supplier statement (relevé fournisseur) with running balance
// ------------------------------------------------------------
// Balance = what we owe: invoices add, credit notes and payments subtract.
function supplierStatement(orders, { from, to } = {}) {
  const events = [];
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const inv of order.invoices || []) {
      const credit = inv.type === "credit_note";
      events.push({ date: inv.date, type: credit ? "credit_note" : "invoice", reference: inv.number, orderNumber: order.number,
        debit: credit ? 0 : round2(inv.amountTTC), credit: credit ? round2(inv.amountTTC) : 0 });
    }
    for (const p of order.payments || []) {
      events.push({ date: p.date, type: "payment", reference: p.reference || "", method: p.method, orderNumber: order.number,
        debit: 0, credit: round2(p.amount) });
    }
  }
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  let opening = 0;
  const rows = [];
  let balance = 0;
  for (const e of events) {
    const delta = e.debit - e.credit;
    if (from && new Date(e.date) < new Date(from)) { opening = round2(opening + delta); balance = opening; continue; }
    if (to && !inRange(e.date, null, to)) continue;
    balance = round2(balance + delta);
    rows.push({ ...e, balance });
  }
  return {
    openingBalance: opening,
    rows,
    closingBalance: rows.length ? rows[rows.length - 1].balance : opening,
    totalInvoiced: round2(rows.reduce((s, r) => s + r.debit, 0)),
    totalSettled: round2(rows.reduce((s, r) => s + r.credit, 0)),
  };
}

// ------------------------------------------------------------
// Restocking suggestions
// ------------------------------------------------------------
// Articles at or below their minimum stock, after counting what's
// already coming (open orders) and already asked for (open purchase
// requests). Target = 2 × minimum; grouped by the cheapest supplier.
const OPEN_ORDER = ["draft", "pending_approval", "sent", "partially_received"];

function restockSuggestions(products, openOrders = [], openRequests = []) {
  const incoming = new Map();
  for (const o of openOrders) {
    if (!OPEN_ORDER.includes(o.status)) continue;
    for (const l of o.lines || []) {
      if (!l.product) continue;
      const id = String(l.product._id || l.product);
      incoming.set(id, (incoming.get(id) || 0) + lineOutstanding(l));
    }
  }
  const requested = new Map();
  for (const r of openRequests) {
    const id = String(r.product?._id || r.product);
    requested.set(id, (requested.get(id) || 0) + (r.requestedQuantity || 0));
  }

  const rows = [];
  for (const p of products) {
    const threshold = Number(p.threshold) || 0;
    if (threshold <= 0 || (p.quantity || 0) > threshold) continue;
    const id = String(p._id);
    const coming = incoming.get(id) || 0;
    const asked = requested.get(id) || 0;
    const suggested = round2(Math.max(threshold * 2 - (p.quantity || 0) - coming, 0));
    if (suggested <= 0) continue;
    const best = (p.prices || []).slice().sort((a, b) => a.price - b.price)[0] || null;
    rows.push({
      productId: id,
      name: p.name,
      internalReference: p.internalReference || "",
      unit: p.unit || "",
      quantity: p.quantity || 0,
      threshold,
      incoming: coming,
      requested: asked,
      suggestedQuantity: suggested,
      supplierName: best?.supplierName || null,
      unitPrice: best ? best.price : null,
    });
  }
  const groups = new Map();
  for (const r of rows) {
    const key = r.supplierName || "";
    if (!groups.has(key)) groups.set(key, { supplierName: r.supplierName, items: [], estimatedHT: 0 });
    const g = groups.get(key);
    g.items.push(r);
    if (r.unitPrice !== null) g.estimatedHT = round2(g.estimatedHT + r.unitPrice * r.suggestedQuantity);
  }
  return [...groups.values()].sort((a, b) => (a.supplierName ? 0 : 1) - (b.supplierName ? 0 : 1) || b.estimatedHT - a.estimatedHT);
}

module.exports = {
  DEFAULT_ACCOUNTS,
  vatRowsFor,
  vatDeductionRows,
  paymentsWithoutInvoice,
  accountingEntries,
  agedBalance,
  supplierStatement,
  restockSuggestions,
};
