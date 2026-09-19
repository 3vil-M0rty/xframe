const Employee = require("../models/Employee");

/**
 * Resolves a free-text `search` term (name, employee number, CIN,
 * CNSS number) into the list of matching employee _ids within
 * `companyId`. For filtering collections that reference an employee
 * by ObjectId rather than storing their name directly (Contracts,
 * Absences, Advances, Documents, Salaries, Payslips, ...) — the same
 * text-search UX as the Employees page itself, reused everywhere an
 * "employee" column needs a search bar instead of just a dropdown.
 *
 * Returns `null` when `search` is empty (caller should skip
 * filtering by employee entirely in that case) — never an empty
 * array, so "no search term" and "search term matched nobody" (a
 * real empty array) stay distinguishable.
 */
async function findMatchingEmployeeIds(companyId, search) {
  const term = (search || "").trim();
  if (!term) return null;

  const employees = await Employee.find({
    company: companyId,
    $or: [
      { firstName: { $regex: term, $options: "i" } },
      { lastName: { $regex: term, $options: "i" } },
      { employeeNumber: { $regex: term, $options: "i" } },
      { cin: { $regex: term, $options: "i" } },
      { cnssNumber: { $regex: term, $options: "i" } },
    ],
  }).select("_id");

  return employees.map((e) => e._id);
}

module.exports = { findMatchingEmployeeIds };
