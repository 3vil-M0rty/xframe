/**
 * ============================================================
 * PERMISSIONS
 * ============================================================
 * Single source of truth for role-based access control (RBAC).
 *
 * Roles (User.role):
 *   - admin  : the client's super user. Manages every company
 *              and every user OF ITS CLIENT (tenant) — never
 *              another client's; that boundary is enforced for
 *              every query by services/tenantScope.js, so the
 *              checks below never need to repeat it.
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
 *
 *   - platform_admin (not in ROLES on purpose): the platform
 *              operator. Belongs to no client, passes none of the
 *              checks below, and only uses routes/platform.js.
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
// Fine-grained permissions (config/permissionCatalog.js). Every module
// check below reads the actor's permission set — the department's
// default profile unless their manager customised it.
const { has, hasAny, hasPrefix } = require("../services/permissionService");
const isOwner = (actor) => actor?.role === ROLES.OWNER;
const isPlainUser = (actor) => actor?.role === ROLES.USER;

const sameId = (a, b) => !!a && !!b && a.toString() === b.toString();

/**
 * An owner runs every company of their client (a client can have
 * several companies — a group with subsidiaries): the company they
 * created, or any company of the same client (Company.tenant).
 */
function ownsCompany(actor, company) {
  if (!actor || !company) return false;
  const ownerId = company.owner?._id || company.owner;
  if (sameId(ownerId, actor.id)) return true;
  const tenantId = company.tenant?._id || company.tenant;
  return !!actor.tenant && !!tenantId && sameId(tenantId, actor.tenant);
}

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
  return isAdmin(actor) || isOwner(actor) || hasPrefix(actor, "hr");
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
  if (isOwner(actor)) return ownsCompany(actor, company);
  return hasPrefix(actor, "hr");
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
  return isAdmin(actor) || isOwner(actor) || has(actor, "hr.employees.edit");
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
function canApproveHRRequests(actor, kind = null) {
  if (isAdmin(actor) || isOwner(actor)) return true;
  if (kind) return has(actor, `hr.${kind}.approve`);
  return hasAny(actor, ["hr.absences.approve", "hr.advances.approve"]);
}

function canManageSalaries(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "hr.salaries.edit");
}

function canDeleteEmployee(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "hr.employees.delete");
}

/** Directeur/Directrice RH only (plus admin/owner): who may assign or change another HR staffer's hrRole. */
function canManageHRStaffRoles(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "hr.staffRoles.manage");
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
const LOGISTICS_DEPARTMENT = "logistics"; // eslint-disable-line no-unused-vars

const isProductionDepartment = (actor) => actor?.department === PRODUCTION_DEPARTMENT;

/**
 * Production management (every workshop) — not just running one.
 * "production.workshops.all" (production manager / production department).
 * Older custom profiles: "edit work orders" without belonging to any
 * workshop also means every workshop. A chef d'atelier holds the work-order
 * permissions too, but only for his workshop(s) (canWorkInWorkshop).
 */
function canAccessProduction(actor) {
  if (isAdmin(actor) || has(actor, "production.workshops.all")) return true;
  return has(actor, "production.orders.edit") && !(actor?.workshops || []).length;
}

// ------------------------------------------------------------
// PURCHASING (service achats)
// ------------------------------------------------------------
// Same model as production: admins, plus logins whose department
// resolves to "purchasing" (a Department with permissionKey
// "purchasing", via a position that grants module access, or its
// manager — see services/employeeAccountService.js).
const PURCHASING_DEPARTMENT = "purchasing";
const isPurchasingDepartment = (actor) => actor?.department === PURCHASING_DEPARTMENT;

// Owners are included: they approve large purchase orders (see
// routes/purchaseOrders.js — approval threshold), so they must be able
// to open the module and the order they're asked to approve.
function canAccessPurchasing(actor) {
  return isAdmin(actor) || isOwner(actor) || hasPrefix(actor, "purchasing");
}

// ------------------------------------------------------------
// SALES (ventes: clients, devis, factures, encaissements)
// ------------------------------------------------------------
// Admins, owners, and logins whose department resolves to "sales"
// (a Department with permissionKey "sales").
const SALES_DEPARTMENT = "sales"; // eslint-disable-line no-unused-vars
function canAccessSales(actor) {
  return isAdmin(actor) || isOwner(actor) || hasPrefix(actor, "sales");
}

// ------------------------------------------------------------
// PROJECTS (production: affaires / chantiers)
// ------------------------------------------------------------
// Production runs projects; sales follows them (to invoice) and
// purchasing links purchase orders to them. Owners see them too.
function canViewProjects(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "projects.projects.view");
}
function canManageProjects(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "projects.projects.edit");
}

// ------------------------------------------------------------
// LOGISTICS (logistique: chassis ready to deliver, delivery notes)
// ------------------------------------------------------------
// Admins, owners, production and the "logistics" department deliver.
// Chassis tracking (made / ready / installed) is updated by production,
// logistics and owners; everyone who sees projects can read it.
// Production no longer sees logistics by default: marking elements
// started / made / ready is "production.tracking.update"; delivery notes
// and installed / accepted are the logistics department's.
function canAccessLogistics(actor) {
  return isAdmin(actor) || isOwner(actor) || hasAny(actor, ["logistics.toDeliver.view", "logistics.notes.view"]);
}
function canUpdateTracking(actor) {
  return isAdmin(actor) || isOwner(actor) || hasAny(actor, ["production.tracking.update", "logistics.tracking.update"]);
}

// ------------------------------------------------------------
// WORKSHOPS (ateliers: Laquage, Aluminium, Vitrage…) & CATALOGUE
// ------------------------------------------------------------
// Production configures everything (workshops, colours, series,
// chassis models). A workshop's manager and members — who may sit in
// any department — work their own workshop's orders (start, book
// consumptions, complete). Sales reads the catalogue to price devis.
const inWorkshop = (actor, workshopId) => (actor?.workshops || []).some((id) => String(id) === String(workshopId?._id || workshopId));

function canConfigureProduction(actor) {
  return isAdmin(actor) || hasAny(actor, ["production.config.edit", "production.catalog.edit"]);
}
function canUseWorkshops(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "production.orders.view");
}
/** Production managers work every workshop; others only the ones they belong to. */
function canWorkInWorkshop(actor, workshopId) {
  return canAccessProduction(actor) || isOwner(actor) || inWorkshop(actor, workshopId);
}
function canViewCatalog(actor) {
  return isAdmin(actor) || isOwner(actor) || hasAny(actor, ["production.catalog.view", "production.config.view", "production.orders.view", "projects.projects.view", "sales.quotes.view"]);
}

// ------------------------------------------------------------
// AMOUNTS (prices, costs, margins, budgets)
// ------------------------------------------------------------
// Workshop staff, production and logistics run the chassis without
// seeing money: sale prices, project revenue / costs / margins,
// budgets, cost prices of articles, hourly rates, pricing rules.
// Admins, owners, sales, finance, accounting and management see them —
// and any other login the admin ticks "Voir les montants" for
// (User.showFinancials, e.g. a production manager who follows costs).
const FINANCIAL_DEPARTMENTS = ["sales", "finance", "accounting", "management"];
function canSeeFinancials(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "finance.amounts.view");
}

/** Inventory is shared: production manages it, purchasing and sales look it up (sales picks articles for devis). */
function canViewInventory(actor) {
  return isAdmin(actor) || isOwner(actor) || has(actor, "inventory.articles.view");
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
/**
 * True when `actor` manages the department `requestingEmployee`
 * belongs to (Department.manager — see middleware/auth.js, which
 * loads actor.managedDepartments). Never true for the actor's OWN
 * request: overseeing a department must not mean approving your own
 * absence or advance.
 */
function isDepartmentManagerOf(actor, requestingEmployee) {
  if (!requestingEmployee?.department || !Array.isArray(actor?.managedDepartments)) return false;
  if (sameId(actor.employee, requestingEmployee._id)) return false;
  const departmentId = requestingEmployee.department._id || requestingEmployee.department;
  return actor.managedDepartments.some((id) => sameId(id, departmentId));
}

/** The requester's direct line manager (Employee.manager). */
function isLineManagerOf(actor, requestingEmployee) {
  return !!requestingEmployee?.manager && sameId(actor.employee, requestingEmployee.manager);
}

function canReviewRequest(actor, company, requestingEmployee, kind = null) {
  if (isAdmin(actor)) return true;
  if (isOwner(actor)) return ownsCompany(actor, company);
  if (canApproveHRRequests(actor, kind)) return true;

  if (canSelfService(actor)) {
    return isLineManagerOf(actor, requestingEmployee) || isDepartmentManagerOf(actor, requestingEmployee);
  }

  return false;
}

const canReviewAbsence = (actor, company, emp) => canReviewRequest(actor, company, emp, "absences");
const canReviewAdvance = (actor, company, emp) => canReviewRequest(actor, company, emp, "advances");

/**
 * Distinguishes WHICH capacity a reviewer is acting in — canReviewRequest
 * above only answers "can this actor review this request at all", not
 * "as the manager, or as HR". The sequential-approval workflow
 * (Company.settings.requireSequentialApproval — see models/Company.js)
 * needs that distinction to decide the resulting status. Returns
 * "hr", "manager", or null (not authorized to review at all — exactly
 * mirrors canReviewRequest's false case). Admin/owner act with
 * HR-equivalent final authority, same as everywhere else in this
 * module. If someone happens to be BOTH the requester's line manager
 * AND HR-tier-or-above, "hr" wins — the stronger authority takes
 * precedence rather than forcing them through the manager step first.
 */
function reviewerRole(actor, company, requestingEmployee, kind = null) {
  if (isAdmin(actor)) return "hr";
  if (isOwner(actor)) return ownsCompany(actor, company) ? "hr" : null;
  if (canApproveHRRequests(actor, kind)) return "hr";

  if (canSelfService(actor)) {
    return isLineManagerOf(actor, requestingEmployee) || isDepartmentManagerOf(actor, requestingEmployee)
      ? "manager"
      : null;
  }

  return null;
}

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
  if (isOwner(actor)) return ownsCompany(actor, company);
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
  PURCHASING_DEPARTMENT,
  isPurchasingDepartment,
  canAccessPurchasing,
  canAccessSales,
  canViewProjects,
  canManageProjects,
  canSeeFinancials,
  FINANCIAL_DEPARTMENTS,
  has,
  hasAny,
  hasPrefix,
  canViewInventory,
  canConfigureProduction,
  canAccessLogistics,
  canUpdateTracking,
  canUseWorkshops,
  canWorkInWorkshop,
  canViewCatalog,
  canSelfService,
  isOwnEmployeeRecord,
  canReviewRequest,
  canReviewAbsence,
  canReviewAdvance,
  reviewerRole,
  isDepartmentManagerOf,
  canCreateCompany,
  canManageCompany,
  ownsCompany,
  canDeleteCompany,
  canCreateUser,
  canManageUser,
  canDeleteUser,
  userListFilter,
};
