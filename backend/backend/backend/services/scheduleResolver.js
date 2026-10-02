const WorkSchedule = require("../models/WorkSchedule");
const Department = require("../models/Department");
const Employee = require("../models/Employee");

/**
 * ============================================================
 * WHICH WORK SCHEDULE APPLIES
 * ============================================================
 * A company has one or more named schedules; one is the default.
 * An employee follows their department's schedule
 * (Department.workSchedule), or the company's default when the
 * department has none. Used by attendance (late / overtime / split
 * punches), working-day counts (leave), payroll (hours policy) and
 * project costs (monthly standard hours).
 * ============================================================
 */

/** The company's default schedule — created on first need; a company
 *  whose schedules predate "default" gets its oldest one marked. */
async function defaultSchedule(companyId, { create = true, lean = false } = {}) {
  let schedule = await WorkSchedule.findOne({ company: companyId, isDefault: true });
  if (!schedule) {
    schedule = await WorkSchedule.findOne({ company: companyId }, null, { sort: { createdAt: 1 } });
    if (schedule) {
      schedule.isDefault = true;
      await schedule.save();
    } else if (create) {
      schedule = new WorkSchedule({ company: companyId, name: "Horaire standard", isDefault: true });
      await schedule.save();
    }
  }
  return schedule && lean ? schedule.toObject() : schedule;
}

/** Schedule of a department (its own, else the company default). */
async function scheduleForDepartment(companyId, departmentId, opts = {}) {
  if (departmentId) {
    const dep = await Department.findOne({ _id: departmentId, company: companyId }).select("workSchedule").lean();
    if (dep?.workSchedule) {
      const own = await WorkSchedule.findOne({ _id: dep.workSchedule, company: companyId });
      if (own) return opts.lean ? own.toObject() : own;
    }
  }
  return defaultSchedule(companyId, opts);
}

/** Schedule of an employee (document or id). */
async function scheduleForEmployee(employeeOrId, companyId = null, opts = {}) {
  let employee = employeeOrId;
  // An id (or a document without its company): load what we need.
  if (employee && (typeof employee !== "object" || employee._bsontype || !employee.company)) {
    const id = employee?._id || employee;
    employee = await Employee.findById(id).select("company department").lean();
  }
  const company = companyId || employee?.company;
  if (!company) return null;
  return scheduleForDepartment(company, employee?.department?._id || employee?.department || null, opts);
}

module.exports = { defaultSchedule, scheduleForDepartment, scheduleForEmployee };
