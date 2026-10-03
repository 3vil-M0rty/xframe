// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * PROFILE SERIES (série / gamme de profilés) — e.g. "AWS 60",
 * "Coulissant 67". The series is the PROFILE LIBRARY of its system:
 *   - its profiles are inventory articles carrying the series and a
 *     short CODE (Product.profileSeries + seriesCode: DOR, OUV, PAR…);
 *     their geometry lives on the article only;
 *   - formulas read them as CODE.prop (DOR.ae, OUV.ch, DOR.hp…);
 *   - its VARIABLES (numbers or formulas over the profiles) are shared
 *     by every chassis model of the series.
 */
// A series variable is a number ("jeu = 5") or a FORMULA over the
// profiles of the series ("rec = OUV.ae - 2", "jd = DOR.ch + DOR.ai")
// and the variables above it — computed at every calculation, so a
// change on a profile article changes every débit of the series.
const variableSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, trim: true, maxlength: 150 },
  formula: { type: String, trim: true, maxlength: 500, default: "" },
  value: { type: Number, default: 0 }, // a plain number (when there is no formula)
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
