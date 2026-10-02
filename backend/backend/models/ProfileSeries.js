// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * PROFILE SERIES (série / gamme de profilés) — e.g. "Coulissant 67",
 * "Ouvrant RPT 50", "Façade VEC 52". Each series has its own VARIABLES
 * (clearances, overlaps, deductions) that every chassis model of the
 * series uses in its formulas, so one change here updates all of them.
 */
const variableSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, trim: true, maxlength: 150 },
  value: { type: Number, required: true, default: 0 },
}, { _id: false });

const profileSeriesSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    supplier: { type: String, trim: true, maxlength: 100, default: "" },
    families: [{ type: String, trim: true }],
    description: { type: String, trim: true, maxlength: 1000 },
    variables: [variableSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
profileSeriesSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("ProfileSeries", profileSeriesSchema);
