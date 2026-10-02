const { runAsSystem } = require("./tenantScope");

/**
 * ============================================================
 * CLIENT QUOTAS — companies & employees per client (tenant)
 * ============================================================
 * The platform operator sets Tenant.limits.maxCompanies and
 * Tenant.limits.maxEmployees (null = unlimited). Every place that
 * creates a company or an employee (or brings a terminated employee
 * back) asks here first.
 *
 * Employees counted: every employee of the client's companies except
 * terminated ones — letting someone go frees a seat.
 * ============================================================
 */

const COUNTED_EMPLOYEES = { employmentStatus: { $ne: "terminated" } };

function cleanLimit(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined = invalid
}

/** Usage + limits of a client: { maxCompanies, maxEmployees, companies, employees }. */
async function tenantUsage(tenantId) {
  if (!tenantId) return { maxCompanies: null, maxEmployees: null, companies: 0, employees: 0 };
  const Tenant = require("../models/Tenant");
  const Company = require("../models/Company");
  const Employee = require("../models/Employee");
  return runAsSystem(async () => {
    const tenant = await Tenant.findById(tenantId).select("limits").lean();
    const companyIds = (await Company.find({ tenant: tenantId }).select("_id").lean()).map((c) => c._id);
    const employees = companyIds.length
      ? await Employee.countDocuments({ company: { $in: companyIds }, ...COUNTED_EMPLOYEES })
      : 0;
    return {
      maxCompanies: tenant?.limits?.maxCompanies ?? null,
      maxEmployees: tenant?.limits?.maxEmployees ?? null,
      companies: companyIds.length,
      employees,
    };
  });
}

/**
 * Returns null when allowed, else { message, usage, requested? } —
 * send back with HTTP 403 (see quotaResponse).
 */
async function companyQuotaError(tenantId, adding = 1) {
  const u = await tenantUsage(tenantId);
  if (u.maxCompanies === null || u.companies + adding <= u.maxCompanies) return null;
  return { usage: u, message: `Company limit reached (${u.companies}/${u.maxCompanies}). Ask the platform to raise your quota.` };
}

async function employeeQuotaError(tenantId, adding = 1) {
  const u = await tenantUsage(tenantId);
  if (u.maxEmployees === null || u.employees + adding <= u.maxEmployees) return null;
  const left = Math.max(u.maxEmployees - u.employees, 0);
  return {
    usage: u,
    requested: adding,
    message: adding > 1
      ? `Employee limit: ${left} seat(s) left of ${u.maxEmployees}, ${adding} requested. Ask the platform to raise your quota.`
      : `Employee limit reached (${u.employees}/${u.maxEmployees}). Ask the platform to raise your quota.`,
  };
}

/** Sends the standard 403 for a quota error. */
function quotaResponse(res, code, q) {
  return res.status(403).json({ success: false, code, message: q.message, quota: q.usage, requested: q.requested || 1 });
}

module.exports = { quotaResponse, tenantUsage, companyQuotaError, employeeQuotaError, cleanLimit, COUNTED_EMPLOYEES };
