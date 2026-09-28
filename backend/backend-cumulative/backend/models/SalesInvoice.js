// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const lineSchema = require("./salesLineSchema");

/**
 * SALES INVOICE (facture client).
 *   type: "invoice" | "deposit" (facture d'acompte) | "credit_note" (avoir)
 *   status: draft → issued → partially_paid → paid;  cancelled (drafts only)
 *
 * The NUMBER is given only when the invoice is ISSUED (FA-/AC-/AV-
 * YYYY-NNNN), so invoice numbers follow each other without gaps —
 * a legal requirement. An issued invoice is never edited or deleted:
 * it's corrected with a credit note.
 *
 * A final invoice of a devis lists the devis lines and deducts the
 * deposit invoices already issued (`depositsDeducted`, HT).
 */
const paymentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ["virement", "cheque", "especes", "effet", "carte", "autre"], default: "virement" },
  reference: { type: String, trim: true, maxlength: 100 },
  notes: { type: String, trim: true, maxlength: 500 },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const salesInvoiceSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, trim: true, default: null },
    type: { type: String, enum: ["invoice", "deposit", "credit_note"], default: "invoice" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    // credit note → the invoice it corrects
    creditedInvoice: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", default: null },
    date: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, default: null },
    subject: { type: String, trim: true, maxlength: 300 },
    lines: { type: [lineSchema], validate: [(v) => v.length > 0, "An invoice needs at least one line"] },
    // Deposits already invoiced, deducted from a final invoice, per VAT
    // rate (so the final invoice's VAT per rate stays exact).
    depositBreakdown: [{ _id: false, rate: Number, baseHT: Number, vat: Number }],
    depositInvoices: [{ type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice" }],
    depositsDeductedHT: { type: Number, default: 0 },
    depositsDeductedVAT: { type: Number, default: 0 },
    totalHT: { type: Number, default: 0 },
    totalVAT: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    vatBreakdown: [{ _id: false, rate: Number, baseHT: Number, vat: Number }],
    paymentTerms: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["draft", "issued", "partially_paid", "paid", "cancelled"],
      default: "draft",
      index: true,
    },
    issuedAt: { type: Date, default: null },
    payments: [paymentSchema],
    amountPaid: { type: Number, default: 0 },
    overdueNotifiedAt: { type: Date, default: null }, // "overdue" alert sent once
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Unique only once numbered (drafts have none).
salesInvoiceSchema.index(
  { company: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: "string" } } }
);
salesInvoiceSchema.index({ company: 1, status: 1, dueDate: 1 });

salesInvoiceSchema.pre("validate", function computeTotals() {
  const { computeInvoiceTotals, paymentStatus } = require("../services/salesCalc");
  Object.assign(this, computeInvoiceTotals(this));
  this.amountPaid = Math.round((this.payments || []).reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;
  if (["issued", "partially_paid", "paid"].includes(this.status)) this.status = paymentStatus(this);
});

module.exports = mongoose.model("SalesInvoice", salesInvoiceSchema);
