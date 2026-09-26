// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const { computeTotals, derivePaymentStatus, matchOrder, allocateInvoices } = require("../services/purchaseOrderCalc");

/**
 * ============================================================
 * PURCHASE ORDER (bon de commande)
 * ============================================================
 * status:
 *   draft               being prepared
 *   sent                ordered from the supplier
 *   partially_received  some goods in (derived — see purchaseOrderCalc)
 *   received            everything in (derived)
 *   cancelled
 * Every reception (BL) and return is kept on the order with its
 * reference, lines and optional scan; each one also moves stock
 * through services/inventoryService.js for lines linked to an
 * inventory product. Totals and payment status are recomputed on
 * every save — never trusted from the client.
 * ============================================================
 */

const fileSchema = new mongoose.Schema(
  { url: String, publicId: String, originalName: String, private: Boolean, resourceType: String, format: String },
  { _id: false }
);

const lineSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  quantity: { type: Number, required: true, min: 0.001 },
  unit: { type: String, trim: true, maxlength: 30 },
  unitPrice: { type: Number, required: true, min: 0 },
  vatRate: { type: Number, default: 20, min: 0, max: 100 },
  receivedQuantity: { type: Number, default: 0, min: 0 },
  returnedQuantity: { type: Number, default: 0, min: 0 },
  // "Soldée": the buyer accepted what was received as final (e.g. 69
  // of 70) — nothing more is expected on this line.
  closed: { type: Boolean, default: false },
  closedAt: { type: Date, default: null },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  closeReason: { type: String, trim: true, maxlength: 300 },
});

const receptionSchema = new mongoose.Schema({
  type: { type: String, enum: ["reception", "return"], required: true },
  // BL number for a reception; return slip / credit note ref for a return
  reference: { type: String, required: true, trim: true, maxlength: 100 },
  date: { type: Date, required: true, default: Date.now },
  lines: [{ lineId: { type: mongoose.Schema.Types.ObjectId, required: true }, quantity: { type: Number, required: true, min: 0.001 } }],
  notes: { type: String, trim: true, maxlength: 1000 },
  file: fileSchema,
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const invoiceSchema = new mongoose.Schema({
  // "credit_note" = avoir: reduces what's owed (e.g. after a return)
  type: { type: String, enum: ["invoice", "credit_note"], default: "invoice" },
  number: { type: String, required: true, trim: true, maxlength: 100 },
  date: { type: Date, required: true },
  dueDate: { type: Date, default: null },
  amountTTC: { type: Number, required: true, min: 0 },
  // Exact VAT as printed on the supplier's invoice, one row per rate.
  // Empty on invoices recorded before this existed: reports then fall
  // back to splitting TTC with the order's own VAT ratio.
  vatBreakdown: [{
    _id: false,
    rate: { type: Number, required: true, min: 0, max: 100 },
    baseHT: { type: Number, required: true },
    vat: { type: Number, required: true },
  }],
  notes: { type: String, trim: true, maxlength: 1000 },
  file: fileSchema,
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const PAYMENT_METHODS = ["virement", "cheque", "especes", "effet", "carte", "autre"];

const paymentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: PAYMENT_METHODS, required: true },
  reference: { type: String, trim: true, maxlength: 100 }, // cheque / transfer number
  notes: { type: String, trim: true, maxlength: 500 },
  // The invoice this payment settles (optional — without it, payments
  // are applied to the order's invoices oldest first).
  invoiceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  // Shared by the parts of ONE supplier payment spread over several
  // invoices / orders (e.g. one bank transfer settling 3 invoices).
  batchRef: { type: String, trim: true, maxlength: 60, default: null },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, required: true, trim: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    expectedDate: { type: Date, default: null },
    status: {
      type: String,
      // pending_approval: over the company's approval threshold, waiting
      // for an approver (admin, owner, or the purchasing department's
      // manager) — approve -> sent, reject -> back to draft.
      enum: ["draft", "pending_approval", "sent", "partially_received", "received", "cancelled"],
      default: "draft",
      index: true,
    },
    lines: { type: [lineSchema], validate: [(v) => v.length > 0, "A purchase order needs at least one line"] },
    totalHT: { type: Number, default: 0 },
    totalVAT: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },

    receptions: [receptionSchema],
    invoices: [invoiceSchema],
    payments: [paymentSchema],
    amountPaid: { type: Number, default: 0 },
    // what's left to pay: vs the supplier's invoices once there are
    // any, otherwise vs the order total (see purchaseOrderCalc)
    amountDue: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "partially_paid", "paid"], default: "unpaid", index: true },

    approval: {
      requestedAt: { type: Date, default: null },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      approvedAt: { type: Date, default: null },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      approvedAmount: { type: Number, default: null },
      rejectedAt: { type: Date, default: null },
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      rejectReason: { type: String, trim: true, maxlength: 500 },
    },
    // Emails sent to the supplier (the BC PDF attached). `simulated`:
    // no SMTP configured yet — recorded in the outbox, not delivered.
    emails: [{
      to: String,
      cc: String,
      subject: String,
      at: { type: Date, default: Date.now },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      simulated: Boolean,
    }],
    // set once the "late delivery" alert went out, so it's sent once
    lateNotifiedAt: { type: Date, default: null },
    // set once the "goods received but no supplier invoice" alert went out
    missingInvoiceNotifiedAt: { type: Date, default: null },
    purchaseRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest" }],
    priceRequest: { type: mongoose.Schema.Types.ObjectId, ref: "PriceRequest", default: null },
    notes: { type: String, trim: true, maxlength: 2000 },
    cancelReason: { type: String, trim: true, maxlength: 500 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ company: 1, number: 1 }, { unique: true });
purchaseOrderSchema.index({ company: 1, date: -1 });
purchaseOrderSchema.index({ "lines.product": 1 }); // "every order containing this article"

purchaseOrderSchema.pre("validate", function recompute(next) {
  Object.assign(this, computeTotals(this.lines));
  Object.assign(this, derivePaymentStatus(this));
  next();
});

// Three-way matching + per-invoice payment state, computed on the fly
// and sent with every order, so all screens show the same figures.
purchaseOrderSchema.virtual("analysis").get(function analysis() {
  // Only on fully loaded orders — the list/recap loads a few fields,
  // and figures computed from partial data would be wrong.
  if (!this.lines || !this.isSelected("lines.unitPrice") || !this.isSelected("invoices")) return undefined;
  return { match: matchOrder(this), invoices: allocateInvoices(this).map((r) => ({ ...r, invoice: r.invoice._id })) };
});
purchaseOrderSchema.set("toJSON", { virtuals: true });

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
PurchaseOrder.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports = PurchaseOrder;
