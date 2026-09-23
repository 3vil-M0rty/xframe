const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Department = require("../models/Department");
const JobPosition = require("../models/JobPosition");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const User = require("../models/User");
const { syncLinkedUserPermissions } = require("../services/employeeAccountService");

const auth = require("../middleware/auth");
const { canManageCompany } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const { DEFAULT_DEPARTMENTS } = require("../config/defaultDepartments");

router.use(auth);

const canManage = (req, company) => canManageCompany(req.user, company);

// ======================================================
// GET ALL DEPARTMENTS
// GET /api/departments?companyId=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const departments = await Department.find({ company: companyId })
      .populate("manager", "firstName lastName jobTitle")
      .sort({ name: 1 });

    res.json({ success: true, data: departments });
  } catch (error) {
    console.error("GET departments error:", error);
    res.status(500).json({ success: false, message: "Error fetching departments", error: error.message });
  }
});

// ======================================================
// DEPARTMENTS I MANAGE ("My department" page)
// GET /api/departments/managed
// ======================================================
// Any logged-in user; returns [] unless they're the manager
// (Department.manager) of at least one department. For each: its job
// positions with their module-access switch, and its employees with
// their job title and whether they have a login.

router.get("/managed", async (req, res) => {
  try {
    // Who oversees what:
    //   - admin: every department of every company
    //   - owner: every department of the companies they own
    //   - department manager: the department(s) they manage
    // An admin/owner can do everything a department manager can
    // (PATCH /job-positions/:id/access already allows them), so they
    // get the same page over their wider scope.
    const ids = req.user.managedDepartments || [];
    let filter;
    if (req.user.role === "admin") {
      filter = {};
    } else if (req.user.role === "owner") {
      const owned = await Company.find({ owner: req.user.id }).select("_id").lean();
      filter = { $or: [{ company: { $in: owned.map((c) => c._id) } }, { _id: { $in: ids } }] };
    } else {
      if (ids.length === 0) return res.json({ success: true, data: [] });
      filter = { _id: { $in: ids } };
    }

    const departments = await Department.find(filter)
      .select("name permissionKey company manager")
      .populate("company", "name")
      .populate("manager", "firstName lastName jobTitle")
      .sort({ name: 1 })
      .lean();

    const data = await Promise.all(departments.map(async (department) => {
      const [positions, employees] = await Promise.all([
        JobPosition.find({ department: department._id }).select("title grantsModuleAccess").sort({ title: 1 }).lean(),
        Employee.find({ department: department._id, employmentStatus: { $ne: "terminated" } })
          .select("firstName lastName jobTitle employeeNumber").sort({ lastName: 1 }).lean(),
      ]);
      const withLogin = new Set(
        (await User.find({ employee: { $in: employees.map((e) => e._id) } }).select("employee").lean())
          .map((u) => String(u.employee))
      );
      return {
        ...department,
        positions,
        employees: employees.map((e) => ({ ...e, hasLogin: withLogin.has(String(e._id)) })),
      };
    }));

    data.sort((a, b) =>
      String(a.company?.name || "").localeCompare(String(b.company?.name || "")) ||
      String(a.name).localeCompare(String(b.name)));

    res.json({ success: true, data });
  } catch (error) {
    console.error("GET managed departments error:", error);
    res.status(500).json({ success: false, message: "Error fetching your departments", error: error.message });
  }
});

// ======================================================
// CREATE DEPARTMENT
// POST /api/departments
// ======================================================

router.post("/", async (req, res) => {
  try {
    const { company, name, description, permissionKey, category } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, companyDoc)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const department = await Department.create({
      company,
      name,
      description,
      permissionKey: permissionKey || null,
      category: category || null,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "Department",
      resourceId: department._id,
      resourceLabel: name,
      after: department.toObject(),
    });

    res.status(201).json({ success: true, data: department, message: "Department created successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A department with this name already exists, or another department already has this permission key",
      });
    }
    console.error("POST department error:", error);
    res.status(500).json({ success: false, message: "Error creating department", error: error.message });
  }
});

// ======================================================
// SEED DEFAULT DEPARTMENTS
// POST /api/departments/seed-defaults
// body: { company, categories: ["hr", "production", ...] }
// ======================================================
// Quick-start option offered from the Departments page instead of
// making a new company build its list one department at a time.
// Silently skips any requested category that already has a
// department for this company (running it twice, or picking a
// category someone already created manually, never creates a
// duplicate).

router.post("/seed-defaults", async (req, res) => {
  try {
    const { company, categories } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ success: false, message: "At least one category is required" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, companyDoc)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const templatesByCategory = new Map(DEFAULT_DEPARTMENTS.map((d) => [d.category, d]));
    const requested = categories.filter((c) => templatesByCategory.has(c));
    if (requested.length === 0) {
      return res.status(400).json({ success: false, message: "None of the given categories are recognized" });
    }

    const existing = await Department.find({ company, category: { $in: requested } }).select("category");
    const alreadyPresent = new Set(existing.map((d) => d.category));

    const toCreate = requested
      .filter((c) => !alreadyPresent.has(c))
      .map((c) => {
        const template = templatesByCategory.get(c);
        return {
          company,
          name: template.name,
          description: template.description,
          category: template.category,
          permissionKey: template.permissionKey,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        };
      });

    const created = [];
    for (const data of toCreate) {
      // eslint-disable-next-line no-await-in-loop
      created.push(await Department.create(data));
    }

    // Seed a starter set of real JobPosition records for each newly
    // created department too — a department with no positions gives
    // the Employee form's Job Title field nothing to offer, which
    // defeats the point of a "quick start" (see
    // config/defaultDepartments.js's own comment for why this
    // matters, especially for "hr", whose 4 titles are load-bearing
    // for the User.hrRole inheritance).
    let positionsCreatedCount = 0;
    for (const department of created) {
      const template = templatesByCategory.get(department.category);
      const positionTitles = template?.positions || [];
      // eslint-disable-next-line no-await-in-loop
      const positionDocs = await Promise.all(
        positionTitles.map((entry) =>
          JobPosition.create({
            company,
            department: department._id,
            title: typeof entry === "string" ? entry : entry.title,
            grantsModuleAccess: typeof entry === "string" ? false : !!entry.grantsModuleAccess,
            createdBy: req.user.id,
            updatedBy: req.user.id,
          })
        )
      );
      positionsCreatedCount += positionDocs.length;
    }

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "Department",
      resourceId: company,
      resourceLabel: `${created.length} default department(s) and ${positionsCreatedCount} position(s) seeded`,
    });

    res.status(201).json({
      success: true,
      data: created,
      skipped: requested.length - created.length,
      positionsCreated: positionsCreatedCount,
      message: `${created.length} department(s) and ${positionsCreatedCount} position(s) created${requested.length > created.length ? `, ${requested.length - created.length} department(s) already existed and were skipped` : ""}`,
    });
  } catch (error) {
    console.error("POST seed-defaults error:", error);
    res.status(500).json({ success: false, message: "Error seeding default departments", error: error.message });
  }
});

// ======================================================
// UPDATE DEPARTMENT
// PUT /api/departments/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findById(req.params.id).populate("company");
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }
    if (!canManage(req, department.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const before = department.toObject();

    const { name, description, permissionKey, category, manager } = req.body;

    const previousManager = department.manager ? String(department.manager) : null;
    if (manager !== undefined) {
      if (manager) {
        if (!mongoose.Types.ObjectId.isValid(manager)) {
          return res.status(400).json({ success: false, message: "Invalid manager" });
        }
        const managerEmployee = await Employee.findOne({ _id: manager, company: department.company._id }).select("department");
        if (!managerEmployee) {
          return res.status(400).json({ success: false, message: "The manager must be an employee of this company" });
        }
        if (String(managerEmployee.department) !== String(department._id)) {
          return res.status(400).json({ success: false, message: "The manager must be an employee of this department" });
        }
      }
      department.manager = manager || null;
    }

    if (name !== undefined) department.name = name;
    if (description !== undefined) department.description = description;
    if (permissionKey !== undefined) department.permissionKey = permissionKey || null;
    if (category !== undefined) department.category = category || null;
    department.updatedBy = req.user.id;

    await department.save();

    // Becoming (or ceasing to be) a department manager changes that
    // person's module access — re-derive both logins right away.
    const newManager = department.manager ? String(department.manager) : null;
    if (previousManager !== newManager) {
      for (const employeeId of [previousManager, newManager].filter(Boolean)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const emp = await Employee.findById(employeeId).select("_id department jobTitle");
          // eslint-disable-next-line no-await-in-loop
          if (emp) await syncLinkedUserPermissions(emp);
        } catch (syncError) {
          console.error("Failed to sync department manager permissions:", syncError);
        }
      }
    }

    await logAudit(req, {
      company: department.company._id,
      action: "update",
      resourceType: "Department",
      resourceId: department._id,
      before,
      after: department.toObject(),
    });

    res.json({ success: true, data: department, message: "Department updated successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A department with this name already exists, or another department already has this permission key",
      });
    }
    console.error("PUT department error:", error);
    res.status(500).json({ success: false, message: "Error updating department", error: error.message });
  }
});

// ======================================================
// DELETE DEPARTMENT
// DELETE /api/departments/:id
// Refuses if any employee or job position still references it.
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findById(req.params.id).populate("company");
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }
    if (!canManage(req, department.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const [employeeCount, positionCount] = await Promise.all([
      Employee.countDocuments({ department: department._id }),
      JobPosition.countDocuments({ department: department._id }),
    ]);

    if (employeeCount > 0 || positionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This department still has ${employeeCount} employee(s) and ${positionCount} position(s) — reassign or remove them first.`,
      });
    }

    await Department.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: department.company._id,
      action: "delete",
      resourceType: "Department",
      resourceId: department._id,
      resourceLabel: department.name,
      before: department.toObject(),
    });

    res.json({ success: true, message: "Department deleted successfully", departmentId: department._id });
  } catch (error) {
    console.error("DELETE department error:", error);
    res.status(500).json({ success: false, message: "Error deleting department", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (name, description) — fr/en/ar
// ======================================================

attachTranslationRoutes(router, Department, {
  resourceType: "Department",
  authorize: async (req, doc) => {
    const company = await Company.findById(doc.company);
    return canManage(req, company);
  },
});

module.exports = router;
