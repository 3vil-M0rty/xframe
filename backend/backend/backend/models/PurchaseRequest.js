// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

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

    // Workflow (production asks, purchasing answers):
    //   pending   waiting for the purchasing team
    //   delayed   acknowledged but not handled yet — `purchasingNote`
    //             says why (supplier out of stock, awaiting quote...)
    //   ordered   a purchase order was placed (see purchaseOrder)
    //   declined  refused — `declineReason` is required
    //   received  the order it's on has been fully received
    // "approved"/"rejected" are kept only so requests created before
    // this workflow still load; they read as ordered/declined.
    status: {
      type: String,
      enum: ["pending", "delayed", "ordered", "declined", "received", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    // Explanation from purchasing, visible to production (why it's
    // late, what's happening). Updated with each note/status change.
    purchasingNote: { type: String, trim: true, maxlength: 1000 },
    declineReason: { type: String, trim: true, maxlength: 1000 },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", default: null },
    // Full timeline, shown on the request: who did what, when, and why.
    history: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

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

// Multilingual content layer (see plugins/translatable.js) for the
// free-text field(s) below — every language in config/i18nContent.js's
// CONTENT_LANGUAGES gets its own auto-translated + manually-editable slot.
purchaseRequestSchema.plugin(translatable, { fields: ["notes", "purchasingNote", "declineReason"] });

module.exports = mongoose.model("PurchaseRequest", purchaseRequestSchema);
