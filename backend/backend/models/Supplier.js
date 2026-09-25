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
    notes: { type: String, trim: true, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

supplierSchema.index({ company: 1, name: 1 });

module.exports = mongoose.model("Supplier", supplierSchema);
