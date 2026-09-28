// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * CUSTOMER (client) — per company. Moroccan B2B invoices must show the
 * customer's ICE, so it's asked for (not required: individuals have none).
 */
const contactSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 150 },
  role: { type: String, trim: true, maxlength: 100 },
  phone: { type: String, trim: true, maxlength: 50 },
  email: { type: String, trim: true, lowercase: true, maxlength: 200 },
});

const customerSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: [true, "Customer name is required"], trim: true, maxlength: 200 },
    kind: { type: String, enum: ["company", "individual"], default: "company" },
    ice: { type: String, trim: true, maxlength: 30 },
    identifiantFiscal: { type: String, trim: true, maxlength: 30 },
    rc: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 50 },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 },
    contacts: [contactSchema],
    // Days to pay an invoice (due date = invoice date + paymentDays).
    // Loi 69-21: 60 days by default between companies.
    paymentDays: { type: Number, default: 60, min: 0, max: 365 },
    notes: { type: String, trim: true, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

customerSchema.index({ company: 1, name: 1 });

module.exports = mongoose.model("Customer", customerSchema);
