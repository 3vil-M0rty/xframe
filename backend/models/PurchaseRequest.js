const mongoose = require("mongoose");

/**
 * ============================================================
 * PURCHASE REQUEST (demande d'achat)
 * ============================================================
 * Deliberately minimal — a placeholder that lets an admin flag
 * "we need to reorder this" against a product, ahead of the full
 * purchasing/"Achat" module planned for later. When that module
 * exists, it can read/promote these requests rather than this
 * needing to be rebuilt from scratch.
 * ============================================================
 */

const purchaseRequestSchema = new mongoose.Schema(
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

    requestedQuantity: {
      type: Number,
      required: [true, "Requested quantity is required"],
      min: 0.01,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "received"],
      default: "pending",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

purchaseRequestSchema.index({ company: 1, status: 1 });
purchaseRequestSchema.index({ company: 1, product: 1 });

module.exports = mongoose.model("PurchaseRequest", purchaseRequestSchema);
