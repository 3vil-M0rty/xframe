const mongoose = require("mongoose");

/**
 * ============================================================
 * INVENTORY MOVEMENT
 * ============================================================
 * Every quantity change (the +/- buttons, an edit that changes
 * quantity, or the initial stock at creation) writes one of these
 * instead of just mutating Product.quantity in place. This is
 * what makes "show me the inventory as of March 3rd" answerable:
 * for any product, its quantity on a given date is the
 * `resultingQuantity` of its most recent movement AT OR BEFORE
 * that date (see routes/products.js: getQuantityAsOfDate).
 * Product.quantity is kept in sync as a fast-path for "current
 * stock" so the common case doesn't need to replay history.
 * ============================================================
 */

const inventoryMovementSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["in", "out", "adjustment"],
      required: true,
    },

    // Always positive — direction is carried by `type`, not sign.
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    // The product's total quantity immediately AFTER this
    // movement — this denormalization is exactly what makes the
    // "as of date" lookup a single indexed query instead of
    // replaying every movement from the beginning.
    resultingQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Powers "most recent movement at or before date D" per product.
inventoryMovementSchema.index({ product: 1, createdAt: -1 });
inventoryMovementSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryMovement", inventoryMovementSchema);
