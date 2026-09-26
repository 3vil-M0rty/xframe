const mongoose = require("mongoose");
const { runAsSystem } = require("./tenantScope");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const User = require("../models/User");

/**
 * Helpers around clients (tenants). Everything here runs as
 * "system" (unscoped) on purpose — these are the lookups that BUILD
 * a request's scope, or that background jobs use to find the right
 * people for one company.
 */

/** Ids of every company owned by a client. */
async function companyIdsForTenant(tenantId) {
  if (!tenantId) return [];
  const rows = await runAsSystem(() => Company.find({ tenant: tenantId }).select("_id").lean());
  return rows.map((c) => c._id);
}

/** The client that owns a company (id, doc or populated ref accepted). */
async function tenantOfCompany(company) {
  if (!company) return null;
  if (company.tenant) return company.tenant._id || company.tenant;
  const id = company._id || company;
  if (!mongoose.Types.ObjectId.isValid(String(id))) return null;
  const row = await runAsSystem(() => Company.findById(id).select("tenant").lean());
  return row ? row.tenant : null;
}

/**
 * Attaches data created before client isolation existed to a client.
 *
 * Safe to run at every startup:
 *   - nothing to do when no record is missing its client;
 *   - when NO client exists yet (an existing single-client install),
 *     creates one ("Default client") and attaches every company,
 *     account, audit entry and email to it;
 *   - when clients already exist, attaches records whose client can
 *     be derived without guessing (a company's records via their
 *     company, an account via its linked employee's company, a
 *     company via its owner). Anything left is only reported —
 *     assigning it would be a guess.
 * platform_admin accounts are never attached to a client.
 */
async function migrateLegacyDataToTenants({ log = console.log, defaultName = "Default client" } = {}) {
  return runAsSystem(async () => {
    const orphanFilter = { $or: [{ tenant: null }, { tenant: { $exists: false } }] };
    const userOrphanFilter = { ...orphanFilter, role: { $ne: "platform_admin" } };

    const [orphanCompanies, orphanUsers] = await Promise.all([
      Company.countDocuments(orphanFilter),
      User.countDocuments(userOrphanFilter),
    ]);
    const report = { createdTenant: null, companies: 0, users: 0, auditLogs: 0, emails: 0, unresolved: 0 };
    if (!orphanCompanies && !orphanUsers) {
      await backfillCompanyLinkedLogs(report);
      return report;
    }

    const tenantCount = await Tenant.countDocuments();
    if (tenantCount === 0) {
      const tenant = await Tenant.create({ name: defaultName });
      report.createdTenant = tenant._id;
      report.companies = (await Company.updateMany(orphanFilter, { $set: { tenant: tenant._id } })).modifiedCount;
      report.users = (await User.updateMany(userOrphanFilter, { $set: { tenant: tenant._id } })).modifiedCount;
      const AuditLog = require("../models/AuditLog");
      const EmailOutbox = require("../models/EmailOutbox");
      report.auditLogs = (await AuditLog.updateMany(orphanFilter, { $set: { tenant: tenant._id } })).modifiedCount;
      report.emails = (await EmailOutbox.updateMany(orphanFilter, { $set: { tenant: tenant._id } })).modifiedCount;
      log(
        `[tenants] Existing data attached to new client "${defaultName}" ` +
          `(${report.companies} companies, ${report.users} accounts).`
      );
      return report;
    }

    // Clients exist: only attach what can be derived.
    const companies = await Company.find(orphanFilter).select("owner").lean();
    for (const c of companies) {
      const owner = c.owner ? await User.findById(c.owner).select("tenant").lean() : null;
      if (owner && owner.tenant) {
        await Company.updateOne({ _id: c._id }, { $set: { tenant: owner.tenant } });
        report.companies += 1;
      } else report.unresolved += 1;
    }
    const Employee = require("../models/Employee");
    const users = await User.find(userOrphanFilter).select("employee").lean();
    for (const u of users) {
      const emp = u.employee ? await Employee.findById(u.employee).select("company").lean() : null;
      const tenant = emp ? await tenantOfCompany(emp.company) : null;
      if (tenant) {
        await User.updateOne({ _id: u._id }, { $set: { tenant } });
        report.users += 1;
      } else report.unresolved += 1;
    }
    await backfillCompanyLinkedLogs(report);
    if (report.unresolved) {
      log(
        `[tenants] WARNING: ${report.unresolved} company/account record(s) have no client and none could be derived. ` +
          "They are unreachable until a platform admin assigns them (see routes/platform.js)."
      );
    }
    return report;
  });
}

/** AuditLog/EmailOutbox rows that have a company but no client yet. */
async function backfillCompanyLinkedLogs(report) {
  const AuditLog = require("../models/AuditLog");
  const EmailOutbox = require("../models/EmailOutbox");
  for (const [Model, key] of [[AuditLog, "auditLogs"], [EmailOutbox, "emails"]]) {
    const companyIds = await Model.distinct("company", { tenant: null, company: { $ne: null } });
    for (const companyId of companyIds) {
      const tenant = await tenantOfCompany(companyId);
      if (!tenant) continue;
      const res = await Model.updateMany({ tenant: null, company: companyId }, { $set: { tenant } });
      report[key] += res.modifiedCount;
    }
  }
}

/**
 * Why an account may NOT use the app right now because of its
 * client, or null when it may. Checked at login and on every request
 * (middleware/auth.js), so suspending a client cuts off sessions
 * already open.
 */
async function accountAccessProblem(user) {
  if (!user) return { status: 401, message: "Account no longer exists" };
  if (user.role === "platform_admin") return null;
  if (!user.tenant) {
    return { status: 403, message: "This account is not attached to a client. Contact the platform administrator." };
  }
  const tenant = await runAsSystem(() => Tenant.findById(user.tenant).select("status").lean());
  if (!tenant) return { status: 403, message: "This account's client no longer exists." };
  if (tenant.status === "suspended") {
    return { status: 403, message: "Access to this workspace is suspended. Contact the platform administrator." };
  }
  return null;
}

module.exports = { companyIdsForTenant, tenantOfCompany, migrateLegacyDataToTenants, accountAccessProblem };
