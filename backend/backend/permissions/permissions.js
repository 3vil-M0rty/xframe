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
// HR MODULE (Employees, Salaries, Absences, Advances)
// ------------------------------------------------------------
// Single source of truth for "who can use the HR module at all".
// Every HR resource (employees, salaries, absences, advances, and
// any future one — job positions, leave policies, etc.) should be
// gated by these two functions ONLY. To change who has HR access
// app-wide, edit `isHRDepartment` / `canAccessHR` here — nothing
// else needs to change.
//
// - admin: full access, every company.
// - owner: full access, but only to companies they own (checked
//   via canAccessHRForCompany, same rule as canManageCompany).
// - user with department "hr": full access, every company. The
//   User model has no company-scoping field yet (only Company.owner
//   links a company to a user), so an HR-department "user" role
//   account is necessarily unscoped today — there's no company to
//   scope them to. Add that scoping here (and nowhere else) once
//   users can belong to a specific company.
// ------------------------------------------------------------

const HR_DEPARTMENT = "hr";

const isHRDepartment = (actor) => actor?.department === HR_DEPARTMENT;

/**
 * Record-independent check: is this actor allowed into the HR
 * module at all? Use this for route-level middleware
 * (requireHRAccess) and for frontend nav/route gating.
 */
function canAccessHR(actor) {
  return isAdmin(actor) || isOwner(actor) || isHRDepartment(actor);
}

/**
 * Record-level check: is this actor allowed to touch HR data
 * (an employee, salary, absence, advance, ...) belonging to this
 * specific `company`? Use this inside route handlers once the
 * relevant company has been fetched.
 */
function canAccessHRForCompany(actor, company) {
  if (!actor || !company) return false;
  if (isAdmin(actor)) return true;
  if (isOwner(actor)) return sameId(company.owner, actor.id);
  if (isHRDepartment(actor)) return true;
  return false;
}

// ------------------------------------------------------------
// PRODUCTION MODULE (Inventory, categories, purchase requests)
// ------------------------------------------------------------
// Deliberately NARROWER than the HR module: only platform admins
// and users in the "production" department — NOT owners by
// default, unlike canAccessHR. If that needs to change later,
// this is the one place to do it.
// ------------------------------------------------------------

const PRODUCTION_DEPARTMENT = "production";

const isProductionDepartment = (actor) => actor?.department === PRODUCTION_DEPARTMENT;

function canAccessProduction(actor) {
  return isAdmin(actor) || isProductionDepartment(actor);
}

// ------------------------------------------------------------
// SELF-SERVICE (My Space) + MANAGER APPROVAL ROUTING
// ------------------------------------------------------------
// A User account can optionally be linked to one Employee record
// (User.employee). That link is what unlocks:
//   - the self-service space (My Profile / My Payslips / My
//     Absences / My Advances / My Leave Balance / My Attendance)
//   - manager-based approval: if the employee who submitted an
//     absence/advance request has a manager (Employee.manager),
//     and that manager also has a linked User account, the manager
//     can review THAT employee's request without needing full HR
//     access.
// HR/admin/owner can always do everything self-service can do for
// any employee, plus review any request — this only ADDS a narrow
// extra door for managers and employees over their own data, it
// never removes the HR module's existing access.
// ------------------------------------------------------------

/**
 * Does this actor have a self-service space at all?
 */
function canSelfService(actor) {
  return !!actor?.employee;
}

/**
 * Is `employeeId` the actor's own linked employee record? Use this
 * to scope self-service routes ("my payslips", "my absences", ...)
 * so someone can only ever read/act on their own data.
 */
function isOwnEmployeeRecord(actor, employeeId) {
  return canSelfService(actor) && sameId(actor.employee, employeeId);
}

/**
 * Who may review (accept/reject) an absence or advance request.
 * - HR/admin/owner: always (existing behavior, unchanged).
 * - a manager: only for requests from an employee whose
 *   `manager` field points at the reviewer's own linked employee.
 *   Pass in the requesting employee's record (with `manager`
 *   populated) once it's been fetched — this function doesn't hit
 *   the database itself.
 */
function canReviewRequest(actor, company, requestingEmployee) {
  if (canAccessHRForCompany(actor, company)) return true;

  if (canSelfService(actor) && requestingEmployee?.manager) {
    return sameId(actor.employee, requestingEmployee.manager);
  }

  return false;
}

const canReviewAbsence = canReviewRequest;
const canReviewAdvance = canReviewRequest;

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
  HR_DEPARTMENT,
  isHRDepartment,
  isAdmin,
  canAccessHR,
  canAccessHRForCompany,
  PRODUCTION_DEPARTMENT,
  isProductionDepartment,
  canAccessProduction,
  canSelfService,
  isOwnEmployeeRecord,
  canReviewRequest,
  canReviewAbsence,
  canReviewAdvance,
  canCreateCompany,
  canManageCompany,
  canDeleteCompany,
  canCreateUser,
  canManageUser,
  canDeleteUser,
  userListFilter,
};
