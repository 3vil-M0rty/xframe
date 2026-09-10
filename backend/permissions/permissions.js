/**
 * ============================================================
 * PERMISSIONS
 * ============================================================
 * Single source of truth for role-based access control (RBAC).
 *
 * Roles (User.role):
 *   - admin  : platform-wide super user. Manages every company
 *              and every user, everywhere.
 *   - owner  : manages the company/companies they own, and the
 *              users that belong to that company.
 *   - user   : a normal employee. Cannot manage companies.
 *              TODAY: cannot manage users either.
 *              FUTURE: will be allowed to create/manage other
 *              "user"-role accounts, but ONLY inside their own
 *              department, and NEVER at admin/owner level.
 *              That rule is already implemented below
 *              (see canCreateUser / canManageUser) so turning it
 *              on later is just a matter of flipping the flag
 *              below — no logic needs to change.
 * ============================================================
 */

const ROLES = Object.freeze({
  ADMIN: "admin",
  OWNER: "owner",
  USER: "user",
});

const ALL_ROLES = Object.values(ROLES);

// Roles that are considered "top level" / administrative.
// A department-scoped "user" is never allowed to create or
// promote anyone into these roles.
const TOP_LEVEL_ROLES = [ROLES.ADMIN, ROLES.OWNER];

/**
 * Feature flag for the "user can create users in their own
 * department" capability described as a "later on" feature.
 * The permission logic already fully supports it (see
 * canCreateUser / canManageUser / userListFilter) — flip this to
 * `true` when you're ready to ship it. Nothing else needs to
 * change in routes or middleware.
 */
const ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT = false;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;
const isOwner = (actor) => actor?.role === ROLES.OWNER;
const isPlainUser = (actor) => actor?.role === ROLES.USER;

const sameId = (a, b) => !!a && !!b && a.toString() === b.toString();

// ------------------------------------------------------------
// COMPANIES
// ------------------------------------------------------------

/**
 * Who may create a company at all (record-independent check).
 */
function canCreateCompany(actor) {
  return isAdmin(actor) || isOwner(actor);
}

/**
 * Who may view/edit/delete a *specific* company.
 * - admin: any company
 * - owner: only companies they own
 * - user : never
 */
function canManageCompany(actor, company) {
  if (!actor || !company) return false;
  if (isAdmin(actor)) return true;
  if (isOwner(actor)) return sameId(company.owner, actor.id);
  return false;
}

const canDeleteCompany = canManageCompany;

// ------------------------------------------------------------
// USERS
// ------------------------------------------------------------

/**
 * Who may create a user, and with which role/department.
 *
 * - admin: can create a user with any role, any department.
 * - owner: can create a user with any role, any department
 *          (today owners administer their whole company; once
 *          companyId scoping is added to the User model this is
 *          the natural place to also require same-company).
 * - user : (future) can only create role "user" accounts, and
 *          only within their own department. Cannot create
 *          admin/owner accounts under any circumstance.
 */
function canCreateUser(actor, targetRole, targetDepartment) {
  if (!actor) return false;

  if (isAdmin(actor) || isOwner(actor)) return true;

  if (isPlainUser(actor)) {
    if (!ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT) return false;

    const isTopLevel = TOP_LEVEL_ROLES.includes(targetRole);
    if (isTopLevel) return false;

    if (targetDepartment && targetDepartment !== actor.department) {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Who may view/edit a specific target user.
 * - anyone may manage themselves (profile edits, password, etc.)
 * - admin/owner may manage anyone
 * - user (future) may manage other "user"-role accounts in their
 *   own department only, and can never touch admin/owner accounts
 */
function canManageUser(actor, targetUser) {
  if (!actor || !targetUser) return false;

  if (sameId(actor.id, targetUser._id || targetUser.id)) return true;
  if (isAdmin(actor) || isOwner(actor)) return true;

  if (isPlainUser(actor)) {
    if (!ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT) return false;

    if (TOP_LEVEL_ROLES.includes(targetUser.role)) return false;
    return targetUser.department === actor.department;
  }

  return false;
}

/**
 * Who may delete a user.
 * - admin/owner: anyone (except themselves — no self-delete)
 * - user (future): other "user"-role accounts in their own
 *   department only. Same boundary as canManageUser — a
 *   department-scoped user can never touch an admin/owner
 *   account, and can never delete themselves.
 */
function canDeleteUser(actor, targetUser) {
  if (!actor || !targetUser) return false;
  if (sameId(actor.id, targetUser._id || targetUser.id)) return false; // no self-delete

  if (isAdmin(actor) || isOwner(actor)) return true;

  if (isPlainUser(actor) && ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT) {
    if (TOP_LEVEL_ROLES.includes(targetUser.role)) return false;
    return targetUser.department === actor.department;
  }

  return false;
}

/**
 * Which users an actor is allowed to LIST/see.
 * Returns a Mongo filter object to apply to User.find().
 * - admin/owner: no restriction (see everyone)
 * - user (future): only their own department
 */
function userListFilter(actor) {
  if (isAdmin(actor) || isOwner(actor)) return {};

  if (isPlainUser(actor) && ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT) {
    return { department: actor.department };
  }

  // Today: a plain "user" role has no user-management screen at
  // all on the frontend, but if this endpoint is ever hit
  // directly, default to "only yourself" rather than leaking
  // the full user list.
  return { _id: actor.id };
}

module.exports = {
  ROLES,
  ALL_ROLES,
  TOP_LEVEL_ROLES,
  ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT,
  canCreateCompany,
  canManageCompany,
  canDeleteCompany,
  canCreateUser,
  canManageUser,
  canDeleteUser,
  userListFilter,
};
