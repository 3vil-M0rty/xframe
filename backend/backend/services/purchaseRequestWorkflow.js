/**
 * ============================================================
 * PURCHASE REQUEST WORKFLOW RULES (pure — no database)
 * ============================================================
 * Production asks; purchasing answers with one of:
 *   ordered   a purchase order was placed
 *   declined  refused — a reason is REQUIRED
 *   delayed   not handled yet — an explanation is REQUIRED
 *   note      add/replace the explanation without changing status
 * A request that's ordered (or further along) can no longer be
 * declined or delayed — the order exists; cancel it instead.
 * ============================================================
 */

const OPEN = ["pending", "delayed"];

// Legacy statuses from before this workflow read as their equivalents.
const normalizeStatus = (status) => ({ approved: "ordered", rejected: "declined" }[status] || status);

/**
 * Returns { error } or { status, set } — `set` being the fields to
 * write on the request (status plus note/reason fields).
 */
function planProcessAction(currentStatus, action, note) {
  const current = normalizeStatus(currentStatus);
  const text = typeof note === "string" ? note.trim() : "";

  switch (action) {
    case "ordered":
      if (!OPEN.includes(current)) return { error: `A request that is already ${current} can't be marked as ordered` };
      return { status: "ordered", set: { status: "ordered", ...(text ? { purchasingNote: text } : {}) } };
    case "declined":
      if (!OPEN.includes(current)) return { error: `A request that is already ${current} can't be declined` };
      if (!text) return { error: "Please give the reason for declining" };
      return { status: "declined", set: { status: "declined", declineReason: text } };
    case "delayed":
      if (!OPEN.includes(current)) return { error: `A request that is already ${current} can't be marked as delayed` };
      if (!text) return { error: "Please explain why it's delayed" };
      return { status: "delayed", set: { status: "delayed", purchasingNote: text } };
    case "note":
      if (!text) return { error: "The note is empty" };
      return { status: current, set: { purchasingNote: text } };
    default:
      return { error: "Unknown action" };
  }
}

/** Short French/English-neutral notification titles per outcome. */
const NOTIFY_TITLES = {
  ordered: "Purchase request ordered",
  declined: "Purchase request declined",
  delayed: "Purchase request delayed",
  note: "Update on a purchase request",
  received: "Purchased item received",
};

module.exports = { OPEN, normalizeStatus, planProcessAction, NOTIFY_TITLES };
