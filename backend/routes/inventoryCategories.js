const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const InventoryCategory = require("../models/InventoryCategory");
const Product = require("../models/Product");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { requireProductionAccess } = require("../middleware/permissionMiddleware");
const { logAudit } = require("../services/auditLogger");

router.use(auth, requireProductionAccess);

// ======================================================
// GET ALL CATEGORIES
// GET /api/inventory-categories?companyId=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const categories = await InventoryCategory.find({ company: companyId }).sort({ name: 1 });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error("GET inventory categories error:", error);
    res.status(500).json({ success: false, message: "Error fetching categories", error: error.message });
  }
});

// ======================================================
// CREATE CATEGORY
// POST /api/inventory-categories
// ======================================================

router.post("/", async (req, res) => {
  try {
    const { company, name, icon, color, description } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const category = await InventoryCategory.create({
      company,
      name,
      icon: icon || "Package",
      color,
      description,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "InventoryCategory",
      resourceId: category._id,
      resourceLabel: name,
      after: category.toObject(),
    });

    res.status(201).json({ success: true, data: category, message: "Category created successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A category with this name already exists" });
    }
    console.error("POST inventory category error:", error);
    res.status(500).json({ success: false, message: "Error creating category", error: error.message });
  }
});

// ======================================================
// UPDATE CATEGORY
// PUT /api/inventory-categories/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await InventoryCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const before = category.toObject();

    const { name, icon, color, description } = req.body;
    if (name !== undefined) category.name = name;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (description !== undefined) category.description = description;
    category.updatedBy = req.user.id;

    await category.save();

    await logAudit(req, {
      company: category.company,
      action: "update",
      resourceType: "InventoryCategory",
      resourceId: category._id,
      before,
      after: category.toObject(),
    });

    res.json({ success: true, data: category, message: "Category updated successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A category with this name already exists" });
    }
    console.error("PUT inventory category error:", error);
    res.status(500).json({ success: false, message: "Error updating category", error: error.message });
  }
});

// ======================================================
// DELETE CATEGORY
// DELETE /api/inventory-categories/:id
// Refuses if any product still uses it — avoids silently
// orphaning products or having to cascade-delete stock records.
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await InventoryCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This category still has ${productCount} product(s) — reassign or delete them first.`,
      });
    }

    await InventoryCategory.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: category.company,
      action: "delete",
      resourceType: "InventoryCategory",
      resourceId: category._id,
      resourceLabel: category.name,
      before: category.toObject(),
    });

    res.json({ success: true, message: "Category deleted successfully", categoryId: category._id });
  } catch (error) {
    console.error("DELETE inventory category error:", error);
    res.status(500).json({ success: false, message: "Error deleting category", error: error.message });
  }
});

module.exports = router;
