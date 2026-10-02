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

export const isAdmin = (actor) => actor?.role === ROLES.ADMIN;

// The platform operator: belongs to no client, only manages clients
// (Platform > Clients). Sees no client business data.
export const isPlatformAdmin = (actor) => actor?.role === "platform_admin";
const isOwner = (actor) => actor?.role === ROLES.OWNER;
const isPlainUser = (actor) => actor?.role === ROLES.USER;

// ------------------------------------------------------------
// FINE-GRAINED PERMISSIONS ("module.resource.action", see the
// backend's config/permissionCatalog.js). /users/me sends the login's
// effective list as `permissions`; every check below reads it. When it
// isn't there yet (first render before /users/me), the old
// department-based rules are used.
// ------------------------------------------------------------
const setCache = new WeakMap();
function permSet(actor) {
  if (!actor || !Array.isArray(actor.permissions)) return null;
  let s = setCache.get(actor);
  if (!s) { s = new Set(actor.permissions); setCache.set(actor, s); }
  return s;
}
/** Can this login do `key` ("sales.quotes.create")? */
export function can(actor, key) {
  if (isAdmin(actor) || isOwner(actor)) return true;
  const s = permSet(actor);
  return !!s && s.has(key);
}
export function canAny(actor, keys) {
  return keys.some((k) => can(actor, k));
}
/** Any permission of a module / resource ("hr", "sales.quotes"). */
export function canModule(actor, prefix) {
  if (isAdmin(actor) || isOwner(actor)) return true;
  const s = permSet(actor);
  if (!s) return false;
  for (const k of s) if (k === prefix || k.startsWith(`${prefix}.`)) return true;
  return false;
}
const hasList = (actor) => !!permSet(actor);

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
  if (hasList(actor)) return canModule(actor, "hr");
  return isAdmin(actor) || isOwner(actor) || isHRDepartment(actor);
}

/**
 * Production module gate — deliberately narrower than canAccessHR:
 * only platform admins and users in the "production" department,
 * NOT owners by default. Mirrors the backend's canAccessProduction
 * (permissions/permissions.js) exactly.
 */
export const PRODUCTION_DEPARTMENT = "production";

export function canAccessProduction(actor) {
  // Every workshop: production manager. A chef d'atelier holds the work-order
  // permissions only for his own workshop(s) — mirrors the backend.
  if (hasList(actor)) return isAdmin(actor) || can(actor, "production.workshops.all") || (can(actor, "production.orders.edit") && !(actor?.workshops || []).length);
  return isAdmin(actor) || actor?.department === PRODUCTION_DEPARTMENT;
}

/** Purchasing module (service achats) — mirrors the backend. */
// Owners included: they approve large purchase orders.
export function canAccessPurchasing(actor) {
  if (hasList(actor)) return canModule(actor, "purchasing");
  return isAdmin(actor) || isOwner(actor) || actor?.department === "purchasing";
}

/** Sales (ventes): admins, owners and the "sales" department. */
export function canAccessSales(actor) {
  if (hasList(actor)) return canModule(actor, "sales");
  return isAdmin(actor) || isOwner(actor) || actor?.department === "sales";
}

/** Projects: production and sales see them; production and owners run them. */
export function canViewProjects(actor) {
  if (hasList(actor)) return can(actor, "projects.projects.view");
  return canAccessProduction(actor) || canAccessSales(actor) || canAccessPurchasing(actor) || actor?.department === "logistics";
}
/** Logistics: chassis to deliver, delivery notes — admins, owners, production, logistics department. */
export function canAccessLogistics(actor) {
  if (hasList(actor)) return canAny(actor, ["logistics.toDeliver.view", "logistics.notes.view"]);
  return isAdmin(actor) || isOwner(actor) || actor?.department === "logistics";
}
/** Chassis tracking (made / ready / installed): same people as logistics. */
export function canUpdateTracking(actor) {
  if (hasList(actor)) return canAny(actor, ["production.tracking.update", "logistics.tracking.update"]);
  return canAccessLogistics(actor);
}
/** Workshops (ateliers): production, or anyone who runs / works in one (sent by /users/me). */
export function canUseWorkshops(actor) {
  if (hasList(actor)) return can(actor, "production.orders.view");
  return canAccessProduction(actor) || (Array.isArray(actor?.workshops) && actor.workshops.length > 0);
}
/** Chassis catalogue, colours, workshops set-up: production only. */
export function canConfigureProduction(actor) {
  if (hasList(actor)) return canAny(actor, ["production.config.view", "production.config.edit"]);
  return canAccessProduction(actor);
}
/** Chassis catalogue page. */
export function canViewCatalog(actor) {
  if (hasList(actor)) return can(actor, "production.catalog.view");
  return canAccessProduction(actor);
}

export function canManageProjects(actor) {
  if (hasList(actor)) return can(actor, "projects.projects.edit");
  return canAccessProduction(actor) || isOwner(actor);
}
/** Inventory pages (articles, categories, purchase requests). */
export function canManageInventory(actor) {
  if (hasList(actor)) return canAny(actor, ["inventory.articles.view", "inventory.categories.view"]);
  return canAccessProduction(actor);
}
/** Hands out permissions to the people under them (managers) — or anyone (admins / owners). */
export function canManageTeamPermissions(actor) {
  return isAdmin(actor) || isOwner(actor) || can(actor, "team.permissions.manage");
}

/**
 * Amounts (sale prices, project revenue / costs / margins, budgets, cost
 * prices, hourly rates, pricing rules). Production, workshops and
 * logistics don't see them unless the admin ticks "Voir les montants"
 * on their account (showFinancials). Mirrors the backend — which also
 * leaves the amounts out of its answers.
 */
export const FINANCIAL_DEPARTMENTS = ["sales", "finance", "accounting", "management"];
export function canSeeFinancials(actor) {
  if (hasList(actor)) return can(actor, "finance.amounts.view");
  return isAdmin(actor) || isOwner(actor) || FINANCIAL_DEPARTMENTS.includes(actor?.department) || actor?.showFinancials === true;
}

/** Inventory is read by purchasing too; only production changes it. */
export function canViewInventory(actor) {
  if (hasList(actor)) return can(actor, "inventory.articles.view");
  return canAccessProduction(actor) || canAccessPurchasing(actor);
}

/**
 * Mirrors the backend's canSelfService — does this user have a
 * linked employee record, unlocking the "My Space" self-service
 * section (My Profile / My Payslips / My Absences / My Advances /
 * My Attendance)?
 */
export function canSelfService(actor) {
  return !!actor?.employee;
}

// ------------------------------------------------------------
// Companies
// ------------------------------------------------------------

export function canCreateCompany(actor) {
  return isAdmin(actor) || isOwner(actor);
}

/**
 * Route-level gate for company-wide policy settings (like the Work
 * Schedule page) — company-agnostic here (any admin or owner), the
 * backend enforces the specific per-company check once a company
 * is actually selected on the page (see canManageCompany).
 */
export function canManageCompanySettings(actor) {
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

/**
 * Manages at least one department (Department.manager). The backend
 * sends this as `managedDepartments` on /users/me — see
 * middleware/auth.js. Gates the "My department" page.
 */
export function isDepartmentManager(actor) {
  return Array.isArray(actor?.managedDepartments) && actor.managedDepartments.length > 0;
}

/**
 * Can open the department oversight page. Admins oversee every
 * department; owners every department of their own companies;
 * department managers their own. Mirrors GET /departments/managed.
 */
export function canOverseeDepartments(actor) {
  return isAdmin(actor) || isOwner(actor) || isDepartmentManager(actor);
}
