const PurchaseOrder = require("../models/PurchaseOrder");
const Supplier = require("../models/Supplier");
const { notifyMany, getPurchasingRecipientIds } = require("./notificationService");

/**
 * Daily purchasing checks (run with the HR checks — see server.js).
 * Each alert is sent ONCE (a marker is stored), so the bell doesn't
 * repeat the same warning every day.
 */
const DOC_WARNING_DAYS = 30;
const DOC_LABELS = { attestation_fiscale: "Attestation de régularité fiscale", rc: "Registre de commerce", cnss: "Attestation CNSS", rib: "RIB", patente: "Patente", other: "Document" };

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Ordered, not fully received, expected delivery date passed. */
async function checkLateDeliveries(now = new Date()) {
  const late = await PurchaseOrder.find({
    status: { $in: ["sent", "partially_received"] },
    expectedDate: { $ne: null, $lt: startOfDay(now) },
    lateNotifiedAt: null,
  }).populate("supplier", "name");

  for (const order of late) {
    // eslint-disable-next-line no-await-in-loop
    const recipients = await getPurchasingRecipientIds(order.company);
    // eslint-disable-next-line no-await-in-loop
    await notifyMany(recipients, {
      type: "purchase_request_pending",
      title: "Late delivery",
      message: `${order.number} — ${order.supplier?.name || ""}: expected ${new Date(order.expectedDate).toLocaleDateString("fr-FR")}`,
      link: `/purchasing/orders/${order._id}`,
    });
    order.lateNotifiedAt = now;
    // eslint-disable-next-line no-await-in-loop
    await order.save();
  }
  return late.length;
}

/**
 * Goods received at least 7 days ago, still no supplier invoice — the
 * invoice is needed for the TVA deduction and the payment schedule.
 */
const MISSING_INVOICE_DAYS = 7;
async function checkMissingInvoices(now = new Date()) {
  const cutoff = new Date(now.getTime() - MISSING_INVOICE_DAYS * 86400000);
  const orders = await PurchaseOrder.find({
    status: { $in: ["partially_received", "received"] },
    invoices: { $not: { $elemMatch: { type: { $ne: "credit_note" } } } },
    missingInvoiceNotifiedAt: null,
    receptions: { $elemMatch: { type: "reception", date: { $lte: cutoff } } },
  }).populate("supplier", "name");

  for (const order of orders) {
    // eslint-disable-next-line no-await-in-loop
    const recipients = await getPurchasingRecipientIds(order.company);
    // eslint-disable-next-line no-await-in-loop
    await notifyMany(recipients, {
      type: "purchase_request_pending",
      title: "Supplier invoice missing",
      message: `${order.number} — ${order.supplier?.name || ""}: goods received, no invoice recorded`,
      link: `/purchasing/orders/${order._id}`,
    });
    order.missingInvoiceNotifiedAt = now;
    // eslint-disable-next-line no-await-in-loop
    await order.save();
  }
  return orders.length;
}

/** Supplier documents expiring within 30 days (or already expired). */
async function checkSupplierDocuments(now = new Date()) {
  const limit = new Date(now.getTime() + DOC_WARNING_DAYS * 86400000);
  const suppliers = await Supplier.find({
    isActive: true,
    documents: { $elemMatch: { expiryDate: { $ne: null, $lte: limit }, expiryNotifiedAt: null } },
  });
  let count = 0;
  for (const supplier of suppliers) {
    const due = supplier.documents.filter((d) => d.expiryDate && d.expiryDate <= limit && !d.expiryNotifiedAt);
    if (!due.length) continue;
    // eslint-disable-next-line no-await-in-loop
    const recipients = await getPurchasingRecipientIds(supplier.company);
    for (const doc of due) {
      const expired = doc.expiryDate < now;
      // eslint-disable-next-line no-await-in-loop
      await notifyMany(recipients, {
        type: "document_expiring",
        title: expired ? "Supplier document expired" : "Supplier document expiring",
        message: `${supplier.name} — ${doc.label || DOC_LABELS[doc.type]} (${new Date(doc.expiryDate).toLocaleDateString("fr-FR")})`,
        link: "/purchasing/suppliers",
      });
      doc.expiryNotifiedAt = now;
      count += 1;
    }
    // eslint-disable-next-line no-await-in-loop
    await supplier.save();
  }
  return count;
}

async function runDailyPurchasingChecks() {
  try {
    const now = new Date();
    const [late, docs, missing] = await Promise.all([checkLateDeliveries(now), checkSupplierDocuments(now), checkMissingInvoices(now)]);
    console.log(`[scheduledNotifications] Daily purchasing check complete — ${late} late order(s), ${docs} supplier document(s), ${missing} missing invoice(s) notified.`);
  } catch (error) {
    console.error("[scheduledNotifications] Daily purchasing check failed:", error);
  }
}

module.exports = { runDailyPurchasingChecks, checkLateDeliveries, checkSupplierDocuments, checkMissingInvoices, DOC_WARNING_DAYS, MISSING_INVOICE_DAYS };
