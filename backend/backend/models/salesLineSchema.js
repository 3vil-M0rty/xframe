const mongoose = require("mongoose");

/**
 * A priced line on a devis or an invoice. Amounts are HT; `vatRate`
 * in % (20, 14, 10, 7 or 0 in Morocco). `discount` is a % off the line.
 */
module.exports = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, trim: true, maxlength: 30 },
  unitPrice: { type: Number, required: true },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  vatRate: { type: Number, default: 20, min: 0, max: 100 },
  // Aluminium joinery: the line is a chassis of the catalogue, built to
  // size. Copied to the project's "ouvrages" when the devis becomes a
  // project; the BOM is recomputed from it there.
  chassis: {
    type: new mongoose.Schema({
      model: { type: mongoose.Schema.Types.ObjectId, ref: "ChassisModel", required: true },
      ref: { type: String, trim: true, maxlength: 30, default: "" }, // repère (F1, P2…)
      L: { type: Number, required: true, min: 1 },
      H: { type: Number, required: true, min: 1 },
      finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
      params: { type: mongoose.Schema.Types.Mixed, default: {} },
    }, { _id: false }),
    default: undefined,
  },
});
