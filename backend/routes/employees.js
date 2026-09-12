const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const upload = require("../middleware/uploadMiddleware");
const {
  requireHRAccess,
} = require("../middleware/permissionMiddleware");

const {
  canAccessHRForCompany,
} = require("../permissions/permissions");

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
      );

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
    // RESPONSE
    // --------------------------------------------------

    res.json({
      success: true,
      data: employee,
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

      const employee =
        await Employee.create({
          company,

          employeeNumber:
            normalizedEmployeeNumber,

          firstName,
          lastName,

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
      // RESPONSE
      // --------------------------------------------------

      res.status(201).json({
        success: true,
        data: employee,
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

module.exports = router;