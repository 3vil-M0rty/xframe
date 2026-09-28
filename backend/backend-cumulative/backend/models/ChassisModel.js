// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * CHASSIS MODEL (modèle / typologie) — a buildable product of the
 * company: "Coulissant 2 vantaux — série 67", "Double vitrage 4/16/4",
 * "Porte 1 vantail — série 50"… Usually imported from
 * config/chassisCatalog.js then fully edited by the client.
 *
 * Everything the BOM needs lives here (see services/chassisBom.js):
 *   parameters  inputs chosen on the devis / project line
 *   derived     intermediate formulas (vantail width…)
 *   components  what one chassis consumes, each with formulas
 *   labour      minutes per workshop (for costing)
 *   pricing     how a devis line price is proposed
 */
const optionSchema = new mongoose.Schema({ value: { type: Number, required: true }, label: { type: String, trim: true } }, { _id: false });

const parameterSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, trim: true, maxlength: 120 },
  type: { type: String, enum: ["number", "boolean", "choice", "product", "model"], default: "number" },
  default: { type: mongoose.Schema.Types.Mixed, default: null }, // number, or an ObjectId string for product/model
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  unit: { type: String, trim: true, default: "" },
  fixed: { type: Boolean, default: false }, // not editable on the line
  options: [optionSchema],
  family: { type: String, trim: true, default: "" }, // model params: restrict to a family
  materialType: { type: String, trim: true, default: "" }, // product params: restrict to a material type
}, { _id: false });

const derivedSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, trim: true, maxlength: 120 },
  formula: { type: String, required: true, trim: true, maxlength: 1000 },
}, { _id: false });

const componentSchema = new mongoose.Schema({
  role: { type: String, required: true, trim: true, maxlength: 60 },
  label: { type: String, required: true, trim: true, maxlength: 150 },
  kind: { type: String, enum: ["profile", "gasket", "glass", "panel", "accessory", "consumable", "model"], required: true },
  measure: { type: String, enum: ["length", "area", "count", null], default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  subModel: { type: mongoose.Schema.Types.ObjectId, ref: "ChassisModel", default: null },
  productParam: { type: String, trim: true, default: "" },
  modelParam: { type: String, trim: true, default: "" },
  qty: { type: String, trim: true, default: "1", maxlength: 1000 },
  length: { type: String, trim: true, default: "", maxlength: 1000 },
  width: { type: String, trim: true, default: "", maxlength: 1000 },
  height: { type: String, trim: true, default: "", maxlength: 1000 },
  angle: { type: String, trim: true, default: "" },
  finish: { type: String, enum: ["project", "raw", "none"], default: "none" },
  workshop: { type: String, trim: true, uppercase: true, default: "" }, // workshop code; empty = model default
  condition: { type: String, trim: true, default: "", maxlength: 1000 },
  waste: { type: Number, default: 0, min: 0, max: 100 },
  notes: { type: String, trim: true, maxlength: 300 },
});

const chassisModelSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    series: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileSeries", default: null, index: true },
    code: { type: String, trim: true, uppercase: true, maxlength: 30, default: "" },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    family: { type: String, required: true, trim: true, default: "autre" },
    templateKey: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, maxlength: 1000 },
    drawing: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Optional picture (photo / catalogue drawing) uploaded by the company —
    // replaces the generated schematic on screen and in the devis PDF.
    image: { url: { type: String, default: null }, publicId: { type: String, default: null } },
    defaultWorkshop: { type: String, trim: true, uppercase: true, default: "ALU" },
    limits: {
      minL: { type: Number, default: null }, maxL: { type: Number, default: null },
      minH: { type: Number, default: null }, maxH: { type: Number, default: null },
    },
    // Variables of the model itself (on top of — and overriding — the series ones).
    variables: [{ key: { type: String, required: true }, label: String, value: { type: Number, default: 0 }, _id: false }],
    parameters: [parameterSchema],
    derived: [derivedSchema],
    components: [componentSchema],
    // How one chassis is split for tracking / delivery: frame, sashes,
    // glass, modules… (quantity & condition are formulas). Empty = one
    // part "Châssis complet".
    deliveryParts: [{
      key: { type: String, trim: true, required: true },
      label: { type: String, trim: true, required: true, maxlength: 150 },
      kind: { type: String, enum: ["complete", "frame", "sash", "glass", "module", "screen", "panel", "accessory", "other"], default: "other" },
      qty: { type: String, trim: true, default: "1", maxlength: 500 },
      condition: { type: String, trim: true, default: "", maxlength: 500 },
      // One tracked element per piece: "Vantail 1", "Vantail 2"… instead of "Vantaux ×2".
      perPiece: { type: Boolean, default: false },
      // Size of the element (mm), printed on delivery notes; empty = the chassis L × H.
      width: { type: String, trim: true, default: "", maxlength: 500 },
      height: { type: String, trim: true, default: "", maxlength: 500 },
      pieceLabel: { type: String, trim: true, default: "", maxlength: 100 },
      _id: false,
    }],
    labour: [{ workshop: { type: String, trim: true, uppercase: true }, minutes: { type: String, trim: true, default: "0" }, _id: false }],
    pricing: {
      mode: { type: String, enum: ["cost_plus", "per_m2", "per_ml", "per_unit"], default: "cost_plus" },
      coefficient: { type: Number, default: 1.8, min: 0 },
      pricePerM2: { type: Number, default: 0, min: 0 },
      pricePerMl: { type: Number, default: 0, min: 0 },
      pricePerUnit: { type: Number, default: 0, min: 0 },
      minArea: { type: Number, default: 0, min: 0 },
      minPrice: { type: Number, default: 0, min: 0 },
    },
    unit: { type: String, trim: true, default: "u" },
    vatRate: { type: Number, default: 20 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
chassisModelSchema.index({ company: 1, family: 1, name: 1 });

module.exports = mongoose.model("ChassisModel", chassisModelSchema);
