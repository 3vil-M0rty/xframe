const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const Workshop = require("../models/Workshop");
const Company = require("../models/Company");
const auth = require("../middleware/auth");
const { logAudit } = require("../services/auditLogger");
const { notify } = require("../services/notificationService");
const { ALL_KEYS, KEY_SET, catalogForClient } = require("../config/permissionCatalog");
const { computeEffective, legacyDefaults, managerGrants, listOf, has } = require("../services/permissionService");

/**
 * ============================================================
 * PERMISSIONS — who may do what, handed out down the hierarchy
 * ============================================================
 * GET  /catalog                         modules › resources › actions + ready-made profiles
 * GET  /team?companyId=                 the people I can give permissions to (tree)
 * GET  /users/:userId                   one person's permissions (and what I can grant)
 * PUT  /users/:userId  { permissions }  save them (custom profile)
 * POST /users/:userId/reset             back to their department's default profile
 *
 * Rules:
 *  - admins and owners manage everyone (except admins / owners, who have everything);
 *  - anyone with "team.permissions.manage" — every department manager and
 *    everyone people report to — manages the people UNDER them: the staff
 *    of the departments they manage and their whole reporting line
 *    (Employee.manager, all levels);
 *  - you can only grant (or take away) permissions you have yourself; the
 *    others the person already had are left as they are;
 *  - nobody changes their own permissions (except admins / owners).
 * ============================================================
 */
const router = express.Router();
router.use(auth);

const isTop = (u) => u?.role === "admin" || u?.role === "owner";
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });

/** Employee ids under the actor (null = everyone, for admins / owners). */
async function teamEmployeeIds(actor) {
  if (isTop(actor)) return null;
  if (!actor.employee || !has(actor, "team.permissions.manage")) return new Set();
  const me = String(actor.employee);
  const out = new Set();
  const managed = await Department.find({ manager: me }).select("_id").lean();
  if (managed.length) {
    const staff = await Employee.find({ department: { $in: managed.map((d) => d._id) } }).select("_id").lean();
    staff.forEach((e) => out.add(String(e._id)));
  }
  // Whole reporting line, all levels (and the staff of anyone in it is reached through Employee.manager).
  let frontier = [me, ...out];
  const seen = new Set(frontier);
  while (frontier.length) {
    const next = await Employee.find({ manager: { $in: frontier } }).select("_id").lean();
    frontier = [];
    for (const e of next) {
      const id = String(e._id);
      out.add(id);
      if (!seen.has(id)) { seen.add(id); frontier.push(id); }
    }
  }
  out.delete(me);
  return out;
}

/** Everything the permission page needs about one login. */
async function permissionState(user) {
  const managedRows = user.employee ? await Department.find({ manager: user.employee }).select("name permissionKey").lean() : [];
  const workshops = user.employee
    ? (await Workshop.find({ $or: [{ manager: user.employee }, { members: user.employee }] }).select("_id").lean()).map((w) => String(w._id))
    : [];
  const hasReports = user.employee ? !!(await Employee.exists({ manager: user.employee })) : false;
  const managedKeys = managedRows.map((d) => d.permissionKey).filter(Boolean);
  const effective = computeEffective(user, { workshops, managedDepartmentKeys: managedKeys, managedDepartmentCount: managedRows.length, hasReports });
  const actorLike = { ...user, workshops };
  return {
    effective: effective.has("*") ? [...ALL_KEYS] : [...effective].filter((k) => KEY_SET.has(k)),
    // What they'd have without any customisation (their department / HR level).
    roleDefaults: [...legacyDefaults(actorLike)],
    // What they get for managing departments / people — can't be taken away here.
    fromManagement: [...managerGrants(managedKeys), ...(managedRows.length || hasReports ? ["team.permissions.manage"] : [])],
    managedDepartments: managedRows.map((d) => d.name),
    base: user.permissionsMode === "custom" ? (user.permissions || []).filter((k) => KEY_SET.has(k)) : [...legacyDefaults(actorLike)],
  };
}

/** Can the actor manage this target login? Returns an error message or null. */
async function checkTarget(req, target) {
  if (!target) return "User not found";
  if (isTop(target)) return "Admins and owners have every permission";
  if (String(target._id) === String(req.user.id) && !isTop(req.user)) return "You can't change your own permissions";
  if (isTop(req.user)) return null;
  const team = await teamEmployeeIds(req.user);
  if (!target.employee || !team.has(String(target.employee))) return "This person isn't in your team";
  return null;
}

const grantableOf = (actor) => (isTop(actor) ? [...ALL_KEYS] : listOf(actor));

router.get("/catalog", (req, res) => {
  res.json({ success: true, data: catalogForClient() });
});

/** The people I can give permissions to, as a tree (reportsTo = their manager). */
router.get("/team", async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!isId(companyId) || !(await Company.exists({ _id: companyId }))) return bad(res, "A valid companyId is required");
    const team = await teamEmployeeIds(req.user);
    if (team && !team.size) return res.json({ success: true, data: { people: [], canManage: false } });
    const filter = { company: companyId, employmentStatus: { $ne: "terminated" } };
    if (team) filter._id = { $in: [...team] };
    const employees = await Employee.find(filter).select("firstName lastName jobTitle department manager employeeNumber").populate("department", "name").sort({ lastName: 1, firstName: 1 }).lean();
    const ids = employees.map((e) => e._id);
    const [users, managedDeps] = await Promise.all([
      User.find({ employee: { $in: ids } }).select("email role department hrRole permissionsMode permissions status employee").lean(),
      Department.find({ manager: { $in: ids } }).select("name manager").lean(),
    ]);
    const userOf = new Map(users.map((u) => [String(u.employee), u]));
    const depsOf = new Map();
    for (const d of managedDeps) {
      const k = String(d.manager);
      if (!depsOf.has(k)) depsOf.set(k, []);
      depsOf.get(k).push(d.name);
    }
    const people = employees.map((e) => {
      const u = userOf.get(String(e._id));
      return {
        employeeId: e._id,
        name: `${e.firstName || ""} ${e.lastName || ""}`.trim(),
        jobTitle: e.jobTitle || "",
        department: e.department?.name || "",
        reportsTo: e.manager ? String(e.manager) : null,
        manages: depsOf.get(String(e._id)) || [],
        user: u ? {
          _id: u._id, email: u.email, role: u.role, status: u.status,
          mode: u.permissionsMode || "role",
          count: isTop(u) ? ALL_KEYS.length : (u.permissionsMode === "custom" ? (u.permissions || []).length : null),
          self: String(u._id) === String(req.user.id),
        } : null,
      };
    });
    res.json({ success: true, data: { people, canManage: true, all: team === null } });
  } catch (error) {
    console.error("GET permissions team error:", error);
    res.status(500).json({ success: false, message: "Error loading your team", error: error.message });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    if (!isId(req.params.userId)) return bad(res, "Invalid user");
    const target = await User.findById(req.params.userId).select("firstName lastName email role department hrRole employee permissionsMode permissions showFinancials").lean();
    const problem = await checkTarget(req, target);
    if (problem) return bad(res, problem, target ? 403 : 404);
    const state = await permissionState(target);
    res.json({
      success: true,
      data: {
        user: { _id: target._id, name: `${target.firstName || ""} ${target.lastName || ""}`.trim(), email: target.email, mode: target.permissionsMode || "role" },
        ...state,
        grantable: grantableOf(req.user),
      },
    });
  } catch (error) {
    console.error("GET user permissions error:", error);
    res.status(500).json({ success: false, message: "Error loading the permissions", error: error.message });
  }
});

router.put("/users/:userId", async (req, res) => {
  try {
    if (!isId(req.params.userId)) return bad(res, "Invalid user");
    if (!Array.isArray(req.body.permissions)) return bad(res, "permissions must be a list");
    const target = await User.findById(req.params.userId);
    const problem = await checkTarget(req, target);
    if (problem) return bad(res, problem, target ? 403 : 404);
    const before = await permissionState(target.toObject());
    const grantable = new Set(grantableOf(req.user));
    const requested = new Set(req.body.permissions.map(String).filter((k) => KEY_SET.has(k)));
    // Keep what I can't grant as it was; set what I can grant as asked.
    const next = new Set(before.base.filter((k) => !grantable.has(k)));
    for (const k of requested) if (grantable.has(k)) next.add(k);
    target.permissionsMode = "custom";
    target.permissions = [...next].sort();
    await target.save();
    const after = await permissionState(target.toObject());
    const added = after.effective.filter((k) => !before.effective.includes(k));
    const removed = before.effective.filter((k) => !after.effective.includes(k));
    await logAudit(req, { action: "update", resourceType: "UserPermissions", resourceId: target._id, resourceLabel: target.email, before: { permissions: before.base }, after: { permissions: target.permissions } });
    if (added.length || removed.length) {
      await notify(target._id, {
        type: "other",
        key: "permissionsChanged",
        params: { added: added.length, removed: removed.length },
        title: "Vos droits ont été modifiés",
        message: `${added.length} ajouté(s), ${removed.length} retiré(s)`,
        link: "/profile",
      }).catch(() => {});
    }
    res.json({ success: true, data: { ...after, user: { _id: target._id, mode: target.permissionsMode }, grantable: [...grantable], added, removed } });
  } catch (error) {
    console.error("PUT user permissions error:", error);
    res.status(500).json({ success: false, message: "Error saving the permissions", error: error.message });
  }
});

router.post("/users/:userId/reset", async (req, res) => {
  try {
    if (!isId(req.params.userId)) return bad(res, "Invalid user");
    const target = await User.findById(req.params.userId);
    const problem = await checkTarget(req, target);
    if (problem) return bad(res, problem, target ? 403 : 404);
    // Only someone who could grant everything the default profile gives may reset to it.
    const state = await permissionState({ ...target.toObject(), permissionsMode: "role" });
    const grantable = new Set(grantableOf(req.user));
    const beyond = state.roleDefaults.filter((k) => !grantable.has(k));
    if (beyond.length && !isTop(req.user)) return bad(res, "Their default profile includes permissions you don't have — ask an admin", 403);
    const before = target.permissions;
    target.permissionsMode = "role";
    target.permissions = [];
    await target.save();
    await logAudit(req, { action: "update", resourceType: "UserPermissions", resourceId: target._id, resourceLabel: `${target.email} → profil par défaut`, before: { permissions: before }, after: { mode: "role" } });
    res.json({ success: true, data: { ...(await permissionState(target.toObject())), user: { _id: target._id, mode: "role" }, grantable: [...grantable] } });
  } catch (error) {
    console.error("POST reset permissions error:", error);
    res.status(500).json({ success: false, message: "Error resetting the permissions", error: error.message });
  }
});

module.exports = router;
module.exports.teamEmployeeIds = teamEmployeeIds;
