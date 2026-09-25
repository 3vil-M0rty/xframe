const mongoose = require("mongoose");
const { computeTotals, derivePaymentStatus } = require("../services/purchaseOrderCalc");

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
  { url: String, publicId: String, originalName: String },
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
  number: { type: String, required: true, trim: true, maxlength: 100 },
  date: { type: Date, required: true },
  dueDate: { type: Date, default: null },
  amountTTC: { type: Number, required: true, min: 0 },
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
      enum: ["draft", "sent", "partially_received", "received", "cancelled"],
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
    paymentStatus: { type: String, enum: ["unpaid", "partially_paid", "paid"], default: "unpaid", index: true },

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

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
PurchaseOrder.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports = PurchaseOrder;
