const AuditLog = require("../models/AuditLog");

/**
 * Records one audit-log entry. Deliberately fire-and-forget-safe:
 * failures here are logged to the console but never thrown, so a
 * logging bug can never block the actual business operation it's
 * describing.
 *
 * @param {Object} req - Express request (reads req.user as the actor)
 * @param {Object} params
 * @param {"create"|"update"|"delete"|"review"} params.action
 * @param {string} params.resourceType - e.g. "Employee", "Salary"
 * @param {string} params.resourceId
 * @param {string} [params.resourceLabel]
 * @param {*} [params.before]
 * @param {*} [params.after]
 * @param {string} [params.company]
 */
async function logAudit(req, params) {
  try {
    await AuditLog.create({
      company: params.company || null,
      actor: req.user?.id,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceLabel: params.resourceLabel,
      before: params.before ?? null,
      after: params.after ?? null,
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}

module.exports = { logAudit };
