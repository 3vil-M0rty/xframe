/**
 * ============================================================
 * BUSINESS NOTIFICATIONS — workshops, sales, projects, stock
 * ============================================================
 * In-app notifications (the bell) for the production / sales /
 * project modules. Every notification carries a translation `key`
 * + `params` (the bell shows it in the reader's language — see
 * notificationEvents in the frontend i18n) and a French fallback
 * title/message.
 *
 * Event hooks (called from the routes / services right after the
 * change is saved) never throw: a failed notification must not undo
 * or fail the business action — errors are only logged.
 *
 * Daily checks (runDailyBusinessChecks, from server.js) send each
 * alert ONCE thanks to a marker on the record (lateNotifiedAt…).
 * ============================================================
 */
const Workshop = require("../models/Workshop");
const Project = require("../models/Project");
const ProductionOrder = require("../models/ProductionOrder");
const Quote = require("../models/Quote");
const SalesInvoice = require("../models/SalesInvoice");
const Customer = require("../models/Customer");
const {
  notifyMany, getDepartmentRecipientIds, getUserIdsForEmployees, getPurchasingRecipientIds,
} = require("./notificationService");

const DAY = 86400000;
const QUOTE_EXPIRY_WARNING_DAYS = 3;
const PROJECT_DUE_WARNING_DAYS = 7;
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
const money = (n) => `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
const uniq = (...lists) => [...new Set(lists.flat().filter(Boolean).map(String))];
const without = (ids, actorId) => ids.filter((id) => id !== String(actorId || ""));

async function safe(label, fn) {
  try {
    return await fn();
  } catch (error) {
    console.error(`Notification (${label}) failed:`, error);
    return null;
  }
}

/** Users of a workshop: its manager and members. */
async function workshopUserIds(workshopOrId) {
  const w = workshopOrId?.manager !== undefined ? workshopOrId : await Workshop.findById(workshopOrId).select("manager members name company").lean();
  if (!w) return [];
  return getUserIdsForEmployees([w.manager, ...(w.members || [])]);
}

/** The project manager's login (if the manager employee has one). */
async function projectManagerUserIds(projectOrId) {
  const p = projectOrId?.manager !== undefined ? projectOrId : await Project.findById(projectOrId).select("manager").lean();
  return p?.manager ? getUserIdsForEmployees([p.manager]) : [];
}

// ------------------------------------------------------------------
// Workshops
// ------------------------------------------------------------------

/** Work orders generated for a project → each workshop's team. */
function onOrdersPlanned(project, orders, actorId) {
  return safe("orders planned", async () => {
    for (const order of orders) {
      const workshop = await Workshop.findById(order.workshop).select("name manager members").lean();
      if (!workshop) continue;
      const waiting = (order.dependsOn || []).length > 0;
      await notifyMany(without(await workshopUserIds(workshop), actorId), {
        type: "production",
        key: waiting ? "orderPlannedWaiting" : "orderPlanned",
        params: { number: order.number, workshop: workshop.name, project: `${project.number} — ${project.name}` },
        title: `Nouvel ordre de fabrication ${order.number}`,
        message: `${workshop.name} · ${project.number} — ${project.name}${waiting ? " (en attente des ateliers en amont)" : ""}`,
        link: `/production/orders/${order._id}`,
      });
    }
  });
}

/** A manual work order (e.g. lacquering for an outside customer) → that workshop's team. */
function onOrderCreated(order, actorId) {
  return safe("order created", async () => {
    const workshop = await Workshop.findById(order.workshop).select("name manager members").lean();
    if (!workshop) return;
    await notifyMany(without(await workshopUserIds(workshop), actorId), {
      type: "production",
      key: "orderCreated",
      params: { number: order.number, workshop: workshop.name, title: order.title || "" },
      title: `Nouvel ordre de fabrication ${order.number}`,
      message: `${workshop.name} · ${order.title || ""}`,
      link: `/production/orders/${order._id}`,
    });
  });
}

/**
 * Orders that were waiting on `order` and are now free to start
 * (every upstream order done or cancelled) → their workshop's team.
 */
async function notifyUnblocked(order, actorId) {
  const dependents = await ProductionOrder.find({ dependsOn: order._id, status: { $in: ["planned", "draft"] } }).select("number workshop dependsOn project").lean();
  for (const dep of dependents) {
    const upstream = await ProductionOrder.find({ _id: { $in: dep.dependsOn } }).select("status").lean();
    if (upstream.some((u) => !["done", "cancelled"].includes(u.status))) continue;
    const workshop = await Workshop.findById(dep.workshop).select("name manager members").lean();
    if (!workshop) continue;
    await notifyMany(without(await workshopUserIds(workshop), actorId), {
      type: "production",
      key: "orderReady",
      params: { number: dep.number, workshop: workshop.name },
      title: `${dep.number} peut démarrer`,
      message: `${workshop.name} : les ateliers en amont ont terminé.`,
      link: `/production/orders/${dep._id}`,
    });
  }
}

/**
 * A work order is completed → production + the project manager; its
 * downstream orders may be ready; a forced close with missing stock
 * also alerts production and purchasing.
 */
function onOrderCompleted(order, actorId, { shortages = [] } = {}) {
  return safe("order completed", async () => {
    const workshop = await Workshop.findById(order.workshop).select("name").lean();
    const project = order.project ? await Project.findById(order.project).select("number name manager").lean() : null;
    const recipients = without(uniq(
      await getDepartmentRecipientIds(order.company, "production"),
      project ? await projectManagerUserIds(project) : [],
    ), actorId);
    await notifyMany(recipients, {
      type: "production",
      key: "orderDone",
      params: { number: order.number, workshop: workshop?.name || "", project: project ? `${project.number} — ${project.name}` : order.title || "" },
      title: `${order.number} terminé`,
      message: `${workshop?.name || ""} · ${project ? `${project.number} — ${project.name}` : order.title || ""}`,
      link: `/production/orders/${order._id}`,
    });
    if (shortages.length) {
      const list = shortages.slice(0, 4).map((s) => s.product).join(", ");
      await notifyMany(without(uniq(
        await getDepartmentRecipientIds(order.company, "production"),
        await getPurchasingRecipientIds(order.company),
      ), actorId), {
        type: "stock_low",
        key: "orderClosedShort",
        params: { number: order.number, count: shortages.length, articles: list },
        title: `${order.number} clôturé avec du stock manquant`,
        message: `${shortages.length} article(s) : ${list}`,
        link: `/production/orders/${order._id}`,
      });
    }
    await notifyUnblocked(order, actorId);
  });
}

/** A work order is cancelled → its team + production; downstream orders may be ready. */
function onOrderCancelled(order, actorId, reason = "") {
  return safe("order cancelled", async () => {
    const workshop = await Workshop.findById(order.workshop).select("name manager members").lean();
    await notifyMany(without(uniq(await workshopUserIds(workshop), await getDepartmentRecipientIds(order.company, "production")), actorId), {
      type: "production",
      key: "orderCancelled",
      params: { number: order.number, workshop: workshop?.name || "", reason: reason ? `— ${reason}` : "" },
      title: `${order.number} annulé`,
      message: `${workshop?.name || ""}${reason ? ` — ${reason}` : ""}`,
      link: `/production/orders/${order._id}`,
    });
    await notifyUnblocked(order, actorId);
  });
}

// ------------------------------------------------------------------
// Stock
// ------------------------------------------------------------------

/**
 * Called after every stock movement (services/inventoryService.js):
 * the article just reached its minimum stock → production + purchasing.
 * Alerts once per drop (marker cleared when the stock goes back up).
 */
function onStockChanged(product, previousQuantity, actorId) {
  return safe("stock", async () => {
    const threshold = Number(product.threshold) || 0;
    if (threshold <= 0) return;
    const Product = require("../models/Product");
    if (product.quantity > threshold) {
      if (product.lowStockNotifiedAt) await Product.updateOne({ _id: product._id }, { lowStockNotifiedAt: null });
      return;
    }
    if (previousQuantity <= threshold && product.lowStockNotifiedAt) return;
    await Product.updateOne({ _id: product._id }, { lowStockNotifiedAt: new Date() });
    product.lowStockNotifiedAt = new Date();
    await notifyMany(without(uniq(
      await getDepartmentRecipientIds(product.company, "production"),
      await getPurchasingRecipientIds(product.company),
    ), actorId), {
      type: "stock_low",
      key: "stockLow",
      params: { article: product.name, quantity: product.quantity, unit: product.unit || "", threshold },
      title: `Stock bas : ${product.name}`,
      message: `${product.quantity} ${product.unit || ""} en stock (seuil ${threshold})`,
      link: "/production/inventory",
    });
  });
}

// ------------------------------------------------------------------
// Sales
// ------------------------------------------------------------------

/** Devis accepted / refused → its author (+ production when accepted). */
function onQuoteDecided(quote, actorId) {
  return safe("quote decided", async () => {
    const customer = await Customer.findById(quote.customer).select("name").lean();
    const accepted = quote.status === "accepted";
    const salesSide = without(quote.createdBy ? [String(quote.createdBy)] : await getDepartmentRecipientIds(quote.company, "sales"), actorId);
    await notifyMany(salesSide, {
      type: "sales",
      key: accepted ? "quoteAccepted" : "quoteRefused",
      params: { number: quote.number, customer: customer?.name || "", amount: money(quote.totalHT), reason: quote.refusalReason ? `— ${quote.refusalReason}` : "" },
      title: `Devis ${quote.number} ${accepted ? "accepté" : "refusé"}`,
      message: `${customer?.name || ""} · ${money(quote.totalHT)} HT${!accepted && quote.refusalReason ? ` — ${quote.refusalReason}` : ""}`,
      link: `/sales/quotes/${quote._id}`,
    });
    // Production hears about it too — without the amount (they don't see money).
    if (accepted) {
      const production = without(await getDepartmentRecipientIds(quote.company, "production"), actorId).filter((id) => !salesSide.includes(id));
      await notifyMany(production, {
        type: "project",
        key: "quoteAcceptedProd",
        params: { number: quote.number, customer: customer?.name || "" },
        title: `Devis ${quote.number} accepté`,
        message: `${customer?.name || ""} — le projet va arriver en production`,
        link: "/production/projects",
      });
    }
  });
}

/** Payment recorded on an invoice → the invoice's author (+ sales if none). */
function onPaymentRecorded(invoice, amount, actorId) {
  return safe("payment", async () => {
    const customer = await Customer.findById(invoice.customer).select("name").lean();
    const recipients = without(invoice.createdBy ? [String(invoice.createdBy)] : await getDepartmentRecipientIds(invoice.company, "sales"), actorId);
    await notifyMany(recipients, {
      type: "sales",
      key: invoice.status === "paid" ? "invoicePaid" : "paymentReceived",
      params: { number: invoice.number || "", customer: customer?.name || "", amount: money(amount) },
      title: invoice.status === "paid" ? `Facture ${invoice.number} soldée` : `Encaissement sur ${invoice.number}`,
      message: `${customer?.name || ""} · ${money(amount)}`,
      link: `/sales/invoices/${invoice._id}`,
    });
  });
}


// ------------------------------------------------------------------
// Tracking & logistics
// ------------------------------------------------------------------
const TrackingUnit = require("../models/TrackingUnit");
const DeliveryNote = require("../models/DeliveryNote");

async function projectOf(projectOrId) {
  if (projectOrId?.number) return projectOrId;
  return Project.findById(projectOrId).select("number name company manager quote").lean();
}

/**
 * After a tracking action: new pieces ready → logistics; every chassis
 * installed → sales (final invoice) + project manager.
 */
function onTrackingChanged(project, action, { newlyReady = [] } = {}, actorId) {
  return safe("tracking", async () => {
    const p = await projectOf(project);
    if (action === "ready" && newlyReady.length) {
      const pieces = newlyReady.reduce((a, r) => a + r.qty, 0);
      const refs = [...new Set(newlyReady.map((r) => r.unit.ref))];
      await notifyMany(without(await getDepartmentRecipientIds(p.company, "logistics"), actorId), {
        type: "project",
        key: "readyToDeliver",
        params: { number: p.number, name: p.name, pieces: Math.round(pieces * 1000) / 1000, refs: refs.slice(0, 6).join(", ") + (refs.length > 6 ? "…" : "") },
        title: `${p.number} : éléments prêts à livrer`,
        message: `${p.name} · ${refs.slice(0, 6).join(", ")}`,
        link: "/logistics/to-deliver",
      });
    }
    if (action === "installed" || action === "received") await checkAllInstalled(p, actorId);
  });
}

async function checkAllInstalled(p, actorId) {
  const units = await TrackingUnit.find({ project: p._id, cancelled: false }).select("status").lean();
  if (!units.length || units.some((u) => !["installed", "received"].includes(u.status))) return;
  await notifyMany(without(uniq(await getDepartmentRecipientIds(p.company, "sales"), await projectManagerUserIds(p)), actorId), {
    type: "project",
    key: "allInstalled",
    params: { number: p.number, name: p.name, count: units.length },
    title: `${p.number} : tous les châssis sont posés`,
    message: `${p.name} · ${units.length} châssis — réception et facture finale`,
    link: `/production/projects/${p._id}`,
  });
}

function noteParams(note, p) {
  return { number: note.number, project: `${p.number} — ${p.name}`, date: fmtDate(note.date), pieces: note.lines.reduce((a, l) => a + l.quantity, 0), carrier: note.transport?.carrier || "" };
}

/** A delivery is planned → project manager + production (to have it ready). */
function onDeliveryPlanned(note, actorId) {
  return safe("delivery planned", async () => {
    const p = await projectOf(note.project);
    await notifyMany(without(uniq(await projectManagerUserIds(p), await getDepartmentRecipientIds(p.company, "production")), actorId), {
      type: "project",
      key: "deliveryPlanned",
      params: noteParams(note, p),
      title: `Livraison ${note.number} planifiée le ${fmtDate(note.date)}`,
      message: `${p.number} — ${p.name}`,
      link: `/logistics/delivery-notes/${note._id}`,
    });
  });
}

/** Delivery on its way → project manager (the site team) + sales. */
function onDeliveryShipped(note, actorId) {
  return safe("delivery shipped", async () => {
    const p = await projectOf(note.project);
    await notifyMany(without(uniq(await projectManagerUserIds(p), await getDepartmentRecipientIds(p.company, "sales")), actorId), {
      type: "project",
      key: "deliveryShipped",
      params: noteParams(note, p),
      title: `${note.number} en route`,
      message: `${p.number} — ${p.name}${note.transport?.carrier ? ` · ${note.transport.carrier}` : ""}`,
      link: `/logistics/delivery-notes/${note._id}`,
    });
  });
}

/** Delivered → sales (invoicing) + project manager; whole project delivered → one more alert. */
function onDeliveryDelivered(note, actorId) {
  return safe("delivery delivered", async () => {
    const p = await projectOf(note.project);
    const recipients = without(uniq(await projectManagerUserIds(p), await getDepartmentRecipientIds(p.company, "sales")), actorId);
    await notifyMany(recipients, {
      type: "project",
      key: note.reserves ? "deliveredWithReserves" : "deliveryDelivered",
      params: { ...noteParams(note, p), reserves: note.reserves || "" },
      title: `${note.number} livré${note.reserves ? " avec réserves" : ""}`,
      message: `${p.number} — ${p.name}${note.reserves ? ` · ${note.reserves}` : ""}`,
      link: `/logistics/delivery-notes/${note._id}`,
    });
    const units = await TrackingUnit.find({ project: p._id, cancelled: false }).select("status").lean();
    if (units.length && units.every((u) => ["delivered", "installed", "received"].includes(u.status))) {
      const open = await DeliveryNote.exists({ project: p._id, status: { $in: ["draft", "planned", "shipped"] } });
      if (!open) {
        await notifyMany(recipients, {
          type: "project",
          key: "projectDelivered",
          params: { number: p.number, name: p.name, count: units.length },
          title: `${p.number} entièrement livré`,
          message: `${p.name} · ${units.length} châssis — facture à émettre`,
          link: `/production/projects/${p._id}`,
        });
      }
    }
  });
}

// ------------------------------------------------------------------
// Daily checks
// ------------------------------------------------------------------

/** Work orders past their due date → the workshop team + production. */
async function checkLateOrders(now = new Date()) {
  const late = await ProductionOrder.find({ status: { $in: ["planned", "in_progress"] }, dueDate: { $ne: null, $lt: startOfDay(now) }, lateNotifiedAt: null })
    .select("number workshop company dueDate project title");
  for (const order of late) {
    const workshop = await Workshop.findById(order.workshop).select("name manager members").lean();
    await notifyMany(uniq(await workshopUserIds(workshop), await getDepartmentRecipientIds(order.company, "production")), {
      type: "production",
      key: "orderLate",
      params: { number: order.number, workshop: workshop?.name || "", date: fmtDate(order.dueDate) },
      title: `${order.number} en retard`,
      message: `${workshop?.name || ""} · échéance ${fmtDate(order.dueDate)}`,
      link: `/production/orders/${order._id}`,
    });
    order.lateNotifiedAt = now;
    await order.save();
  }
  return late.length;
}

/** Projects due within 7 days whose production isn't finished → project manager + production. */
async function checkProjectsDueSoon(now = new Date()) {
  const limit = new Date(startOfDay(now).getTime() + (PROJECT_DUE_WARNING_DAYS + 1) * DAY);
  const projects = await Project.find({ status: { $in: ["planned", "in_progress"] }, dueDate: { $ne: null, $lt: limit }, dueSoonNotifiedAt: null })
    .select("number name company manager dueDate items");
  let count = 0;
  for (const project of projects) {
    const orders = await ProductionOrder.find({ project: project._id, status: { $ne: "cancelled" } }).select("status").lean();
    const open = orders.filter((o) => o.status !== "done").length;
    const notStarted = (project.items || []).length > 0 && orders.length === 0;
    if (!open && !notStarted) continue;
    const days = Math.round((startOfDay(project.dueDate) - startOfDay(now)) / DAY);
    await notifyMany(uniq(await projectManagerUserIds(project), await getDepartmentRecipientIds(project.company, "production")), {
      type: "project",
      key: days < 0 ? "projectOverdue" : "projectDueSoon",
      params: { number: project.number, name: project.name, date: fmtDate(project.dueDate), days: Math.abs(days), open: notStarted ? "—" : open },
      title: days < 0 ? `Projet ${project.number} en retard` : `Projet ${project.number} : échéance dans ${days} j`,
      message: `${project.name} · ${notStarted ? "fabrication non lancée" : `${open} ordre(s) de fabrication non terminé(s)`}`,
      link: `/production/projects/${project._id}`,
    });
    project.dueSoonNotifiedAt = now;
    await project.save();
    count += 1;
  }
  return count;
}

/** Sent devis expiring within 3 days → their author. */
async function checkQuotesExpiring(now = new Date()) {
  const from = startOfDay(now);
  const limit = new Date(from.getTime() + (QUOTE_EXPIRY_WARNING_DAYS + 1) * DAY);
  const quotes = await Quote.find({ status: "sent", validUntil: { $ne: null, $gte: from, $lt: limit }, expiryNotifiedAt: null })
    .populate("customer", "name");
  for (const quote of quotes) {
    await notifyMany(quote.createdBy ? [String(quote.createdBy)] : await getDepartmentRecipientIds(quote.company, "sales"), {
      type: "sales",
      key: "quoteExpiring",
      params: { number: quote.number, customer: quote.customer?.name || "", date: fmtDate(quote.validUntil) },
      title: `Devis ${quote.number} expire le ${fmtDate(quote.validUntil)}`,
      message: `${quote.customer?.name || ""} · à relancer`,
      link: `/sales/quotes/${quote._id}`,
    });
    quote.expiryNotifiedAt = now;
    await quote.save();
  }
  return quotes.length;
}

/** Issued invoices past their due date, not fully paid → sales + their author. */
async function checkOverdueInvoices(now = new Date()) {
  const invoices = await SalesInvoice.find({
    type: { $ne: "credit_note" },
    status: { $in: ["issued", "partially_paid"] },
    dueDate: { $ne: null, $lt: startOfDay(now) },
    overdueNotifiedAt: null,
  }).populate("customer", "name");
  for (const invoice of invoices) {
    const due = Math.round(((invoice.totalTTC || 0) - (invoice.amountPaid || 0)) * 100) / 100;
    await notifyMany(uniq(await getDepartmentRecipientIds(invoice.company, "sales"), invoice.createdBy ? [String(invoice.createdBy)] : []), {
      type: "sales",
      key: "invoiceOverdue",
      params: { number: invoice.number || "", customer: invoice.customer?.name || "", amount: money(due), date: fmtDate(invoice.dueDate) },
      title: `Facture ${invoice.number} impayée`,
      message: `${invoice.customer?.name || ""} · ${money(due)} échu le ${fmtDate(invoice.dueDate)}`,
      link: `/sales/invoices/${invoice._id}`,
    });
    invoice.overdueNotifiedAt = now;
    await invoice.save();
  }
  return invoices.length;
}

/** Planned / shipped deliveries whose date has passed → logistics. */
async function checkLateDeliveries(now = new Date()) {
  const late = await DeliveryNote.find({ status: { $in: ["planned", "shipped"] }, date: { $lt: startOfDay(now) }, lateNotifiedAt: null }).populate("project", "number name company manager");
  for (const note of late) {
    await notifyMany(uniq(await getDepartmentRecipientIds(note.company, "logistics"), note.project ? await projectManagerUserIds(note.project) : []), {
      type: "project",
      key: "deliveryLate",
      params: { number: note.number, project: note.project ? `${note.project.number} — ${note.project.name}` : "", date: fmtDate(note.date) },
      title: `Livraison ${note.number} non confirmée`,
      message: `Prévue le ${fmtDate(note.date)} — marquez-la livrée ou replanifiez-la`,
      link: `/logistics/delivery-notes/${note._id}`,
    });
    note.lateNotifiedAt = now;
    await note.save();
  }
  return late.length;
}

async function runDailyBusinessChecks(now = new Date()) {
  const results = {};
  for (const [name, fn] of Object.entries({ checkLateOrders, checkProjectsDueSoon, checkQuotesExpiring, checkOverdueInvoices, checkLateDeliveries })) {
    results[name] = await safe(name, () => fn(now));
  }
  return results;
}

module.exports = {
  onOrdersPlanned, onOrderCreated, onOrderCompleted, onOrderCancelled, onStockChanged,
  onQuoteDecided, onPaymentRecorded,
  onTrackingChanged, onDeliveryPlanned, onDeliveryShipped, onDeliveryDelivered,
  checkLateOrders, checkProjectsDueSoon, checkQuotesExpiring, checkOverdueInvoices, checkLateDeliveries, runDailyBusinessChecks,
};
