const DEPARTMENT_VALUES = [
  "management",
  "hr",
  "finance",
  "accounting",
  "sales",
  "purchasing",
  "marketing",
  "production",
  "production_planning",
  "quality_control",
  "maintenance",
  "warehouse",
  "logistics",
  "procurement",
  "engineering",
  "design",
  "research_development",
  "it",
  "customer_service",
  "administration",
  "health_safety_environment",
  "security",
];

/**
 * Builds the {value, label} option list for a department dropdown,
 * translated via whichever `t` is passed in. Mirrors the enum on
 * both User.department and Employee.department (see those models)
 * — this is the ONE place that list is defined for the frontend,
 * reused anywhere a department picker is needed.
 */
export function getDepartmentOptions(t) {
  return DEPARTMENT_VALUES.map((value) => ({
    value,
    label: t(`users.departments.${value}`),
  }));
}
