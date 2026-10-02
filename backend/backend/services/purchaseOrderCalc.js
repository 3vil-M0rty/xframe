/**
 * ============================================================
 * PURCHASE ORDER RULES (pure — no database)
 * ============================================================
 * Line quantities:
 *   quantity          ordered
 *   receivedQuantity  total ever received (all receptions)
 *   returnedQuantity  total sent back to the supplier (all returns)
 *   net = received - returned      what we actually kept
 *   outstanding = quantity - net   still expected from the supplier
 *
 * A return re-opens the outstanding quantity: if 10 are received and
 * 3 are returned as defective, 3 are expected again.
 * ============================================================
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const lineNet = (line) => (line.receivedQuantity || 0) - (line.returnedQuantity || 0);
// A line "closed" (soldée) by the buyer — e.g. 69 of 70 delivered and the
// last one no longer expected — has nothing outstanding, whatever the
// quantities say.
const lineOutstanding = (line) => (line.closed ? 0 : Math.max((line.quantity || 0) - lineNet(line), 0));
const lineTTC = (qty, line) => qty * (Number(line.unitPrice) || 0) * (1 + (Number(line.vatRate) || 0) / 100);

function computeTotals(lines = []) {
  let totalHT = 0;
  let totalVAT = 0;
  for (const line of lines) {
    const ht = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
    totalHT += ht;
    totalVAT += ht * ((Number(line.vatRate) || 0) / 100);
  }
  return { totalHT: round2(totalHT), totalVAT: round2(totalVAT), totalTTC: round2(totalHT + totalVAT) };
}

/**
 * Status after a reception/return. Only "sent" (ordered) orders move;
 * draft and cancelled are left alone.
 */
function deriveReceptionStatus(order) {
  if (["draft", "cancelled"].includes(order.status)) return order.status;
  const lines = order.lines || [];
  if (lines.length === 0) return order.status;
  const anyKept = lines.some((l) => lineNet(l) > 0);
  const allDone = lines.every((l) => lineOutstanding(l) === 0);
  if (allDone) return "received";
  if (anyKept) return "partially_received";
  return "sent";
}

/**
 * What is owed, then what is paid.
 *   - No supplier invoice yet: the basis is the order total (TTC).
 *   - Once invoices exist: the basis is what the supplier actually
 *     billed — invoices minus credit notes (avoirs). An order closed at
 *     69 of 70 is invoiced 69, and must show as fully paid at 69.
 */
function invoiceTotals(order) {
  let invoiced = 0;
  let credited = 0;
  for (const inv of order.invoices || []) {
    if (inv.type === "credit_note") credited += Number(inv.amountTTC) || 0;
    else invoiced += Number(inv.amountTTC) || 0;
  }
  return { invoicedTTC: round2(invoiced), creditedTTC: round2(credited), invoicedNetTTC: round2(invoiced - credited) };
}

function derivePaymentStatus(order) {
  const paid = round2((order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const { invoicedNetTTC } = invoiceTotals(order);
  const hasInvoices = (order.invoices || []).some((i) => i.type !== "credit_note");
  const basis = round2(hasInvoices ? invoicedNetTTC : order.totalTTC);
  const amountDue = round2(Math.max(basis - paid, 0));
  if (paid <= 0) return { amountPaid: 0, amountDue, paymentStatus: "unpaid" };
  if (basis > 0 && paid >= basis - 0.005) return { amountPaid: paid, amountDue: 0, paymentStatus: "paid" };
  return { amountPaid: paid, amountDue, paymentStatus: "partially_paid" };
}

/**
 * Three-way matching (commande / réception / facture), in TTC:
 *   orderedTTC   what was ordered
 *   receivedTTC  what was received AND kept (returns excluded) — what
 *                the supplier should bill
 *   returnedTTC  value of goods sent back — the credit note to expect
 *   gap          invoicedNet - received: > 0 means billed for more than
 *                was kept, < 0 means still to be invoiced
 *   creditExpected  returns not yet covered by a credit note
 * A difference under 1 MAD is treated as rounding.
 */
function matchOrder(order) {
  let receivedTTC = 0;
  let returnedTTC = 0;
  for (const line of order.lines || []) {
    receivedTTC += lineTTC(lineNet(line), line);
    returnedTTC += lineTTC(line.returnedQuantity || 0, line);
  }
  const { invoicedTTC, creditedTTC, invoicedNetTTC } = invoiceTotals(order);
  const gap = round2(invoicedNetTTC - receivedTTC);
  const creditExpected = round2(Math.max(returnedTTC - creditedTTC, 0));
  const TOLERANCE = 1;
  let status = "not_invoiced";
  if (invoicedTTC > 0) status = Math.abs(gap) <= TOLERANCE ? "matched" : gap > 0 ? "over_invoiced" : "partially_invoiced";
  return {
    orderedTTC: round2(order.totalTTC),
    receivedTTC: round2(receivedTTC),
    returnedTTC: round2(returnedTTC),
    invoicedTTC,
    creditedTTC,
    invoicedNetTTC,
    gap,
    creditExpected: creditExpected > TOLERANCE ? creditExpected : 0,
    status,
  };
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Which payment (or credit note) settles which invoice.
 *   1. A payment that names its invoice (payment.invoiceId) goes to
 *      that invoice first — any excess joins the general pool.
 *   2. Everything else (payments without an invoice, excesses, and —
 *      when includeCredits — credit notes) is applied to the remaining
 *      invoice balances oldest invoice first, in date order.
 * Returns { invoices (sorted), pairs: [{ payment, invoice, amount, credit }],
 *           remaining: Map(invoiceId -> balance), uncovered: Map(payment -> amount) }
 */
function allocatePayments(order, { includeCredits = true } = {}) {
  const invoices = (order.invoices || []).filter((i) => i.type !== "credit_note")
    .slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const key = (inv) => String(inv._id ?? inv.number);
  const remaining = new Map(invoices.map((inv) => [key(inv), round2(inv.amountTTC)]));
  const byId = new Map(invoices.filter((inv) => inv._id).map((inv) => [String(inv._id), inv]));
  const pairs = [];
  const uncovered = new Map();

  const apply = (source, invoice, amount, credit) => {
    const k = key(invoice);
    const applied = round2(Math.min(amount, remaining.get(k)));
    if (applied <= 0) return 0;
    remaining.set(k, round2(remaining.get(k) - applied));
    pairs.push({ payment: source, invoice, amount: applied, credit });
    return applied;
  };

  const payments = (order.payments || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const pool = [];
  for (const p of payments) {
    let left = round2(p.amount);
    const target = p.invoiceId ? byId.get(String(p.invoiceId)) : null;
    if (target) left = round2(left - apply(p, target, left, false));
    if (left > 0.005) pool.push({ source: p, left, credit: false, date: p.date });
  }
  if (includeCredits) {
    for (const c of (order.invoices || []).filter((i) => i.type === "credit_note")) {
      pool.push({ source: c, left: round2(c.amountTTC), credit: true, date: c.date });
    }
  }
  pool.sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const item of pool) {
    for (const inv of invoices) {
      if (item.left <= 0.005) break;
      item.left = round2(item.left - apply(item.source, inv, item.left, item.credit));
    }
    if (!item.credit && item.left > 0.005) uncovered.set(item.source, round2((uncovered.get(item.source) || 0) + item.left));
  }
  return { invoices, pairs, remaining, uncovered };
}

/**
 * Per-invoice payment state (built on allocatePayments). Returns one
 * row per invoice with paid / remaining / overdue / days late, and the
 * payment term vs the legal limits (Loi 69-21: 60 days by default,
 * 120 days maximum by written agreement).
 */
function allocateInvoices(order, now = new Date()) {
  const { invoices, remaining } = allocatePayments(order, { includeCredits: true });
  return invoices.map((inv) => {
    const amount = round2(inv.amountTTC);
    const left = remaining.get(String(inv._id ?? inv.number));
    const paid = round2(amount - left);
    const status = left <= 0.005 ? "paid" : paid > 0 ? "partially_paid" : "unpaid";
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    const overdue = status !== "paid" && due && due < now;
    const termDays = due && inv.date ? Math.round((due - new Date(inv.date)) / DAY) : null;
    return {
      invoice: inv,
      amount,
      paid,
      remaining: status === "paid" ? 0 : left,
      status,
      overdue: !!overdue,
      daysOverdue: overdue ? Math.floor((now - due) / DAY) : 0,
      termDays,
      legal: termDays === null ? "unknown" : termDays > 120 ? "over_max" : termDays > 60 ? "needs_agreement" : "ok",
    };
  });
}

/**
 * Validates a reception or return against the order's current state.
 * `entries` = [{ lineId, quantity }]. Returns an error message or null.
 */
function validateReception(order, type, entries) {
  if (!["sent", "partially_received", "received"].includes(order.status)) {
    return "Only an order that has been sent to the supplier can be received";
  }
  if (!Array.isArray(entries) || entries.length === 0) return "Enter a quantity for at least one line";

  const byId = new Map((order.lines || []).map((l) => [String(l._id), l]));
  const seen = new Set();
  for (const entry of entries) {
    const line = byId.get(String(entry.lineId));
    if (!line) return "Unknown order line";
    if (seen.has(String(entry.lineId))) return "The same line appears twice";
    seen.add(String(entry.lineId));
    const qty = Number(entry.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return "Quantities must be greater than zero";
    const label = line.description || "line";
    if (type === "reception" && line.closed) {
      return `"${label}" was closed — reopen it to receive more`;
    }
    if (type === "reception" && qty > lineOutstanding(line)) {
      return `"${label}": only ${lineOutstanding(line)} still expected`;
    }
    if (type === "return" && qty > lineNet(line)) {
      return `"${label}": only ${lineNet(line)} received and kept, can't return more`;
    }
  }
  return null;
}

/** Applies a validated reception/return to the order's lines (mutates). */
function applyReceptionToLines(order, type, entries) {
  const byId = new Map(order.lines.map((l) => [String(l._id), l]));
  for (const entry of entries) {
    const line = byId.get(String(entry.lineId));
    const qty = Number(entry.quantity);
    if (type === "reception") line.receivedQuantity = (line.receivedQuantity || 0) + qty;
    else line.returnedQuantity = (line.returnedQuantity || 0) + qty;
  }
}

module.exports = {
  allocatePayments,
  invoiceTotals,
  matchOrder,
  allocateInvoices,
  round2,
  lineNet,
  lineOutstanding,
  computeTotals,
  deriveReceptionStatus,
  derivePaymentStatus,
  validateReception,
  applyReceptionToLines,
};
