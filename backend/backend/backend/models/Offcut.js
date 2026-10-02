// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * OFFCUT (chute réutilisable) — pieces of profile kept after cutting
 * (e.g. 1 309 mm of "Dormant 67 — RAL 9016"). Not counted in the article's
 * bar stock: the person issuing bars for a project picks the offcuts he
 * uses (raw or already lacquered; lacquered ones can be re-lacquered).
 */
const offcutSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true }, // raw article or colour variant
    length: { type: Number, required: true, min: 1 }, // mm
    quantity: { type: Number, required: true, min: 0, default: 1 },
    location: { type: String, trim: true, maxlength: 80, default: "" },
    note: { type: String, trim: true, maxlength: 200, default: "" },
    sourceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionOrder", default: null },
    sourceProject: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
offcutSchema.index({ company: 1, product: 1, length: -1 });

module.exports = mongoose.model("Offcut", offcutSchema);
