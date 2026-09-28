const { ALL_KEYS, KEY_SET, keysOf, DEPARTMENT_MODULES, hrProfile } = require("../config/permissionCatalog");

/**
 * ============================================================
 * EFFECTIVE PERMISSIONS
 * ============================================================
 * req.user.perms (a Set, built once per request by middleware/auth.js)
 * is what every check reads — has(actor, "sales.quotes.create").
 *
 *   admin / owner                 → everything ("*")
 *   permissionsMode "custom"      → exactly User.permissions (set by a
 *                                   manager or an admin)
 *   otherwise ("role")            → the default profile of the login's
 *                                   department / HR level / workshops —
 *                                   the same access the platform gave
 *                                   before fine-grained permissions
 *   + manager of a department     → all of that department's module
 *                                   + "team.permissions.manage"
 *   + has people reporting to him → "team.permissions.manage"
 *   + "Voir les montants"         → "finance.amounts.view"
 * ============================================================
 */

const FINANCIAL_DEPARTMENTS = ["sales", "finance", "accounting", "management"];

/** The profile a login gets from its department / HR level when nobody customised it. */
function legacyDefaults(actor) {
  const out = new Set();
  const add = (list) => list.forEach((k) => out.add(k));
  const dep = actor?.department;
  if (dep === "hr") add(hrProfile(actor.hrRole));
  else if (dep && DEPARTMENT_MODULES[dep]) add(DEPARTMENT_MODULES[dep]());
  // Workshop staff outside production: their workshop's orders (scoped per workshop in the routes).
  if ((actor?.workshops || []).length) {
    add(["production.orders.view", "production.orders.start", "production.orders.consume", "production.orders.complete", "production.orders.print", "production.catalog.view", "production.tracking.view"]);
  }
  if (FINANCIAL_DEPARTMENTS.includes(dep)) out.add("finance.amounts.view");
  return out;
}

/** Keys granted by managing departments (their permissionKey's module). */
function managerGrants(managedDepartmentKeys = []) {
  const out = new Set();
  for (const key of managedDepartmentKeys) {
    if (key && DEPARTMENT_MODULES[key]) (key === "hr" ? keysOf("hr") : DEPARTMENT_MODULES[key]()).forEach((k) => out.add(k));
    if (key === "hr") ["organization.positions.view", "organization.departments.view"].forEach((k) => out.add(k));
  }
  return out;
}

/**
 * Builds the effective set.
 * @param user  { role, department, hrRole, permissionsMode, permissions, showFinancials }
 * @param ctx   { workshops, managedDepartmentKeys, hasReports }
 */
function computeEffective(user, ctx = {}) {
  if (!user) return new Set();
  if (user.role === "admin" || user.role === "owner") return new Set(["*"]);
  const actor = { ...user, workshops: ctx.workshops || user.workshops || [] };
  const set = user.permissionsMode === "custom"
    ? new Set((user.permissions || []).filter((k) => KEY_SET.has(k)))
    : legacyDefaults(actor);
  const managed = ctx.managedDepartmentKeys || [];
  managerGrants(managed).forEach((k) => set.add(k));
  if (managed.length || (ctx.managedDepartmentCount || 0) > 0 || ctx.hasReports) set.add("team.permissions.manage");
  if (user.showFinancials === true) set.add("finance.amounts.view");
  return set;
}

/**
 * The actor's permission set: the one computed by the auth middleware,
 * or — for plain objects (tests, background jobs) — the department
 * profile computed on the fly.
 */
function permsOf(actor) {
  if (!actor) return new Set();
  if (actor.perms instanceof Set) return actor.perms;
  if (Array.isArray(actor.perms)) return new Set(actor.perms);
  return computeEffective(actor, { workshops: actor.workshops, managedDepartmentKeys: actor.managedDepartmentKeys, hasReports: actor.hasReports });
}

function has(actor, key) {
  const p = permsOf(actor);
  return p.has("*") || p.has(key);
}
function hasAny(actor, keys) {
  return (Array.isArray(keys) ? keys : [keys]).some((k) => has(actor, k));
}
/** Any permission of a module / resource prefix ("sales", "hr.salaries"). */
function hasPrefix(actor, prefix) {
  const p = permsOf(actor);
  if (p.has("*")) return true;
  for (const k of p) if (k === prefix || k.startsWith(`${prefix}.`)) return true;
  return false;
}
/** Flat list for the client (admins get every key). */
function listOf(actor) {
  const p = permsOf(actor);
  return p.has("*") ? [...ALL_KEYS] : [...p].filter((k) => KEY_SET.has(k)).sort();
}

module.exports = { legacyDefaults, managerGrants, computeEffective, permsOf, has, hasAny, hasPrefix, listOf, FINANCIAL_DEPARTMENTS };
