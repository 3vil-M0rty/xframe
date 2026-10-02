const crypto = require("crypto");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const JobPosition = require("../models/JobPosition");
const { hrRoleForJobTitle } = require("../config/hrJobTitles");

/**
 * Strips accents/diacritics (é → e, ç → c, ...) — common in
 * Moroccan names written in French orthography — and reduces to
 * plain lowercase ASCII letters only, since that's what belongs in
 * an email local-part.
 */
function slugifyNamePart(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accent marks
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Generates a work email as firstname.lastname@company.frame,
 * appending a number (firstname.lastname2@..., ...3@...) if that
 * address is already taken by another employee or user account.
 * "company.frame" is a placeholder domain — swap it for the
 * organization's real domain here (the one place this is defined)
 * once you have one.
 */
async function generateWorkEmail(firstName, lastName) {
  const domain = "company.frame";
  const base = `${slugifyNamePart(firstName)}.${slugifyNamePart(lastName)}`;

  let candidate = `${base}@${domain}`;
  let suffix = 2;

  while (
    (await Employee.exists({ workEmail: candidate })) ||
    (await User.exists({ email: candidate }))
  ) {
    candidate = `${base}${suffix}@${domain}`;
    suffix += 1;
  }

  return candidate;
}

/**
 * ============================================================
 * EMPLOYEE ACCOUNT SERVICE
 * ============================================================
 * Single place that knows how to turn an Employee into a
 * self-service User login — used both when creating an employee
 * (optional "also create a login" step) and later, retroactively,
 * from the employee detail view's "Self-service access" panel.
 * ============================================================
 */

/**
 * A short, readable temporary password (avoids visually-ambiguous
 * characters like 0/O, 1/l/I) — shown to HR ONCE right after
 * creation so they can hand it to the employee. There's no email/
 * SMS provider wired into this backend (see
 * services/notificationService.js), so this "show it once in the
 * UI" approach is the practical alternative until one exists.
 */
function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  let password = "";
  for (let i = 0; i < 10; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
}

/**
 * Given an Employee (needs `department` and `jobTitle`), computes
 * what a User account for them should inherit:
 *   - `department`: the app's fixed permission code (canAccessHR /
 *     canAccessProduction check against this), taken from the
 *     employee's Department.permissionKey — NOT the department
 *     reference itself, since Department is a company-defined
 *     record with no fixed meaning to the permission system.
 *     Only granted when the employee's POSITION grants it — see the
 *     function body for the exact rule.
 *   - `hrRole`: the canonical HR title's tier, or hr_assistant for
 *     a flag-granted custom HR position.
 *
 * Used both when a login is first created for an employee, and by
 * routes/users.js's update handler to keep an ALREADY-linked user's
 * department/hrRole re-derived from their current employee record
 * on every save, rather than a value someone could independently
 * edit on the Users page and let drift out of sync.
 */
async function computeInheritedPermissions(employee) {
  // Module access follows the employee's POSITION, not merely their
  // department. Previously any employee in a department with a
  // permissionKey got that whole module — a Machine Operator in
  // Production could manage inventory, simply for being in
  // Production. Now an employee only unlocks the module when their
  // job title matches a JobPosition in that department flagged
  // grantsModuleAccess (set per position on the Departments page).
  // Everyone else gets no module department, i.e. My Space only.
  //
  // HR keeps one extra route in: the 4 canonical HR titles (see
  // config/hrJobTitles.js) are HR staff by definition and always
  // grant access with their matching tier, so existing HR setups
  // keep working even if their positions predate the flag. A
  // flag-granted HR position with a CUSTOM title gets the lowest
  // tier (hr_assistant) — least privilege, rather than falling back
  // to full Responsable-level authority.
  if (!employee.department || !employee.jobTitle) return { department: undefined, hrRole: undefined };

  const departmentId = employee.department._id || employee.department;
  const department = await Department.findById(departmentId).select("permissionKey manager");
  const permissionKey = department?.permissionKey || undefined;
  if (!permissionKey) return { department: undefined, hrRole: undefined };

  // The department's manager oversees the whole department: full
  // module access at the top tier, whatever their job title is.
  if (department.manager && employee._id && String(department.manager) === String(employee._id)) {
    return { department: permissionKey, hrRole: permissionKey === "hr" ? "hr_director" : undefined };
  }

  const title = String(employee.jobTitle).trim();
  const position = await JobPosition.findOne({ department: departmentId, title }).select("grantsModuleAccess");
  const flagged = !!position?.grantsModuleAccess;

  if (permissionKey === "hr") {
    const canonicalRole = hrRoleForJobTitle(title);
    if (!canonicalRole && !flagged) return { department: undefined, hrRole: undefined };
    return { department: "hr", hrRole: canonicalRole || "hr_assistant" };
  }

  return flagged ? { department: permissionKey, hrRole: undefined } : { department: undefined, hrRole: undefined };
}

/**
 * Re-applies computeInheritedPermissions to the login linked to
 * `employee`, if there is one. Call after anything that can change
 * what an employee's account should be allowed to do — a new job
 * title or department on the employee, or a position's
 * grantsModuleAccess switch being flipped — so the change takes
 * effect immediately (middleware/auth.js reads permissions fresh on
 * every request) instead of waiting for someone to re-save the user
 * on the Users page. No-op for employees without a login. Returns
 * true if the user's permissions actually changed.
 */
async function syncLinkedUserPermissions(employee) {
  const user = await User.findOne({ employee: employee._id });
  if (!user) return false;

  const { department, hrRole } = await computeInheritedPermissions(employee);
  if (user.department === department && user.hrRole === hrRole) return false;

  user.department = department;
  user.hrRole = hrRole;
  await user.save();
  return true;
}

/**
 * Re-syncs every linked login holding a given position — used when a
 * position's grantsModuleAccess switch or title changes.
 * `titles` may include both the old and new title on a rename.
 */
async function resyncUsersForPosition(departmentId, titles) {
  const uniqueTitles = [...new Set(titles.filter(Boolean).map((t) => String(t).trim()))];
  if (uniqueTitles.length === 0) return 0;

  const employees = await Employee.find({ department: departmentId, jobTitle: { $in: uniqueTitles } })
    .select("_id department jobTitle");
  let changed = 0;
  for (const employee of employees) {
    // eslint-disable-next-line no-await-in-loop
    if (await syncLinkedUserPermissions(employee)) changed += 1;
  }
  return changed;
}

/**
 * Creates a User account linked to `employee` and returns the
 * plaintext temporary password (the ONLY time it's ever available
 * in plaintext — the User model hashes it on save). Throws a
 * plain Error with a `.status` and user-facing `.message` on any
 * validation failure, so route handlers can just catch it.
 *
 * @param {Object} employee - Employee document (needs workEmail,
 *   firstName, lastName, _id)
 * @param {string} actorId - who's creating this (for createdBy)
 */
async function createLoginForEmployee(employee, actorId) {
  if (!employee.workEmail) {
    const error = new Error(
      "This employee has no work email on file — add one before creating a login."
    );
    error.status = 400;
    throw error;
  }

  const normalizedEmail = employee.workEmail.trim().toLowerCase();

  // Emails are unique across the whole platform, so look outside the
  // caller's client too (services/tenantScope.js).
  const existingByEmail = await User.findOne({ email: normalizedEmail }).setOptions({ skipTenantScope: true });
  if (existingByEmail) {
    const error = new Error(
      `A user account already exists with the email ${normalizedEmail}.`
    );
    error.status = 409;
    throw error;
  }

  const existingLink = await User.findOne({ employee: employee._id });
  if (existingLink) {
    const error = new Error("This employee already has a linked user account.");
    error.status = 409;
    throw error;
  }

  const temporaryPassword = generateTemporaryPassword();

  const { department: permissionDepartment, hrRole } = await computeInheritedPermissions(employee);

  const user = await User.create({
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: normalizedEmail,
    password: temporaryPassword, // hashed by User's pre('save') hook
    role: "user",
    department: permissionDepartment,
    hrRole,
    employee: employee._id,
  });

  return { user, temporaryPassword };
}

/**
 * Generates a fresh temporary password for an employee's ALREADY
 * linked User account — the recovery path when HR missed the
 * one-time display at creation, or an employee is locked out.
 * Throws the same shaped errors as createLoginForEmployee.
 */
async function resetPasswordForEmployee(employeeId) {
  const user = await User.findOne({ employee: employeeId });
  if (!user) {
    const error = new Error("This employee has no linked user account yet.");
    error.status = 404;
    throw error;
  }

  const temporaryPassword = generateTemporaryPassword();
  user.password = temporaryPassword; // hashed by User's pre('save') hook
  await user.save();

  return { user, temporaryPassword };
}

module.exports = {
  createLoginForEmployee,
  resetPasswordForEmployee,
  computeInheritedPermissions,
  syncLinkedUserPermissions,
  resyncUsersForPosition,
  generateTemporaryPassword,
  generateWorkEmail,
};
