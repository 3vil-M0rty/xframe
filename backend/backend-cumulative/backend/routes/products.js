const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");
const { applyMovement } = require("../services/inventoryService");
const InventoryCategory = require("../models/InventoryCategory");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const upload = require("../middleware/uploadMiddleware");
const { requireProductionAccess, requireInventoryViewAccess } = require("../middleware/permissionMiddleware");
const { canAccessProduction } = require("../permissions/permissions");
const { uploadImage, deleteImage } = require("../services/cloudinaryService");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");

// Reading is shared with the purchasing team (they look articles up
// and follow purchase history); every change stays production-only.
router.use(auth);

// applyMovement lives in services/inventoryService.js so purchase
// order receptions/returns share the exact same stock logic.

// ======================================================
// GET ALL PRODUCTS (search, category, low-stock, as-of-date, pagination)
// GET /api/products?companyId=&category=&search=&lowStockOnly=&asOfDate=&page=&limit=
// ======================================================

router.get("/", requireInventoryViewAccess, async (req, res) => {
  try {
    const {
      companyId,
      category,
      search,
      lowStockOnly,
      asOfDate,
      page = 1,
      limit = 24,
    } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const filter = { company: new mongoose.Types.ObjectId(companyId) };

    if (category) filter.category = new mongoose.Types.ObjectId(category);

    if (search) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: regex },
        { internalReference: regex },
        { "prices.supplierReference": regex },
      ];
    }

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    if (asOfDate) {
      // Historical view — needs the aggregation pipeline below to
      // compute each product's quantity AS OF that date, since
      // Product.quantity only ever reflects "right now".
      const cutoff = new Date(asOfDate);
      cutoff.setHours(23, 59, 59, 999);

      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "inventorymovements",
            let: { productId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$product", "$$productId"] },
                      { $lte: ["$createdAt", cutoff] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "asOfMovement",
          },
        },
        {
          $addFields: {
            quantity: {
              $ifNull: [{ $arrayElemAt: ["$asOfMovement.resultingQuantity", 0] }, 0],
            },
          },
        },
        { $project: { asOfMovement: 0 } },
        { $sort: { name: 1 } },
        { $skip: (currentPage - 1) * currentLimit },
        { $limit: currentLimit },
      ];

      const [products, totalArr] = await Promise.all([
        Product.aggregate(pipeline),
        Product.aggregate([{ $match: filter }, { $count: "total" }]),
      ]);

      const populated = await Product.populate(products, { path: "category" });

      const filtered = lowStockOnly === "true"
        ? populated.filter((p) => p.quantity <= (p.threshold || 0))
        : populated;

      return res.json({
        success: true,
        data: filtered,
        pagination: {
          total: totalArr[0]?.total || 0,
          page: currentPage,
          limit: currentLimit,
          pages: Math.ceil((totalArr[0]?.total || 0) / currentLimit) || 1,
        },
        asOfDate: cutoff,
      });
    }

    // Fast path — current quantity, no historical lookup needed.
    if (lowStockOnly === "true") {
      filter.$expr = { $lte: ["$quantity", "$threshold"] };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category")
        .sort({ name: 1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET products error:", error);
    res.status(500).json({ success: false, message: "Error fetching products", error: error.message });
  }
});

// ======================================================
// SEARCH SUGGESTIONS (autocomplete — name or any reference)
// GET /api/products/suggestions?companyId=&q=
// ======================================================

router.get("/suggestions", requireInventoryViewAccess, async (req, res) => {
  try {
    const { companyId, q } = req.query;

    if (!companyId || !q || q.trim().length < 1) {
      return res.json({ success: true, data: [] });
    }

    const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const products = await Product.find({
      company: companyId,
      $or: [
        { name: regex },
        { internalReference: regex },
        { "prices.supplierReference": regex },
      ],
    })
      .select("name internalReference image quantity unit")
      .limit(10);

    res.json({ success: true, data: products });
  } catch (error) {
    console.error("GET product suggestions error:", error);
    res.status(500).json({ success: false, message: "Error fetching suggestions", error: error.message });
  }
});

// ======================================================
// GET SINGLE PRODUCT
// GET /api/products/:id
// ======================================================

router.get("/:id", requireInventoryViewAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id).populate("category");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error("GET product error:", error);
    res.status(500).json({ success: false, message: "Error fetching product", error: error.message });
  }
});

// ======================================================
// GET PRODUCT'S MOVEMENT HISTORY
// GET /api/products/:id/movements
// ======================================================

router.get("/:id/movements", requireInventoryViewAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const movements = await InventoryMovement.find({ product: req.params.id })
      .populate("performedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, data: movements });
  } catch (error) {
    console.error("GET product movements error:", error);
    res.status(500).json({ success: false, message: "Error fetching movement history", error: error.message });
  }
});

// ======================================================
// CREATE PRODUCT
// POST /api/products
// ======================================================

router.post("/", requireProductionAccess, async (req, res) => {
  try {
    const {
      company,
      category,
      name,
      internalReference,
      quantity,
      unit,
      threshold,
      prices,
      sellingPrice,
      currency,
      notes,
    } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ success: false, message: "A valid category is required" });
    }
    if (!name || !internalReference) {
      return res.status(400).json({ success: false, message: "Name and internal reference are required" });
    }

    const [companyDoc, categoryDoc] = await Promise.all([
      Company.findById(company),
      InventoryCategory.findOne({ _id: category, company }),
    ]);

    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!categoryDoc) {
      return res.status(404).json({ success: false, message: "Category not found in this company" });
    }

    const startingQuantity = Number(quantity) || 0;

    const product = await Product.create({
      company,
      category,
      name,
      internalReference,
      quantity: startingQuantity,
      unit: unit || "unit",
      threshold: Number(threshold) || 0,
      prices: prices || [],
      sellingPrice: sellingPrice || null,
      currency: currency || "MAD",
      notes,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    // Record the starting quantity as the product's first movement,
    // so "inventory as of date" works from day one instead of
    // treating pre-creation history as an unexplained gap.
    if (startingQuantity > 0) {
      await InventoryMovement.create({
        company,
        product: product._id,
        type: "in",
        quantity: startingQuantity,
        resultingQuantity: startingQuantity,
        reason: "Initial stock",
        performedBy: req.user.id,
      });
    }

    const populated = await product.populate("category");

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "Product",
      resourceId: product._id,
      resourceLabel: name,
      after: product.toObject(),
    });

    res.status(201).json({ success: true, data: populated, message: "Product created successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A product with this internal reference already exists" });
    }
    console.error("POST product error:", error);
    res.status(500).json({ success: false, message: "Error creating product", error: error.message });
  }
});

// ======================================================
// UPDATE PRODUCT (metadata only — use /adjust for quantity)
// PUT /api/products/:id
// ======================================================

router.put("/:id", requireProductionAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const before = product.toObject();

    const {
      category, name, internalReference, unit, threshold,
      prices, sellingPrice, currency, notes, isActive,
    } = req.body;

    if (category !== undefined) product.category = category;
    if (name !== undefined) product.name = name;
    if (internalReference !== undefined) product.internalReference = internalReference;
    if (unit !== undefined) product.unit = unit;
    if (threshold !== undefined) product.threshold = Number(threshold) || 0;
    if (prices !== undefined) product.prices = prices;
    if (sellingPrice !== undefined) product.sellingPrice = sellingPrice || null;
    if (currency !== undefined) product.currency = currency;
    if (notes !== undefined) product.notes = notes;
    if (isActive !== undefined) product.isActive = isActive;

    product.updatedBy = req.user.id;
    await product.save();

    const populated = await product.populate("category");

    await logAudit(req, {
      company: product.company,
      action: "update",
      resourceType: "Product",
      resourceId: product._id,
      before,
      after: product.toObject(),
    });

    res.json({ success: true, data: populated, message: "Product updated successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A product with this internal reference already exists" });
    }
    console.error("PUT product error:", error);
    res.status(500).json({ success: false, message: "Error updating product", error: error.message });
  }
});

// ======================================================
// ADJUST QUANTITY (the +/- buttons)
// POST /api/products/:id/adjust
// body: { type: "in" | "out", quantity, reason? }
// ======================================================

// ======================================================
// SUPPLIER PRICES & REFERENCES (the purchasing team's edit)
// PATCH /api/products/:id/supplier-info
// body: { prices?: [{ supplierName, supplierReference?, price }], internalReference? }
// ======================================================
// The ONLY change the purchasing team can make to an article: its
// supplier prices/references, and its internal reference when it
// doesn't have one yet. Name, category, stock, thresholds... stay
// production's (PUT /:id). Production can use this route too.

router.patch("/:id/supplier-info", requireInventoryViewAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid article ID" });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Article not found" });

    const { prices, internalReference } = req.body;

    if (prices !== undefined) {
      if (!Array.isArray(prices) || prices.length > 50) {
        return res.status(400).json({ success: false, message: "Invalid supplier prices" });
      }
      const clean = [];
      for (const p of prices) {
        const supplierName = String(p?.supplierName || "").trim();
        const price = Number(p?.price);
        if (!supplierName) return res.status(400).json({ success: false, message: "Every supplier price needs a supplier name" });
        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ success: false, message: `Invalid price for "${supplierName}"` });
        }
        clean.push({ supplierName, price, supplierReference: String(p.supplierReference || "").trim() || undefined });
      }
      product.prices = clean;
    }

    if (internalReference !== undefined && String(internalReference).trim()) {
      const ref = String(internalReference).trim().toUpperCase();
      const current = String(product.internalReference || "").trim();
      // Anyone may fill a MISSING reference; changing an existing one
      // stays production's (it may be printed on labels, used by
      // people searching the stock...).
      if (current && current !== ref && !canAccessProduction(req.user)) {
        return res.status(403).json({ success: false, message: "This article already has an internal reference — only production can change it" });
      }
      product.internalReference = ref;
    }

    product.updatedBy = req.user.id;
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Another article already uses this internal reference" });
    }
    console.error("PATCH product supplier-info error:", error);
    res.status(500).json({ success: false, message: "Error saving supplier prices", error: error.message });
  }
});

router.post("/:id/adjust", requireProductionAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const { type, quantity, reason } = req.body;

    if (!["in", "out"].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be "in" or "out"' });
    }
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ success: false, message: "A positive quantity is required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const updated = await applyMovement({
      product,
      type,
      quantity: Number(quantity),
      reason,
      actorId: req.user.id,
    });

    const populated = await updated.populate("category");

    res.json({ success: true, data: populated, message: "Quantity updated successfully" });
  } catch (error) {
    console.error("POST product adjust error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Error adjusting quantity",
    });
  }
});

// ======================================================
// UPLOAD PRODUCT PHOTO
// POST /api/products/:id/photo
// ======================================================

router.post("/:id/photo", requireProductionAccess, upload.single("photo"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please select an image" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const oldPublicId = product.image?.publicId;

    const result = await uploadImage(
      req.file.buffer,
      `frame/companies/${product.company}/products/${product._id}`
    );

    product.image = { url: result.secure_url, publicId: result.public_id };
    product.updatedBy = req.user.id;
    await product.save();

    if (oldPublicId) await deleteImage(oldPublicId);

    const populated = await product.populate("category");

    res.json({ success: true, data: populated, message: "Photo uploaded successfully" });
  } catch (error) {
    console.error("POST product photo error:", error);
    res.status(500).json({ success: false, message: "Error uploading photo", error: error.message });
  }
});

// ======================================================
// DELETE PRODUCT
// DELETE /api/products/:id
// ======================================================

router.delete("/:id", requireProductionAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (product.image?.publicId) {
      await deleteImage(product.image.publicId);
    }

    await InventoryMovement.deleteMany({ product: product._id });
    await Product.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: product.company,
      action: "delete",
      resourceType: "Product",
      resourceId: product._id,
      resourceLabel: product.name,
      before: product.toObject(),
    });

    res.json({ success: true, message: "Product deleted successfully", productId: product._id });
  } catch (error) {
    console.error("DELETE product error:", error);
    res.status(500).json({ success: false, message: "Error deleting product", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (name, notes) — fr/en/ar
// GET  /api/products/:id/translations
// PUT  /api/products/:id/translations/:field/:lang
// POST /api/products/:id/translations/:field/:lang/regenerate
// ======================================================
// requireProductionAccess above already gates the whole router, so
// no extra per-record authorization is needed here (matches every
// other :id route in this file).

attachTranslationRoutes(router, Product, {
  resourceType: "Product",
  populate: "category",
});

module.exports = router;
