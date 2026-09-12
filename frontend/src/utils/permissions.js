/**
 * ============================================================
 * FRONTEND PERMISSIONS
 * ============================================================
 * Mirrors backend/permissions/permissions.js so the UI can hide
 * actions a user isn't allowed to perform, instead of only
 * finding out from a 403 after clicking. This is a UX layer
 * only — the backend is the real gate and enforces every one of
 * these rules independently, so nothing here needs to be
 * "trusted".
 *
 * Keep these two files in sync when the rules change.
 * ============================================================ */

export const ROLES = Object.freeze({
  ADMIN: "admin",
  OWNER: "owner",
  USER: "user",
});

const TOP_LEVEL_ROLES = [ROLES.ADMIN, ROLES.OWNER];

/**
 * Same flag as the backend. Flip both together when the
 * "user manages users in their own department" feature ships.
 */
export const ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT = false;

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;
const isOwner = (actor) => actor?.role === ROLES.OWNER;
const isPlainUser = (actor) => actor?.role === ROLES.USER;

const sameId = (a, b) => !!a && !!b && a.toString() === b.toString();

// ------------------------------------------------------------
// HR MODULE (Employees, Salaries, Absences, Advances)
// ------------------------------------------------------------
// Single source of truth, mirroring backend/permissions/permissions.js,
// for "who can see/use the HR module at all" — the sidebar's HR
// section, the /hr/* routes, and every HR page's own internal
// buttons all key off this ONE function. To change who has HR
// access app-wide, edit `canAccessHR` here (and its backend
// twin); nothing else needs to change.
//
// - admin: full access.
// - owner: full access (record-level company ownership is still
//   enforced by the backend for owners).
// - user with department "hr": full access. Plain "user" accounts
//   aren't scoped to a specific company yet, so this is
//   unavoidably all-or-nothing today, same as the backend.
// ------------------------------------------------------------

export const HR_DEPARTMENT = "hr";

const isHRDepartment = (actor) => actor?.department === HR_DEPARTMENT;

export function canAccessHR(actor) {
  return isAdmin(actor) || isOwner(actor) || isHRDepartment(actor);
}

// ------------------------------------------------------------
// Companies
// ------------------------------------------------------------

export function canCreateCompany(actor) {
  return isAdmin(actor) || isOwner(actor);
}

export function canManageCompany(actor, company) {
  if (!actor || !company) return false;
  if (isAdmin(actor)) return true;
  if (isOwner(actor)) return sameId(company.owner, actor.id || actor._id);
  return false;
}

export const canDeleteCompany = canManageCompany;

// ------------------------------------------------------------
// Users
// ------------------------------------------------------------

export function canCreateUser(actor) {
  if (!actor) return false;
  if (isAdmin(actor) || isOwner(actor)) return true;
  return isPlainUser(actor) && ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT;
}

export function canManageUser(actor, targetUser) {
  if (!actor || !targetUser) return false;
  if (sameId(actor.id || actor._id, targetUser._id || targetUser.id)) return true;
  if (isAdmin(actor) || isOwner(actor)) return true;

  if (isPlainUser(actor) && ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT) {
    if (TOP_LEVEL_ROLES.includes(targetUser.role)) return false;
    return targetUser.department === actor.department;
  }

  return false;
}

export function canDeleteUser(actor, targetUser) {
  if (!actor || !targetUser) return false;
  if (sameId(actor.id || actor._id, targetUser._id || targetUser.id)) return false;

  if (isAdmin(actor) || isOwner(actor)) return true;

  if (isPlainUser(actor) && ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT) {
    if (TOP_LEVEL_ROLES.includes(targetUser.role)) return false;
    return targetUser.department === actor.department;
  }

  return false;
}
