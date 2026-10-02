// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * DELIVERY NOTE (bon de livraison, BL-YYYY-NNNN) — what leaves the
 * workshop for a project's site, and how.
 *
 * status: draft → planned → shipped (en route) → delivered (signed)
 *         any of them → cancelled ; delivered → cancelled = return
 * Chassis parts count as delivered (TrackingUnit.parts.deliveredQty)
 * when the note is marked delivered; before that they're reserved.
 */
const lineSchema = new mongoose.Schema({
  unit: { type: mongoose.Schema.Types.ObjectId, ref: "TrackingUnit", required: true },
  part: { type: mongoose.Schema.Types.ObjectId, required: true },
  ref: { type: String, trim: true }, // F1-2
  label: { type: String, trim: true }, // Coulissant 2 vantaux — série 67
  partLabel: { type: String, trim: true }, // Dormant / Vantaux / Vitrages…
  partKind: { type: String, trim: true },
  size: { type: String, trim: true }, // size of the delivered element (sash, glass…) or of the chassis
  chassisSize: { type: String, trim: true }, // overall chassis L × H
  finish: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0.0001 },
  notes: { type: String, trim: true, maxlength: 300 },
});

const extraLineSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 200 },
  quantity: { type: Number, default: 1, min: 0 },
  unit: { type: String, trim: true, maxlength: 20, default: "" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
});

const deliveryNoteSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, required: true, trim: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    status: { type: String, enum: ["draft", "planned", "shipped", "delivered", "cancelled"], default: "draft", index: true },
    date: { type: Date, default: Date.now }, // planned delivery date
    timeSlot: { type: String, trim: true, maxlength: 60, default: "" },
    address: { type: String, trim: true, maxlength: 400 },
    siteContact: { type: String, trim: true, maxlength: 120 },
    sitePhone: { type: String, trim: true, maxlength: 40 },
    transport: {
      mode: { type: String, enum: ["own", "carrier", "pickup"], default: "own" },
      carrier: { type: String, trim: true, maxlength: 120, default: "" }, // transporteur
      vehicle: { type: String, trim: true, maxlength: 60, default: "" }, // immatriculation / type
      driver: { type: String, trim: true, maxlength: 120, default: "" },
      driverPhone: { type: String, trim: true, maxlength: 40, default: "" },
      trackingRef: { type: String, trim: true, maxlength: 80, default: "" },
      cost: { type: Number, default: 0, min: 0 }, // HT — added to the project's costs when delivered
    },
    packages: { type: Number, default: null, min: 0 }, // colis / palettes / chevalets
    weightKg: { type: Number, default: null, min: 0 },
    lines: [lineSchema],
    extraLines: [extraLineSchema],
    notes: { type: String, trim: true, maxlength: 2000 }, // printed
    internalNotes: { type: String, trim: true, maxlength: 2000 }, // not printed
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    receivedBy: { type: String, trim: true, maxlength: 120, default: "" },
    reserves: { type: String, trim: true, maxlength: 2000, default: "" }, // réserves du client à la réception
    cancelReason: { type: String, trim: true, maxlength: 500, default: "" },
    lateNotifiedAt: { type: Date, default: null },
    expenseId: { type: mongoose.Schema.Types.ObjectId, default: null }, // project expense created for the transport cost
    history: [{ status: String, note: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, _id: false }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
deliveryNoteSchema.index({ company: 1, number: 1 }, { unique: true });
deliveryNoteSchema.index({ company: 1, date: 1 });

module.exports = mongoose.model("DeliveryNote", deliveryNoteSchema);
