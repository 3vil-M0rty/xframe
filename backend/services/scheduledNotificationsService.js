const Contract = require("../models/Contract");
const EmployeeDocument = require("../models/EmployeeDocument");
const { notifyMany, getHRRecipientIds } = require("./notificationService");

/**
 * ============================================================
 * SCHEDULED HR NOTIFICATIONS
 * ============================================================
 * The `contract_expiring` and `document_expiring` types have
 * existed on the Notification model since it was written, but
 * nothing ever created one — there was no scheduled job of any
 * kind in this backend. This is that job: once a day, find
 * contracts and employee documents entering their expiry warning
 * window and notify each company's HR staff.
 *
 * Deliberately NOT using a cron library — a single `setInterval`
 * in server.js calling `runDailyHRChecks` once a day (plus once at
 * startup) is all "run this daily" needs here, and it's one fewer
 * dependency to install/maintain for something this simple. If a
 * proper cron schedule (specific time of day, multiple schedules,
 * etc.) is ever needed, that's the point to bring in node-cron —
 * this module's two check functions wouldn't need to change at all.
 *
 * Each contract/document is only notified ONCE per expiry date
 * (see `expiryNotifiedAt` on both schemas) — running this job more
 * than once a day, or restarting the server repeatedly, never
 * spams HR with duplicate notifications for the same expiring item.
 * ============================================================
 */

const WARNING_WINDOW_DAYS = 30;

function daysUntil(date, now) {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

async function checkExpiringContracts(now = new Date()) {
  const windowEnd = new Date(now.getTime() + WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const contracts = await Contract.find({
    status: "active",
    endDate: { $ne: null, $gte: now, $lte: windowEnd },
    expiryNotifiedAt: null,
  })
    .populate("employee", "firstName lastName")
    .populate("company");

  let notifiedCount = 0;

  for (const contract of contracts) {
    const company = contract.company;
    if (!company) continue; // eslint-disable-line no-continue

    // eslint-disable-next-line no-await-in-loop
    const hrIds = await getHRRecipientIds(company);
    const employeeName = `${contract.employee?.firstName || ""} ${contract.employee?.lastName || ""}`.trim() || "An employee";
    const daysLeft = daysUntil(contract.endDate, now);

    // eslint-disable-next-line no-await-in-loop
    await notifyMany(hrIds, {
      type: "contract_expiring",
      title: "Contract ending soon",
      message: `${employeeName}'s contract ends in ${daysLeft} day(s) (${contract.endDate.toLocaleDateString("fr-FR")}).`,
      link: "/hr/contracts",
    });

    contract.expiryNotifiedAt = now;
    // eslint-disable-next-line no-await-in-loop
    await contract.save();
    notifiedCount += 1;
  }

  return notifiedCount;
}

async function checkExpiringDocuments(now = new Date()) {
  const windowEnd = new Date(now.getTime() + WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const documents = await EmployeeDocument.find({
    expiryDate: { $ne: null, $gte: now, $lte: windowEnd },
    expiryNotifiedAt: null,
  })
    .populate("employee", "firstName lastName")
    .populate("company");

  let notifiedCount = 0;

  for (const doc of documents) {
    const company = doc.company;
    if (!company) continue; // eslint-disable-line no-continue

    // eslint-disable-next-line no-await-in-loop
    const hrIds = await getHRRecipientIds(company);
    const employeeName = `${doc.employee?.firstName || ""} ${doc.employee?.lastName || ""}`.trim() || "An employee";
    const daysLeft = daysUntil(doc.expiryDate, now);
    const docLabel = doc.label || doc.type || "document";

    // eslint-disable-next-line no-await-in-loop
    await notifyMany(hrIds, {
      type: "document_expiring",
      title: "Document expiring soon",
      message: `${employeeName}'s ${docLabel} expires in ${daysLeft} day(s) (${doc.expiryDate.toLocaleDateString("fr-FR")}).`,
      link: "/hr/documents",
    });

    doc.expiryNotifiedAt = now;
    // eslint-disable-next-line no-await-in-loop
    await doc.save();
    notifiedCount += 1;
  }

  return notifiedCount;
}

async function runDailyHRChecks() {
  try {
    const now = new Date();
    const [contractsNotified, documentsNotified] = await Promise.all([
      checkExpiringContracts(now),
      checkExpiringDocuments(now),
    ]);
    console.log(
      `[scheduledNotifications] Daily HR check complete — ` +
      `${contractsNotified} contract(s), ${documentsNotified} document(s) notified.`
    );
  } catch (error) {
    // A failed check must never crash the server — it just tries
    // again on the next scheduled run (tomorrow).
    console.error("[scheduledNotifications] Daily HR check failed:", error);
  }
}

module.exports = {
  runDailyHRChecks,
  checkExpiringContracts,
  checkExpiringDocuments,
  WARNING_WINDOW_DAYS,
};
