const express = require("express");
const router = express.Router();

const Company = require("../models/Company");
const auth = require("../middleware/auth");
const upload = require("../middleware/uploadMiddleware");

const {
  uploadImage,
  deleteImage,
} = require("../services/cloudinaryService");

// ======================================================
// HELPER
// ======================================================

const canManage = (req, company) => {
  return (
    req.user.role === "admin" ||
    company.owner.toString() === req.user.id
  );
};

// ======================================================
// GET ALL COMPANIES
// ======================================================

router.get("/", auth, async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { owner: req.user.id };

    const companies = await Company.find(filter)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: companies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching companies",
      error: error.message,
    });
  }
});

// ======================================================
// GET SINGLE COMPANY
// ======================================================

router.get("/:id", auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (!canManage(req, company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this company",
      });
    }

    res.json({
      success: true,
      data: company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching company",
      error: error.message,
    });
  }
});

// ======================================================
// CREATE COMPANY
// ======================================================

router.post("/", auth, async (req, res) => {
  try {
    const company = await Company.create({
      ...req.body,

      owner: req.user.id,
      createdBy: req.user.id,
      updatedBy: req.user.id,

      // Start at zero
      employeeCount: 0,
    });

    res.status(201).json({
      success: true,
      data: company,
      message: "Company created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A company with this ICE, tax ID, registration number, or CNSS number already exists",
        error: error.message,
      });
    }

    res.status(400).json({
      success: false,
      message: "Error creating company",
      error: error.message,
    });
  }
});

// ======================================================
// UPDATE COMPANY
// ======================================================

router.put("/:id", auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (!canManage(req, company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this company",
      });
    }

    // Never allow these fields to be changed from frontend
    delete req.body.owner;
    delete req.body.createdBy;
    delete req.body.updatedBy;
    delete req.body.createdAt;
    delete req.body.updatedAt;

    // Employee count will be managed by employee system
    delete req.body.employeeCount;

    // Logo has its own endpoint
    delete req.body.logo;

    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user.id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.json({
      success: true,
      data: updated,
      message: "Company updated successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A company with this ICE, tax ID, registration number, or CNSS number already exists",
        error: error.message,
      });
    }

    res.status(400).json({
      success: false,
      message: "Error updating company",
      error: error.message,
    });
  }
});

// ======================================================
// UPLOAD / REPLACE COMPANY LOGO
// ======================================================

router.post(
  "/:id/logo",
  auth,
  upload.single("logo"),
  async (req, res) => {
    try {
      const company = await Company.findById(req.params.id);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this company",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a logo",
        });
      }

      // --------------------------------------------
      // DELETE OLD LOGO FROM CLOUDINARY
      // --------------------------------------------

      if (company.logo?.publicId) {
        await deleteImage(company.logo.publicId);
      }

      // --------------------------------------------
      // UPLOAD NEW LOGO
      // --------------------------------------------

      const result = await uploadImage(
        req.file.buffer,
        `frame/companies/${company._id}/logo`
      );

      // --------------------------------------------
      // SAVE CLOUDINARY DATA IN MONGODB
      // --------------------------------------------

      company.logo = {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        uploadedAt: new Date(),
      };

      company.updatedBy = req.user.id;

      await company.save();

      res.json({
        success: true,
        data: company,
        message: "Company logo uploaded successfully",
      });
    } catch (error) {
      console.error("Logo upload error:", error);

      res.status(500).json({
        success: false,
        message: "Error uploading company logo",
        error: error.message,
      });
    }
  }
);

// ======================================================
// DELETE COMPANY LOGO
// ======================================================

router.delete(
  "/:id/logo",
  auth,
  async (req, res) => {
    try {
      const company = await Company.findById(req.params.id);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      if (!canManage(req, company)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this company",
        });
      }

      if (!company.logo?.publicId) {
        return res.status(404).json({
          success: false,
          message: "Company logo not found",
        });
      }

      // Delete from Cloudinary
      await deleteImage(company.logo.publicId);

      // Delete from MongoDB
      company.logo = undefined;
      company.updatedBy = req.user.id;

      await company.save();

      res.json({
        success: true,
        data: company,
        message: "Company logo deleted successfully",
      });
    } catch (error) {
      console.error("Logo delete error:", error);

      res.status(500).json({
        success: false,
        message: "Error deleting company logo",
        error: error.message,
      });
    }
  }
);

// ======================================================
// DELETE COMPANY
// ======================================================

router.delete("/:id", auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (!canManage(req, company)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this company",
      });
    }

    // Delete company logo from Cloudinary first
    if (company.logo?.publicId) {
      await deleteImage(company.logo.publicId);
    }

    await Company.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Company deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting company",
      error: error.message,
    });
  }
});

module.exports = router;