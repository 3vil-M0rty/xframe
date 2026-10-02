// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * GLASS TYPE (composition de vitrage) — "44.2 / 10 / 6", "4/16/4",
 * "Feuilleté 55.2"… defined by the company, chosen on a chassis line
 * wherever a glass unit (vitrage) is asked (a "model" parameter of the
 * vitrage family).
 *
 *   layers   the glass sheets of one pane, outside → inside. Each layer
 *            says how many identical sheets it has (44.2 = 2 × 4 mm) and
 *            from which PLATEAUX (stock articles in sheets, e.g. "Float
 *            4 mm 3000×1000" or "Float 4 mm 2400×1000") it may be cut:
 *            the optimiser picks the plateau automatically from the
 *            stock (services/cuttingOptimizer.js → allocateSheets).
 *   extras   what else one pane consumes: PVB film (per m²), spacer /
 *            butyl (per metre of perimeter), corners (per pane)…
 *   labour   minutes per pane + per m² in the glazing workshop.
 */
const layerSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 120, default: "" },
  thickness: { type: Number, default: null, min: 0 }, // mm (informative)
  count: { type: Number, default: 1, min: 1, max: 6 },
  sheets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
}, { _id: false });

const extraSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  label: { type: String, trim: true, maxlength: 120, default: "" },
  measure: { type: String, enum: ["area", "perimeter", "count"], default: "area" },
  qty: { type: Number, default: 1, min: 0 }, // per m², per metre of perimeter, or per pane
  inset: { type: Number, default: 0, min: 0 }, // perimeter measured this far inside the edge (spacer), mm
}, { _id: false });

const glassTypeSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    code: { type: String, trim: true, uppercase: true, maxlength: 30, default: "" },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    layers: { type: [layerSchema], default: [] },
    extras: { type: [extraSchema], default: [] },
    workshop: { type: String, trim: true, uppercase: true, default: "VIT" },
    labourPerPane: { type: Number, default: 0, min: 0 }, // minutes
    labourPerM2: { type: Number, default: 0, min: 0 }, // minutes
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
glassTypeSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("GlassType", glassTypeSchema);
