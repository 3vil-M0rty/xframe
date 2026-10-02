// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * FINISH (finition / couleur) — BRUT, RAL 9016 blanc, RAL 7016
 * anthracite, anodisé argent, effet bois…
 *
 * kind:
 *   raw        no treatment (the raw article itself is used)
 *   lacquer    powder-coated IN-HOUSE by the workshop `processWorkshop`
 *              (a Laquage workshop): raw bars + powder → lacquered bars
 *   anodized / wood / other  bought already finished (or sub-contracted):
 *              the finished variant must be in stock or purchased
 * `powderProduct`: the powder article of this colour (kg).
 * `surchargePercent`: added to the price of a chassis in this finish.
 */
const finishSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    name: { type: String, trim: true, maxlength: 80, default: "" },
    kind: { type: String, enum: ["raw", "lacquer", "anodized", "wood", "other"], default: "lacquer" },
    processWorkshop: { type: mongoose.Schema.Types.ObjectId, ref: "Workshop", default: null },
    powderProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    color: { type: String, trim: true, default: "#cccccc" },
    surchargePercent: { type: Number, default: 0, min: 0, max: 500 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
finishSchema.index({ company: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Finish", finishSchema);
