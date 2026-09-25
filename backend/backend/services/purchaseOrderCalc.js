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
const lineOutstanding = (line) => Math.max((line.quantity || 0) - lineNet(line), 0);

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

function derivePaymentStatus(order) {
  const paid = round2((order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const total = round2(order.totalTTC);
  if (paid <= 0) return { amountPaid: 0, paymentStatus: "unpaid" };
  if (total > 0 && paid >= total) return { amountPaid: paid, paymentStatus: "paid" };
  return { amountPaid: paid, paymentStatus: "partially_paid" };
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
  round2,
  lineNet,
  lineOutstanding,
  computeTotals,
  deriveReceptionStatus,
  derivePaymentStatus,
  validateReception,
  applyReceptionToLines,
};
