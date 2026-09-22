const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Employee = require("../models/Employee");
const Company = require("../models/Company");
const Salary = require("../models/Salary");
const Contract = require("../models/Contract");
const User = require("../models/User");

const auth = require("../middleware/auth");
const upload = require("../middleware/uploadMiddleware");
const multer = require("multer");

// Separate multer instance for the bulk-import CSV upload — the
// shared `upload` above only accepts image mimetypes (it's built
// for photos). CSV mimetype detection is notoriously inconsistent
// across browsers/OS (text/csv, application/vnd.ms-excel,
// application/csv, or nothing at all), so this checks the file
// extension instead of trusting the reported mimetype.
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.csv$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv files are accepted"), false);
    }
  },
});
const {
  requireHRAccess,
} = require("../middleware/permissionMiddleware");

const {
  canAccessHRForCompany,
  canDeleteEmployee,
  canManageEmployeeRecords,
} = require("../permissions/permissions");

const { logAudit } = require("../services/auditLogger");
const { createLoginForEmployee, generateWorkEmail, resetPasswordForEmployee } = require("../services/employeeAccountService");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const {
  generateAttestationTravail,
  generateAttestationSalaire,
  generateCertificatTravail,
} = require("../services/employeeDocumentsPdfService");
const {
  generateContratTravail,
  generateSoldeToutCompte,
} = require("../services/settlementDocumentsPdfService");
const { getLeaveBalance } = require("../services/leaveBalanceService");
const { fetchLogoBuffer } = require("../services/pdfHelpers");
const { previewImport, commitImport } = require("../services/employeeBulkImportService");
const { sendCsv } = require("../utils/csvHelpers");

const {
  uploadImage,
  deleteImage,
} = require("../services/cloudinaryService");

// ======================================================
// HELPER
// ======================================================

// Admin can manage any company.
// Owner can only manage companies they own.

const canManage = (req, company) =>
  canAccessHRForCompany(req.user, company);

// ======================================================
// GET ALL EMPLOYEES
// GET /api/employees
// ======================================================

router.get("/", auth, async (req, res) => {
  try {
    const {
      companyId,
      status,
      department,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // --------------------------------------------------
    // COMPANY REQUIRED
    // --------------------------------------------------

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    // --------------------------------------------------
    // VALIDATE COMPANY ID
    // --------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyId",
      });
    }

    // --------------------------------------------------
    // FIND COMPANY
    // --------------------------------------------------

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // --------------------------------------------------
    // CHECK ACCESS
    // --------------------------------------------------

    if (!canManage(req, company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view employees of this company",
      });
    }

    // --------------------------------------------------
    // BUILD FILTER
    // --------------------------------------------------

    const filter = {
      company: companyId,
    };

    if (status) {
      filter.employmentStatus = status;
    }

    if (department) {
      filter.department = department;
    }

    if (search) {
      filter.$or = [
        {
          firstName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          employeeNumber: {
            $regex: search,
            $options: "i",
          },
        },
        {
          cin: {
            $regex: search,
            $options: "i",
          },
        },
        {
          cnssNumber: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const skip =
      (currentPage - 1) * currentLimit;

    // --------------------------------------------------
    // FETCH EMPLOYEES
    // --------------------------------------------------

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate(
          "manager",
          "firstName lastName employeeNumber jobTitle"
        )
        .populate("department", "name permissionKey translations")
        .populate("jobPosition", "title salaryBandMin salaryBandMax currency translations")
        .sort({
          lastName: 1,
          firstName: 1,
        })
        .skip(skip)
        .limit(currentLimit),

      Employee.countDocuments(filter),
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    res.json({
      success: true,
      data: employees,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(
          total / currentLimit
        ),
      },
    });
  } catch (error) {
    console.error(
      "GET employees error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Error fetching employees",
      error: error.message,
    });
  }
});

// ======================================================
// EXPORT EMPLOYEES (CSV)
// GET /api/employees/export?companyId=
// ======================================================
// The natural companion to bulk import (further down this file) —
// same column shape, so a company can export, edit in a
// spreadsheet, and re-import cleanly. Not paginated: an export is
// meant to be the whole list. Registered BEFORE GET /:id below —
// Express matches routes in registration order, and /:id would
// otherwise swallow a request to /export as if "export" were an
// employee id, long before ever reaching a route defined later in
// the file.

router.get("/export", auth, requireHRAccess, async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "A valid companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, company)) {
      return res.status(403).json({ success: false, message: "Not authorized to export employees for this company" });
    }

    const employees = await Employee.find({ company: companyId })
      .populate("department", "name")
      .populate("manager", "firstName lastName")
      .sort({ lastName: 1, firstName: 1 });

    const formatDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

    const headers = [
      "employeeNumber", "firstName", "lastName", "cin", "email", "phone",
      "gender", "dateOfBirth", "hireDate", "jobTitle", "department", "manager",
      "employmentType", "employmentStatus",
    ];
    const rows = employees.map((e) => [
      e.employeeNumber || "",
      e.firstName || "",
      e.lastName || "",
      e.cin || "",
      e.workEmail || e.personalEmail || "",
      e.phone || "",
      e.gender || "",
      formatDate(e.dateOfBirth),
      formatDate(e.hireDate),
      e.jobTitle || "",
      e.department?.name || "",
      e.manager ? `${e.manager.firstName} ${e.manager.lastName}`.trim() : "",
      e.employmentType || "",
      e.employmentStatus || "",
    ]);

    const safeName = (company.shortName || company.name || "employees").replace(/[^a-z0-9]+/gi, "-");
    sendCsv(res, `employees-${safeName}-${formatDate(new Date())}.csv`, [headers, ...rows]);

    await logAudit(req, {
      company: company._id,
      action: "review", // closest fit in AuditLog's fixed action enum (create/update/delete/review) -- an export reads/reviews data, doesn't mutate it
      resourceType: "EmployeeExport",
      resourceId: company._id,
      resourceLabel: `${employees.length} employees exported`,
    }).catch(() => {});
  } catch (error) {
    console.error("GET employees export error:", error);
    res.status(500).json({ success: false, message: "Error exporting employees", error: error.message });
  }
});

// ======================================================
// GET SINGLE EMPLOYEE
// GET /api/employees/:id
// ======================================================

router.get("/:id", auth, async (req, res) => {
  try {
    // --------------------------------------------------
    // VALIDATE EMPLOYEE ID
    // --------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    // --------------------------------------------------
    // FIND EMPLOYEE
    // --------------------------------------------------

    const employee = await Employee.findById(
      req.params.id
    )
      .populate(
        "company",
        "name shortName logo"
      )
      .populate(
        "manager",
        "firstName lastName employeeNumber jobTitle"
      )
      .populate("department", "name permissionKey translations")
      .populate("jobPosition", "title salaryBandMin salaryBandMax currency description requiredSkills translations");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // --------------------------------------------------
    // CHECK COMPANY ACCESS
    // --------------------------------------------------

    if (!canManage(req, employee.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this employee",
      });
    }

    // --------------------------------------------------
    // LINKED USER ACCOUNT (self-service)
    // --------------------------------------------------

    const linkedUser = await User.findOne({
      employee: employee._id,
    }).select("firstName lastName email");

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    res.json({
      success: true,
      data: employee,
      linkedUser: linkedUser || null,
    });
  } catch (error) {
    console.error(
      "GET employee error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Error fetching employee",
      error: error.message,
    });
  }
});

// ======================================================
// CREATE EMPLOYEE
// POST /api/employees
// ======================================================

router.post(
  "/",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      const {
        company,
        employeeNumber,
        firstName,
        lastName,
        // Ignored on purpose — work email is always auto-generated
        // below (firstname.lastname@company.frame, with a number
        // appended on collision), never taken from the client. See
        // services/employeeAccountService.js: generateWorkEmail.
        workEmail: _ignoredWorkEmail,
        // Not spread into the Employee document below — this is a
        // request-only flag, not an Employee field. Defaults to
        // true: unless HR explicitly opts out, creating an
        // employee also creates their self-service login (see
        // services/employeeAccountService.js).
        createLogin = true,
        ...rest
      } = req.body;

      // --------------------------------------------------
      // REQUIRED FIELDS
      // --------------------------------------------------

      if (!company) {
        return res.status(400).json({
          success: false,
          message: "Company is required",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(company)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid company ID",
        });
      }

      if (!employeeNumber) {
        return res.status(400).json({
          success: false,
          message: "Employee number is required",
        });
      }

      if (!firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message:
            "First name and last name are required",
        });
      }

      // --------------------------------------------------
      // FIND COMPANY
      // --------------------------------------------------

      const companyDoc = await Company.findById(
        company
      );

      if (!companyDoc) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      // --------------------------------------------------
      // CHECK ACCESS
      // --------------------------------------------------

      if (!canManage(req, companyDoc)) {
        return res.status(403).json({
          success: false,
          message:
            "Not authorized to create employees for this company",
        });
      }

      if (!canManageEmployeeRecords(req.user)) {
        return res.status(403).json({
          success: false,
          message:
            "Creating employees requires Chargé RH authority or higher",
        });
      }

      // --------------------------------------------------
      // CHECK EMPLOYEE NUMBER
      // --------------------------------------------------

      const normalizedEmployeeNumber =
        employeeNumber
          .trim()
          .toUpperCase();

      const existingEmployee =
        await Employee.findOne({
          company,
          employeeNumber:
            normalizedEmployeeNumber,
        });

      if (existingEmployee) {
        return res.status(409).json({
          success: false,
          message:
            "Employee number already exists",
        });
      }

      // --------------------------------------------------
      // CREATE EMPLOYEE
      // --------------------------------------------------

      const workEmail = await generateWorkEmail(firstName, lastName);

      const employee =
        await Employee.create({
          company,

          employeeNumber:
            normalizedEmployeeNumber,

          firstName,
          lastName,
          workEmail,

          ...rest,

          createdBy: req.user.id,
          updatedBy: req.user.id,
        });

      // --------------------------------------------------
      // UPDATE COMPANY EMPLOYEE COUNT
      // --------------------------------------------------

      await Company.findByIdAndUpdate(
        company,
        {
          $inc: {
            employeeCount: 1,
          },
        }
      );

      // --------------------------------------------------
      // OPTIONAL: CREATE SELF-SERVICE LOGIN
      // --------------------------------------------------
      // Best-effort — a missing/duplicate work email should not
      // fail the employee creation itself, just skip the login and
      // tell HR why via `loginError` in the response so they can
      // create one later from the employee's "Self-service access"
      // panel once the email issue is fixed.

      let generatedLogin = null;
      let loginError = null;

      if (createLogin) {
        try {
          const { temporaryPassword } = await createLoginForEmployee(
            employee,
            req.user.id
          );
          generatedLogin = {
            email: employee.workEmail,
            temporaryPassword,
          };
        } catch (err) {
          loginError = err.message;
        }
      }

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      await logAudit(req, {
        company,
        action: "create",
        resourceType: "Employee",
        resourceId: employee._id,
        resourceLabel: `${firstName} ${lastName}`,
        after: employee.toObject(),
      });

      await employee.populate([
        { path: "department", select: "name permissionKey" },
        { path: "jobPosition", select: "title salaryBandMin salaryBandMax currency" },
      ]);

      res.status(201).json({
        success: true,
        data: employee,
        generatedLogin,
        loginError,
        message:
          "Employee created successfully",
      });
    } catch (error) {
      console.error(
        "CREATE employee error:",
        error
      );

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "Employee number, CIN or CNSS number already exists",
          error: error.message,
        });
      }

      res.status(400).json({
        success: false,
        message: "Error creating employee",
        error: error.message,
      });
    }
  }
);

// ======================================================
// UPDATE EMPLOYEE
// PUT /api/employees/:id
// ======================================================

router.put(
  "/:id",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      // --------------------------------------------------
      // VALIDATE ID
      // --------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      // --------------------------------------------------
      // FIND EMPLOYEE
      // --------------------------------------------------

      const employee =
        await Employee.findById(
          req.params.id
        );

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // --------------------------------------------------
      // FIND COMPANY
      // --------------------------------------------------

      const company =
        await Company.findById(
          employee.company
        );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      // --------------------------------------------------
      // CHECK ACCESS
      // --------------------------------------------------

      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message:
            "Not authorized to update this employee",
        });
      }

      if (!canManageEmployeeRecords(req.user)) {
        return res.status(403).json({
          success: false,
          message:
            "Editing employees requires Chargé RH authority or higher",
        });
      }

      // --------------------------------------------------
      // PROTECTED FIELDS
      // --------------------------------------------------

      delete req.body.company;
      delete req.body.createdBy;
      delete req.body.updatedBy;
      delete req.body.createdAt;
      delete req.body.updatedAt;

      // Photo has its own endpoint
      delete req.body.photo;

      // --------------------------------------------------
      // UPDATE
      // --------------------------------------------------

      const before = employee.toObject();

      Object.assign(
        employee,
        req.body
      );

      employee.updatedBy =
        req.user.id;

      await employee.save();

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      await logAudit(req, {
        company: company._id,
        action: "update",
        resourceType: "Employee",
        resourceId: employee._id,
        resourceLabel: `${employee.firstName} ${employee.lastName}`,
        before,
        after: employee.toObject(),
      });

      await employee.populate([
        { path: "department", select: "name permissionKey" },
        { path: "jobPosition", select: "title salaryBandMin salaryBandMax currency" },
      ]);

      res.json({
        success: true,
        data: employee,
        message:
          "Employee updated successfully",
      });
    } catch (error) {
      console.error(
        "UPDATE employee error:",
        error
      );

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "Employee number, CIN or CNSS number already exists",
          error: error.message,
        });
      }

      res.status(400).json({
        success: false,
        message: "Error updating employee",
        error: error.message,
      });
    }
  }
);

// ======================================================
// UPLOAD / REPLACE EMPLOYEE PHOTO
// POST /api/employees/:id/photo
// ======================================================

router.post(
  "/:id/photo",
  auth,
  requireHRAccess,
  upload.single("photo"),
  async (req, res) => {
    try {
      // --------------------------------------------------
      // VALIDATE ID
      // --------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      // --------------------------------------------------
      // FIND EMPLOYEE
      // --------------------------------------------------

      const employee =
        await Employee.findById(
          req.params.id
        );

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // --------------------------------------------------
      // FIND COMPANY
      // --------------------------------------------------

      const company =
        await Company.findById(
          employee.company
        );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      // --------------------------------------------------
      // CHECK ACCESS
      // --------------------------------------------------

      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message:
            "Not authorized to update this employee",
        });
      }

      // --------------------------------------------------
      // CHECK FILE
      // --------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a photo",
        });
      }

      // --------------------------------------------------
      // DELETE OLD PHOTO
      // --------------------------------------------------

      if (employee.photo?.publicId) {
        await deleteImage(
          employee.photo.publicId
        );
      }

      // --------------------------------------------------
      // UPLOAD NEW PHOTO
      // --------------------------------------------------

      const result = await uploadImage(
        req.file.buffer,
        `frame/companies/${company._id}/employees/${employee._id}/photo`
      );

      // --------------------------------------------------
      // SAVE CLOUDINARY DATA
      // --------------------------------------------------

      employee.photo = {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        uploadedAt: new Date(),
      };

      employee.updatedBy =
        req.user.id;

      await employee.save();

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      res.json({
        success: true,
        data: employee,
        message:
          "Employee photo uploaded successfully",
      });
    } catch (error) {
      console.error(
        "Employee photo upload error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Error uploading employee photo",
        error: error.message,
      });
    }
  }
);

// ======================================================
// DELETE EMPLOYEE PHOTO
// DELETE /api/employees/:id/photo
// ======================================================

router.delete(
  "/:id/photo",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      // --------------------------------------------------
      // VALIDATE ID
      // --------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      // --------------------------------------------------
      // FIND EMPLOYEE
      // --------------------------------------------------

      const employee =
        await Employee.findById(
          req.params.id
        );

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // --------------------------------------------------
      // FIND COMPANY
      // --------------------------------------------------

      const company =
        await Company.findById(
          employee.company
        );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      // --------------------------------------------------
      // CHECK ACCESS
      // --------------------------------------------------

      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message:
            "Not authorized to update this employee",
        });
      }

      // --------------------------------------------------
      // CHECK PHOTO
      // --------------------------------------------------

      if (!employee.photo?.publicId) {
        return res.status(404).json({
          success: false,
          message:
            "Employee photo not found",
        });
      }

      // --------------------------------------------------
      // DELETE FROM CLOUDINARY
      // --------------------------------------------------

      await deleteImage(
        employee.photo.publicId
      );

      // --------------------------------------------------
      // DELETE FROM MONGODB
      // --------------------------------------------------

      employee.photo = undefined;

      employee.updatedBy =
        req.user.id;

      await employee.save();

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      res.json({
        success: true,
        data: employee,
        message:
          "Employee photo deleted successfully",
      });
    } catch (error) {
      console.error(
        "Employee photo delete error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Error deleting employee photo",
        error: error.message,
      });
    }
  }
);

// ======================================================
// DELETE EMPLOYEE
// DELETE /api/employees/:id
// ======================================================

router.delete(
  "/:id",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      // --------------------------------------------------
      // VALIDATE ID
      // --------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      // --------------------------------------------------
      // FIND EMPLOYEE
      // --------------------------------------------------

      const employee =
        await Employee.findById(
          req.params.id
        );

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // --------------------------------------------------
      // FIND COMPANY
      // --------------------------------------------------

      const company =
        await Company.findById(
          employee.company
        );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      // --------------------------------------------------
      // CHECK ACCESS
      // --------------------------------------------------

      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message:
            "Not authorized to delete this employee",
        });
      }

      if (!canDeleteEmployee(req.user)) {
        return res.status(403).json({
          success: false,
          message:
            "Deleting an employee requires Responsable RH authority or higher",
        });
      }

      // --------------------------------------------------
      // DELETE EMPLOYEE PHOTO FROM CLOUDINARY
      // --------------------------------------------------

      if (employee.photo?.publicId) {
        await deleteImage(
          employee.photo.publicId
        );
      }

      // --------------------------------------------------
      // DELETE EMPLOYEE
      // --------------------------------------------------

      await Employee.findByIdAndDelete(
        req.params.id
      );

      // --------------------------------------------------
      // DECREASE COMPANY EMPLOYEE COUNT
      // --------------------------------------------------

      await Company.findByIdAndUpdate(
        employee.company,
        {
          $inc: {
            employeeCount: -1,
          },
        }
      );

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      await logAudit(req, {
        company: employee.company,
        action: "delete",
        resourceType: "Employee",
        resourceId: employee._id,
        resourceLabel: `${employee.firstName} ${employee.lastName}`,
        before: employee.toObject(),
      });

      res.json({
        success: true,
        message:
          "Employee deleted successfully",
        employeeId: employee._id,
      });
    } catch (error) {
      console.error(
        "DELETE employee error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Error deleting employee",
        error: error.message,
      });
    }
  }
);

// ======================================================
// CREATE A NEW LOGIN FOR AN EXISTING EMPLOYEE
// POST /api/employees/:id/create-login
// For employees created before this feature existed, or whose
// login wasn't created at creation time (e.g. missing work email
// back then). Generates a new User + temporary password the same
// way employee creation does — see services/employeeAccountService.js.
// ======================================================

router.post(
  "/:id/create-login",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid employee ID" });
      }

      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }

      const company = await Company.findById(employee.company);
      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to create a login for this employee",
        });
      }

      const { temporaryPassword } = await createLoginForEmployee(employee, req.user.id);

      await logAudit(req, {
        company: company._id,
        action: "update",
        resourceType: "Employee",
        resourceId: employee._id,
        resourceLabel: `Created login for ${employee.workEmail}`,
      });

      res.status(201).json({
        success: true,
        message: "Login created successfully",
        data: { email: employee.workEmail, temporaryPassword },
      });
    } catch (error) {
      console.error("POST create-login error:", error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Error creating login",
      });
    }
  }
);

// ======================================================
// RESET PASSWORD FOR AN EMPLOYEE'S LINKED LOGIN
// POST /api/employees/:id/reset-password
// ======================================================

router.post(
  "/:id/reset-password",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid employee ID" });
      }

      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }

      const company = await Company.findById(employee.company);
      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to reset this employee's password",
        });
      }

      const { user, temporaryPassword } = await resetPasswordForEmployee(employee._id);

      await logAudit(req, {
        company: company._id,
        action: "update",
        resourceType: "Employee",
        resourceId: employee._id,
        resourceLabel: `Reset password for ${user.email}`,
      });

      res.json({
        success: true,
        message: "Password reset successfully",
        data: { email: user.email, temporaryPassword },
      });
    } catch (error) {
      console.error("POST reset-password error:", error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Error resetting password",
      });
    }
  }
);

// ======================================================
// LINK / UNLINK A USER ACCOUNT (self-service access)
// PATCH /api/employees/:id/link-user
// body: { userId }
// PATCH /api/employees/:id/unlink-user
// ======================================================
// This is what turns on the self-service space (My Payslips, My
// Absences, ...) for an employee — see permissions/permissions.js
// canSelfService and routes/me.js. A User can only be linked to
// ONE employee at a time; linking to a second employee first
// unlinks it from whichever one it was linked to before.

router.patch(
  "/:id/link-user",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid employee ID" });
      }

      const { userId } = req.body;
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "A valid userId is required" });
      }

      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }

      const company = await Company.findById(employee.company);
      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to link a user to this employee",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Unlink this employee from whoever had it before, and unlink
      // this user from whichever employee they had before — keeps
      // the relationship one-to-one without needing a unique index
      // headache on optional/null fields.
      await User.updateMany(
        { employee: employee._id },
        { $set: { employee: null } }
      );

      user.employee = employee._id;
      await user.save();

      await logAudit(req, {
        company: company._id,
        action: "update",
        resourceType: "Employee",
        resourceId: employee._id,
        resourceLabel: `Linked user ${user.email}`,
      });

      res.json({
        success: true,
        message: "User account linked to employee",
        data: { employeeId: employee._id, userId: user._id },
      });
    } catch (error) {
      console.error("PATCH link-user error:", error);
      res.status(500).json({ success: false, message: "Error linking user", error: error.message });
    }
  }
);

router.patch(
  "/:id/unlink-user",
  auth,
  requireHRAccess,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid employee ID" });
      }

      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }

      const company = await Company.findById(employee.company);
      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to unlink this employee's user account",
        });
      }

      await User.updateMany(
        { employee: employee._id },
        { $set: { employee: null } }
      );

      await logAudit(req, {
        company: company._id,
        action: "update",
        resourceType: "Employee",
        resourceId: employee._id,
        resourceLabel: "Unlinked user account",
      });

      res.json({ success: true, message: "User account unlinked" });
    } catch (error) {
      console.error("PATCH unlink-user error:", error);
      res.status(500).json({ success: false, message: "Error unlinking user", error: error.message });
    }
  }
);

// ======================================================
// BULK EMPLOYEE IMPORT (CSV)
// POST /api/employees/bulk-import/preview   — multipart, field "file"
// POST /api/employees/bulk-import/commit    — JSON { companyId, rows }
// ======================================================
// Both require Chargé RH authority or higher (same tier as
// creating a single employee) — bulk import is just many employee
// creations at once, so it's gated the same way.

router.post(
  "/bulk-import/preview",
  auth,
  requireHRAccess,
  uploadCsv.single("file"),
  async (req, res) => {
    try {
      const { companyId } = req.body;
      if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({ success: false, message: "A valid companyId is required" });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: "A CSV file is required" });
      }

      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }
      if (!canManage(req, company)) {
        return res.status(403).json({ success: false, message: "Not authorized to import employees for this company" });
      }
      if (!canManageEmployeeRecords(req.user)) {
        return res.status(403).json({
          success: false,
          message: "Importing employees requires Chargé RH authority or higher",
        });
      }

      const result = await previewImport(req.file.buffer, company);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("POST bulk-import preview error:", error);
      res.status(error.status || 500).json({ success: false, message: error.message || "Error previewing import" });
    }
  }
);

router.post("/bulk-import/commit", auth, requireHRAccess, async (req, res) => {
  try {
    const { companyId, rows } = req.body;
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "A valid companyId is required" });
    }
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: "rows must be an array (from a prior /bulk-import/preview call)" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, company)) {
      return res.status(403).json({ success: false, message: "Not authorized to import employees for this company" });
    }
    if (!canManageEmployeeRecords(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Importing employees requires Chargé RH authority or higher",
      });
    }

    // Rows with a hard error from the preview step should never
    // reach commit — the frontend filters them out, but this is
    // the actual security/data-integrity boundary, not that.
    const importableRows = rows.filter((row) => !row.errors || row.errors.length === 0);
    if (importableRows.length === 0) {
      return res.status(400).json({ success: false, message: "No valid rows to import" });
    }

    const result = await commitImport(importableRows, company, req.user.id);

    await logAudit(req, {
      company: company._id,
      action: "create",
      resourceType: "EmployeeBulkImport",
      resourceId: company._id,
      resourceLabel: `${result.createdCount} employees imported`,
      after: { createdCount: result.createdCount },
    });

    res.json({ success: true, data: { createdCount: result.createdCount }, message: `${result.createdCount} employee(s) imported successfully` });
  } catch (error) {
    console.error("POST bulk-import commit error:", error);
    res.status(error.status || 500).json({ success: false, message: error.message || "Error committing import" });
  }
});

// ======================================================
// EMPLOYEE DOCUMENTS (attestations & certificat de travail) — PDF
// GET /api/employees/:id/documents/:type/pdf
//   :type is one of: attestation-travail, attestation-salaire, certificat-travail
// ======================================================

router.get("/:id/documents/:type/pdf", auth, requireHRAccess, async (req, res) => {
  try {
    const { id, type } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid employee ID" });
    }

    const GENERATORS = {
      "attestation-travail": { fn: generateAttestationTravail, filenamePrefix: "attestation-travail", needsSalary: false },
      "attestation-salaire": { fn: generateAttestationSalaire, filenamePrefix: "attestation-salaire", needsSalary: true },
      "certificat-travail": { fn: generateCertificatTravail, filenamePrefix: "certificat-travail", needsSalary: false },
      "contrat-travail": { fn: generateContratTravail, filenamePrefix: "contrat-travail", needsSalary: true, needsContract: true },
      "solde-tout-compte": { fn: generateSoldeToutCompte, filenamePrefix: "solde-tout-compte", needsSalary: true, needsLeaveBalance: true },
    };
    const generatorSpec = GENERATORS[type];
    if (!generatorSpec) {
      return res.status(400).json({
        success: false,
        message: `Unknown document type "${type}". Expected one of: ${Object.keys(GENERATORS).join(", ")}`,
      });
    }

    const employee = await Employee.findById(id)
      .populate("company")
      .populate("department", "name");

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    if (!canManage(req, employee.company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to generate documents for this employee",
      });
    }

    // The company's legal representative line is drawn from
    // company.owner (see pdfHelpers/employeeDocumentsPdfService) —
    // populate it here since the `.populate("company")` above only
    // pulls the Company document itself, not its own owner ref.
    await employee.company.populate("owner", "firstName lastName");

    let salary = null;
    if (generatorSpec.needsSalary) {
      salary = await Salary.findOne({ employee: employee._id, endDate: null }).sort({ startDate: -1 });
    }

    let contract = null;
    if (generatorSpec.needsContract) {
      contract = await Contract.findOne({ employee: employee._id }).sort({ startDate: -1 });
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "This employee has no contract on file yet — add one from the Contracts page before generating this document.",
        });
      }
    }

    let leaveBalance = null;
    if (generatorSpec.needsLeaveBalance) {
      leaveBalance = await getLeaveBalance(employee, employee.terminationDate || new Date());
    }

    const logoBuffer = await fetchLogoBuffer(employee.company);

    const doc = generatorSpec.fn({
      employee,
      company: employee.company,
      salary,
      contract,
      leaveBalance,
      terminationDate: employee.terminationDate,
      logoBuffer,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${generatorSpec.filenamePrefix}-${employee.employeeNumber || employee._id}.pdf"`
    );
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("GET employee document PDF error:", error);
    res.status(500).json({ success: false, message: "Error generating document", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (jobTitle, service, position, workLocation, notes)
// see config/i18nContent.js
// ======================================================
// This router applies auth/requireHRAccess per-route rather than
// with a single router.use(...) at the top, so both are passed in
// here explicitly too, matching PUT /:id above.

attachTranslationRoutes(router, Employee, {
  resourceType: "Employee",
  middleware: [auth, requireHRAccess],
  authorize: async (req, doc) => {
    const company = await Company.findById(doc.company);
    return canManage(req, company);
  },
});

module.exports = router;