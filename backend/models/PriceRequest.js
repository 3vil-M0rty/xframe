const mongoose = require("mongoose");

/**
 * ============================================================
 * PRICE REQUEST (demande de prix)
 * ============================================================
 * Asks one supplier for a quote. When the supplier answers, the
 * buyer records the quoted unit prices (and can attach the quote),
 * then either converts it into a purchase order with those prices or
 * rejects it. One request per supplier — to compare suppliers, send
 * the same lines to several and compare the answers.
 *   draft -> sent -> answered -> accepted (converted) | rejected
 * ============================================================
 */

const priceRequestSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, required: true, trim: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    responseDeadline: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "sent", "answered", "accepted", "rejected"],
      default: "draft",
      index: true,
    },
    lines: {
      type: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
        description: { type: String, required: true, trim: true, maxlength: 300 },
        quantity: { type: Number, required: true, min: 0.001 },
        unit: { type: String, trim: true, maxlength: 30 },
        quotedUnitPrice: { type: Number, default: null, min: 0 },
        vatRate: { type: Number, default: 20, min: 0, max: 100 },
      }],
      validate: [(v) => v.length > 0, "A price request needs at least one line"],
    },
    quoteFile: { url: String, publicId: String, originalName: String },
    notes: { type: String, trim: true, maxlength: 2000 },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", default: null },
    purchaseRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest" }],
    // Same request sent to several suppliers at once shares a group, so
    // their answers can be compared side by side (GET /compare/:group).
    comparisonGroup: { type: String, default: null, index: true },
    emails: [{
      to: String,
      cc: String,
      subject: String,
      at: { type: Date, default: Date.now },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      simulated: Boolean,
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

priceRequestSchema.index({ company: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("PriceRequest", priceRequestSchema);
