const mongoose = require("mongoose");

/**
 * SUPPLIER (fournisseur) — per company. Moroccan identifiers (ICE, IF,
 * RC) are optional free text; only the name is required.
 */
const supplierSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: [true, "Supplier name is required"], trim: true, maxlength: 200 },
    contactName: { type: String, trim: true, maxlength: 150 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 50 },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 },
    ice: { type: String, trim: true, maxlength: 30 },
    identifiantFiscal: { type: String, trim: true, maxlength: 30 },
    rc: { type: String, trim: true, maxlength: 30 },
    // e.g. "30 jours fin de mois" — free text, shown on purchase orders
    paymentTerms: { type: String, trim: true, maxlength: 150 },
    // Payment delay in days, used to set an invoice's due date. Loi
    // 69-21: 60 days by default, up to 120 only by written agreement.
    paymentDays: { type: Number, default: 60, min: 0, max: 365 },
    notes: { type: String, trim: true, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
    // Supplier compliance documents, with expiry alerts (daily check —
    // services/purchasingScheduledChecks.js).
    documents: [{
      type: {
        type: String,
        enum: ["attestation_fiscale", "rc", "cnss", "rib", "patente", "other"],
        required: true,
      },
      label: { type: String, trim: true, maxlength: 150 },
      number: { type: String, trim: true, maxlength: 100 },
      issueDate: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
      file: { url: String, publicId: String, originalName: String },
      expiryNotifiedAt: { type: Date, default: null },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      uploadedAt: { type: Date, default: Date.now },
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

supplierSchema.index({ company: 1, name: 1 });

module.exports = mongoose.model("Supplier", supplierSchema);
