const Notification = require("../models/Notification");
const User = require("../models/User");
const { tenantOfCompany } = require("./tenantService");

/**
 * Restricts a recipient query to the company's client. Inside a
 * request the isolation plugin already does this; background jobs
 * run unscoped (system context), so without this an admin of client
 * A would get client B's alerts.
 */
async function forCompanyClient(company, filter) {
  const tenant = await tenantOfCompany(company);
  // Unknown client → nobody (never "everybody").
  return { $and: [filter, { tenant: tenant || null }, { role: { $ne: "platform_admin" } }] };
}

/**
 * Finds the User accounts that should be notified about HR events
 * for a given company: platform admins, the company's owner, and
 * any "hr" department user. (Mirrors canAccessHRForCompany in
 * permissions/permissions.js — these are exactly the people that
 * function says can manage this company's HR data.)
 */
async function getHRRecipientIds(company) {
  const users = await User.find(await forCompanyClient(company, {
    $or: [
      { role: "admin" },
      { _id: company?.owner },
      { department: "hr" },
    ],
  })).select("_id");

  return users.map((u) => u._id.toString());
}

/**
 * Finds the User accounts that should be notified about Production
 * events for a given company: platform admins and any "production"
 * department user. (Mirrors canAccessProduction in
 * permissions/permissions.js.) `excludeUserId`, if given, is left
 * out of the result — used so the person who just submitted a
 * purchase request doesn't get notified about their own submission.
 */
async function getProductionRecipientIds(company, excludeUserId) {
  const users = await User.find(await forCompanyClient(company, {
    $or: [
      { role: "admin" },
      { department: "production" },
    ],
  })).select("_id");

  return users
    .map((u) => u._id.toString())
    .filter((id) => id !== String(excludeUserId || ""));
}

/**
 * Creates an in-app notification for one user. This is the ONE
 * place to wire in real email/SMS later (e.g. call a mailer here
 * after the Notification.create) — every call site in the app
 * routes through this function already, so nothing else needs to
 * change when that's added.
 */
async function notify(userId, { type, title, message, link }) {
  if (!userId) return null;

  try {
    return await Notification.create({
      user: userId,
      type,
      title,
      message,
      link,
    });
  } catch (error) {
    console.error("Notification create failed:", error);
    return null;
  }
}

/**
 * Notify every user in `userIds` with the same notification.
 */
async function notifyMany(userIds = [], payload) {
  return Promise.all(
    [...new Set(userIds.filter(Boolean).map(String))].map((id) =>
      notify(id, payload)
    )
  );
}

/** Everyone who works purchase requests: admins + purchasing department. */
async function getPurchasingRecipientIds(company, excludeUserId) {
  const users = await User.find(
    await forCompanyClient(company, { $or: [{ role: "admin" }, { department: "purchasing" }] })
  ).select("_id");
  return users.map((u) => u._id.toString()).filter((id) => id !== String(excludeUserId || ""));
}

module.exports = { notify, notifyMany, getHRRecipientIds, getProductionRecipientIds, getPurchasingRecipientIds };
