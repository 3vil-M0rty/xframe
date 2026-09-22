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
// HR JOB HIERARCHY (User.hrRole — only meaningful for "hr"
// department accounts)
// ------------------------------------------------------------
// A real, named hierarchy — the same shape a French/Moroccan HR
// department actually has — rather than one flat "has HR access"
// bit. Ordered lowest to highest authority:
//
//   Assistant RH (hr_assistant)
//     -> day-to-day support: view records, upload/manage
//        documents, no approval or salary authority.
//   Chargé(e) RH (hr_officer)
//     -> full data-entry authority: create/edit employees,
//        contracts, process (but not APPROVE) absences/advances.
//        No salary authority, cannot delete employees.
//   Responsable RH (hr_manager)
//     -> full operational authority: approve/reject absences and
//        advances, manage salaries, delete employee records.
//        This is also the fallback level for any "hr" department
//        account with no hrRole set (see hrRoleLevel below).
//   Directeur/Directrice RH (hr_director)
//     -> everything a manager can, plus managing OTHER hr staff's
//        role/tier (canManageHRStaffRoles) — the one capability
//        below a manager does NOT have.
//
// admin/owner sit above this hierarchy entirely (unchanged from
// before this feature existed) — every function below still checks
// them first and short-circuits to "yes".
// ------------------------------------------------------------

const HR_ROLES = Object.freeze({
  ASSISTANT: "hr_assistant",
  OFFICER: "hr_officer",
  MANAGER: "hr_manager",
  DIRECTOR: "hr_director",
});

// Index in this array IS the authority level — lowest to highest.
const HR_ROLE_HIERARCHY = [HR_ROLES.ASSISTANT, HR_ROLES.OFFICER, HR_ROLES.MANAGER, HR_ROLES.DIRECTOR];

/**
 * Numeric authority level for `hasHRRoleAtLeast` comparisons.
 * -1: not in the HR department at all (and not admin/owner).
 * admin/owner: above every tier, always passes any comparison.
 * An "hr" department account with hrRole unset defaults to the
 * MANAGER tier (see the field's schema comment for why: so this
 * feature can't silently downgrade access anyone already had).
 */
function hrRoleLevel(actor) {
  if (isAdmin(actor) || isOwner(actor)) return HR_ROLE_HIERARCHY.length;
  if (!isHRDepartment(actor)) return -1;
  if (!actor.hrRole) return HR_ROLE_HIERARCHY.indexOf(HR_ROLES.MANAGER);
  const idx = HR_ROLE_HIERARCHY.indexOf(actor.hrRole);
  return idx === -1 ? HR_ROLE_HIERARCHY.indexOf(HR_ROLES.MANAGER) : idx;
}

/**
 * Is this actor's HR tier at least `minRole`? admin/owner always
 * pass. Anyone outside the HR department (and not admin/owner)
 * always fails, regardless of `minRole`.
 */
function hasHRRoleAtLeast(actor, minRole) {
  const level = hrRoleLevel(actor);
  if (level < 0) return false;
  if (isAdmin(actor) || isOwner(actor)) return true;
  return level >= HR_ROLE_HIERARCHY.indexOf(minRole);
}

/** Chargé(e) RH and above: create/edit employees, contracts, day-to-day HR records. */
function canManageEmployeeRecords(actor) {
  return hasHRRoleAtLeast(actor, HR_ROLES.OFFICER);
}

/**
 * Responsable RH and above: approve/reject absences & advances on
 * HR's behalf, manage salaries, delete employee records.
 *
 * This is DELIBERATELY separate from — and doesn't replace —
 * manager-based approval (canReviewRequest below): a line manager
 * approving their own direct report's request via Employee.manager
 * is a completely different door than an HR staffer approving on
 * HR's behalf, and keeps working regardless of that manager's
 * hrRole (they likely don't have one at all — most managers aren't
 * in the HR department).
 */
function canApproveHRRequests(actor) {
  return hasHRRoleAtLeast(actor, HR_ROLES.MANAGER);
}

function canManageSalaries(actor) {
  return hasHRRoleAtLeast(actor, HR_ROLES.MANAGER);
}

function canDeleteEmployee(actor) {
  return hasHRRoleAtLeast(actor, HR_ROLES.MANAGER);
}

/** Directeur/Directrice RH only (plus admin/owner): who may assign or change another HR staffer's hrRole. */
function canManageHRStaffRoles(actor) {
  return hasHRRoleAtLeast(actor, HR_ROLES.DIRECTOR);
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
 * - admin/owner: always (existing behavior, unchanged).
 * - HR department staff: only Responsable RH tier and above
 *   (canApproveHRRequests) — a Chargé/Assistant RH can process and
 *   view requests but the actual accept/reject decision needs
 *   manager-tier HR authority or higher.
 * - a line manager: only for requests from an employee whose
 *   `manager` field points at the reviewer's own linked employee.
 *   Pass in the requesting employee's record (with `manager`
 *   populated) once it's been fetched — this function doesn't hit
 *   the database itself.
 */
function canReviewRequest(actor, company, requestingEmployee) {
  if (isAdmin(actor)) return true;
  if (isOwner(actor)) return sameId(company?.owner, actor.id);
  if (canApproveHRRequests(actor)) return true;

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
  HR_ROLES,
  HR_ROLE_HIERARCHY,
  hrRoleLevel,
  hasHRRoleAtLeast,
  canManageEmployeeRecords,
  canApproveHRRequests,
  canManageSalaries,
  canDeleteEmployee,
  canManageHRStaffRoles,
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
