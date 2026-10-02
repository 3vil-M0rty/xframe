// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const lineSchema = require("./salesLineSchema");

/**
 * QUOTE (devis) — numbered DV-YYYY-NNNN per company.
 * draft → sent → accepted | refused | expired;  cancelled at any time.
 * An accepted devis can become a project (Project.quote) and be
 * invoiced (deposit invoices, then the final invoice).
 * Totals are recomputed on every save (services/salesCalc.js).
 */
const quoteSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, required: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    subject: { type: String, trim: true, maxlength: 300 },
    date: { type: Date, required: true, default: Date.now },
    validUntil: { type: Date, default: null },
    lines: { type: [lineSchema], validate: [(v) => v.length > 0, "A devis needs at least one line"] },
    totalHT: { type: Number, default: 0 },
    totalVAT: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    paymentTerms: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "refused", "expired", "cancelled"],
      default: "draft",
      index: true,
    },
    sentAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    refusalReason: { type: String, trim: true, maxlength: 500 },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    expiryNotifiedAt: { type: Date, default: null }, // "expires in 3 days" sent (reset when validUntil changes)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

quoteSchema.index({ company: 1, number: 1 }, { unique: true });

quoteSchema.pre("validate", function computeTotals() {
  const { computeLineTotals } = require("../services/salesCalc");
  Object.assign(this, computeLineTotals(this.lines));
});

module.exports = mongoose.model("Quote", quoteSchema);
