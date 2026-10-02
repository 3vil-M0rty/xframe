/**
 * ============================================================
 * HR JOB TITLES
 * ============================================================
 * The 4 canonical job titles offered when an employee's department
 * has `permissionKey: "hr"` (see models/Department.js) — kept as a
 * fixed, small list rather than free text specifically so they can
 * be mapped back to a User.hrRole permission tier automatically
 * when a login is created/linked for that employee (see
 * services/employeeAccountService.js).
 *
 * The frontend's job title picker (Employees.jsx) uses this exact
 * same list of canonical values — see
 * frontend/src/config/hrJobTitles.js, which must stay in sync with
 * this file's TITLES array (same values, same order).
 * ============================================================
 */

const TITLES = [
  { title: "Assistant RH", hrRole: "hr_assistant" },
  { title: "Chargé RH", hrRole: "hr_officer" },
  { title: "Responsable RH", hrRole: "hr_manager" },
  { title: "Directeur RH", hrRole: "hr_director" },
];

const HR_ROLE_BY_TITLE = new Map(TITLES.map((t) => [t.title, t.hrRole]));

/**
 * Maps a canonical HR job title to its permission tier. Returns
 * undefined for anything that isn't an exact match (custom/legacy
 * job titles some employees may still have from before this list
 * existed) — callers treat that as "don't set an hrRole", not an
 * error, since a mismatch here should never block creating a login.
 */
function hrRoleForJobTitle(jobTitle) {
  return HR_ROLE_BY_TITLE.get((jobTitle || "").trim());
}

module.exports = { HR_JOB_TITLES: TITLES.map((t) => t.title), hrRoleForJobTitle };
