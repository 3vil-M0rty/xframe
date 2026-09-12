const { ROLES, canAccessHR } = require("../permissions/permissions");

/**
 * requireRole('admin', 'owner')
 *
 * Coarse, route-level gate: rejects the request before it even
 * touches the database if the authenticated user's role isn't
 * in the allowed list. Use this for actions that are ALWAYS
 * restricted to certain roles regardless of which record is
 * being touched (e.g. "only admin/owner may create a company").
 *
 * For checks that also depend on which specific record is being
 * touched (e.g. "an owner may only edit companies they own"),
 * use the functions in permissions/permissions.js directly
 * inside the route handler, after the record has been fetched.
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action",
    });
  }
  next();
};

// Convenience shorthand for the very common "admin or owner" gate
const requireAdminOrOwner = requireRole(ROLES.ADMIN, ROLES.OWNER);

/**
 * Coarse, route-level gate for the entire HR module (employees,
 * salaries, absences, advances, and any future HR resource).
 * Mirrors `canAccessHR` in permissions/permissions.js — that's
 * the ONE place that decides who counts as "HR" (admin, owner, or
 * a user in the "hr" department). To change who can use the HR
 * module app-wide, edit `canAccessHR` there; nothing here or in
 * any HR route needs to change.
 */
const requireHRAccess = (req, res, next) => {
  if (!canAccessHR(req.user)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to access the HR module",
    });
  }
  next();
};

module.exports = {
  requireRole,
  requireAdminOrOwner,
  requireHRAccess,
};
