const mongoose = require("mongoose");

/**
 * ============================================================
 * PRODUCT (inventory item)
 * ============================================================
 * One document per stock item — raw material, finished product,
 * or whatever category the company has defined (see
 * InventoryCategory). `quantity` here is always the CURRENT
 * quantity; the full history that lets the Inventory page show
 * "what was in stock on date X" lives in InventoryMovement, not
 * here — see that model for why.
 *
 * `supplierReference` is deliberately a plain string, not a ref —
 * there's no Supplier model yet ("will be added later" per the
 * spec this was built from). `prices` holds one entry per
 * supplier NAME (same reasoning) until that model exists; migrating
 * to a real Supplier ref later just means adding a `supplier` ObjectId
 * alongside `supplierName` here, not restructuring the array.
 * ============================================================
 */

const supplierPriceSchema = new mongoose.Schema(
  {
    supplierName: { type: String, trim: true, required: true },
    price: { type: Number, required: true, min: 0 },
    // Optional external reference for this product AT that
    // supplier (their own catalog/SKU number) — not required,
    // per the spec ("fournisseurs référence (not necessary)").
    supplierReference: { type: String, trim: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryCategory",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    // Required — this is the company's own internal stock code.
    internalReference: {
      type: String,
      required: [true, "Internal reference is required"],
      trim: true,
      uppercase: true,
    },

    image: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    unit: {
      type: String,
      trim: true,
      default: "unit", // e.g. kg, L, pièce — free text, not enumerated
    },

    // Low-stock threshold — the Inventory page flags any product
    // at or below this.
    threshold: {
      type: Number,
      min: 0,
      default: 0,
    },

    prices: [supplierPriceSchema],

    // Optional — "prix de vente (not necessary)".
    sellingPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    currency: {
      type: String,
      trim: true,
      default: "MAD",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One internal reference per company.
productSchema.index({ company: 1, internalReference: 1 }, { unique: true });
productSchema.index({ company: 1, category: 1 });
productSchema.index({ company: 1, name: 1 });

module.exports = mongoose.model("Product", productSchema);
