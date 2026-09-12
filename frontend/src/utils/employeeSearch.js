/**
 * Builds the option list used by the employee SearchSelect field
 * (see components/useful/SearchSelect.jsx) — one source of truth
 * for "what fields can you search an employee by" so Salaries,
 * Absences, and Advances all search the same way. Add a new
 * searchable field here once and every page picks it up.
 */
export function buildEmployeeSearchOptions(employees = []) {
  return employees.map((employee) => {
    const name = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

    const label = employee.employeeNumber
      ? `${name} (${employee.employeeNumber})`
      : name;

    const searchText = [
      name,
      employee.employeeNumber,
      employee.cin,
      employee.cnssNumber,
      employee.phone,
      employee.secondaryPhone,
      employee.workEmail,
      employee.personalEmail,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      value: employee._id,
      label,
      searchText,
    };
  });
}
