const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const InventoryCategory = require("../models/InventoryCategory");
const Product = require("../models/Product");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireProductionAccess, requireInventoryViewAccess } = require("../middleware/permissionMiddleware");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const { loadTree, MAX_DEPTH } = require("../services/categoryTree");

// Reading is shared with the purchasing team (they look articles up
// and follow purchase history); every change stays production-only.
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.inventoryCategories));
router.use(auth);

// ======================================================
// GET ALL CATEGORIES
// GET /api/inventory-categories?companyId=
// ======================================================

router.get("/", requireInventoryViewAccess, async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "A valid companyId is required" });
    }
    // Tree order with fullName ("Profilés aluminium › Série 78"), depth,
    // and how many articles each one holds directly.
    const [tree, products] = await Promise.all([
      loadTree(companyId),
      Product.find({ company: companyId }).select("category").lean(),
    ]);
    const counts = new Map();
    for (const p of products) counts.set(String(p.category), (counts.get(String(p.category)) || 0) + 1);
    res.json({ success: true, data: tree.map((c) => ({ ...c, productCount: counts.get(String(c._id)) || 0 })) });
  } catch (error) {
    console.error("GET inventory categories error:", error);
    res.status(500).json({ success: false, message: "Error fetching categories", error: error.message });
  }
});

/**
 * Validates a parent for `selfId` (null on create): same company, not
 * itself nor one of its own sub-categories, and not deeper than MAX_DEPTH.
 * Returns the parent id (or null) — throws { status, message } otherwise.
 */
async function checkParent(companyId, parentId, selfId = null) {
  if (!parentId) return null;
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!mongoose.Types.ObjectId.isValid(parentId)) fail("Invalid parent category");
  const tree = await loadTree(companyId);
  const parent = tree.find((c) => String(c._id) === String(parentId));
  if (!parent) fail("Parent category not found");
  if (selfId && (String(parent._id) === String(selfId) || parent.path.includes(String(selfId)))) {
    fail("A category can't be placed inside itself or one of its sub-categories");
  }
  // Depth of the moved branch (a category with sub-categories moves with them).
  let below = 0;
  if (selfId) {
    const self = tree.find((c) => String(c._id) === String(selfId));
    for (const c of tree) if (c.path.includes(String(selfId))) below = Math.max(below, c.depth - (self?.depth || 0));
  }
  if (parent.depth + 1 + below >= MAX_DEPTH) fail(`At most ${MAX_DEPTH} levels of categories`);
  return parent._id;
}

/** Same name already used next to it (same parent)? Case-insensitive. */
async function siblingNameTaken(companyId, parentId, name, selfId = null) {
  const rx = new RegExp(`^${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const filter = { company: companyId, parent: parentId || null, name: rx };
  if (selfId) filter._id = { $ne: selfId };
  return !!(await InventoryCategory.exists(filter));
}

// ======================================================
// CREATE CATEGORY
// POST /api/inventory-categories
// ======================================================

router.post("/", requireProductionAccess, async (req, res) => {
  try {
    const { company, name, icon, color, description, accountingAccount, isFixedAsset } = req.body;
    let parent = null;

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
    try {
      parent = await checkParent(company, req.body.parent);
    } catch (e) {
      return res.status(e.status || 400).json({ success: false, message: e.message });
    }

    if (await siblingNameTaken(company, parent, name)) {
      return res.status(409).json({ success: false, message: "A category with this name already exists here" });
    }

    const category = await InventoryCategory.create({
      company,
      name,
      parent,
      icon: icon || "Package",
      color,
      description,
      accountingAccount: accountingAccount || "",
      isFixedAsset: !!isFixedAsset,
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
      return res.status(409).json({ success: false, message: "A category with this name already exists here" });
    }
    console.error("POST inventory category error:", error);
    res.status(500).json({ success: false, message: "Error creating category", error: error.message });
  }
});

// ======================================================
// UPDATE CATEGORY
// PUT /api/inventory-categories/:id
// ======================================================

router.put("/:id", requireProductionAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await InventoryCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const before = category.toObject();

    const { name, icon, color, description, accountingAccount, isFixedAsset } = req.body;
    if (req.body.parent !== undefined) {
      try {
        category.parent = await checkParent(category.company, req.body.parent || null, category._id);
      } catch (e) {
        return res.status(e.status || 400).json({ success: false, message: e.message });
      }
    }
    if (accountingAccount !== undefined) category.accountingAccount = String(accountingAccount || "").trim();
    if (isFixedAsset !== undefined) category.isFixedAsset = !!isFixedAsset;
    if (name !== undefined) category.name = name;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (description !== undefined) category.description = description;
    category.updatedBy = req.user.id;
    if (await siblingNameTaken(category.company, category.parent, category.name, category._id)) {
      return res.status(409).json({ success: false, message: "A category with this name already exists here" });
    }

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
      return res.status(409).json({ success: false, message: "A category with this name already exists here" });
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

router.delete("/:id", requireProductionAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await InventoryCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const subCount = await InventoryCategory.countDocuments({ parent: category._id });
    if (subCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This category still has ${subCount} sub-categor${subCount > 1 ? "ies" : "y"} — move or delete them first.`,
      });
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

// ======================================================
// TRANSLATIONS (name, description) — fr/en/ar
// ======================================================

attachTranslationRoutes(router, InventoryCategory, { resourceType: "InventoryCategory" });

module.exports = router;
