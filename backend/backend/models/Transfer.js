// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * TRANSFER (bon de sortie / de transfert, BT-YYYY-NNNN) — material handed
 * to a workshop for a work order, then received there:
 *   from = null (stock / magasin) → issue of bars, offcuts, accessories…
 *         (the stock goes out when it is SENT)
 *   from = a workshop order       → lacquered bars Laquage → Aluminium,
 *                                    glass units Vitrage → Aluminium
 * category: bars | accessories | lacquered | glass | other
 */
const offcutLineSchema = new mongoose.Schema({
  offcut: { type: mongoose.Schema.Types.ObjectId, ref: "Offcut", default: null }, // null = piece not in the offcut stock
  length: { type: Number, required: true, min: 1 },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const lineSchema = new mongoose.Schema({
  need: { type: mongoose.Schema.Types.ObjectId, default: null }, // need of the receiving order
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  label: { type: String, trim: true, maxlength: 300, default: "" },
  unit: { type: String, trim: true, default: "" },
  quantity: { type: Number, default: 0, min: 0 }, // whole bars / units sent
  offcuts: { type: [offcutLineSchema], default: [] },
  L: { type: Number, default: null }, // glass units
  H: { type: Number, default: null },
  ref: { type: String, trim: true, default: "" },
  receivedQty: { type: Number, default: null },
});

const transferSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, required: true, trim: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    category: { type: String, enum: ["bars", "accessories", "lacquered", "glass", "other"], default: "other" },
    fromOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionOrder", default: null },
    fromWorkshop: { type: mongoose.Schema.Types.ObjectId, ref: "Workshop", default: null }, // null = stock
    toOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionOrder", required: true, index: true },
    toWorkshop: { type: mongoose.Schema.Types.ObjectId, ref: "Workshop", required: true, index: true },
    lines: { type: [lineSchema], default: [] },
    status: { type: String, enum: ["sent", "received"], default: "sent", index: true },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    receptionNote: { type: String, trim: true, maxlength: 500, default: "" },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
transferSchema.index({ company: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Transfer", transferSchema);
