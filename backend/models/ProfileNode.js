// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const { ruleSchema } = require("./fabricationRuleSchemas");

/**
 * NODE (nœud / coupe de liaison) — how two profiles of a series meet, set
 * once in the section editor by placing their DXF against each other
 * (LogiKal's profile combinations). The measured values become the
 * deductions of every CAD chassis using this combination:
 *
 *   type          slots                           values
 *   frame         main = dormant                  cover (dormant au-delà de la cote),
 *                                                 clear (cote → jour)
 *   frameSash     main = dormant/meneau, second = ouvrant   overlap (recouvrement)
 *   sashGlazing   main = ouvrant, bead, glass     glassEdge (bord ouvrant → verre),
 *                                                 beadStart (bord ouvrant → parclose)
 *   fixedGlazing  main = dormant/meneau, bead, glass   bite (prise du verre sous le jour),
 *                                                 beadExtra (parclose au-delà du jour)
 *   mullion       main = meneau (+ dormant)       half (axe → jour), end (allongement)
 *   meeting       main = ouvrant, second = battement   meeting (recouvrement entre vantaux)
 *
 * placements: positions (mm) of each element in the section, main at its
 * bbox origin — kept to reopen the editor; values are what the CAD uses.
 */
const profileNodeSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    series: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileSeries", required: true, index: true },
    type: { type: String, enum: ["frame", "frameSash", "sashGlazing", "fixedGlazing", "mullion", "meeting"], required: true },
    name: { type: String, trim: true, maxlength: 120, default: "" },
    main: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    second: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    bead: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    glassThickness: { type: Number, default: null },
    placements: { type: mongoose.Schema.Types.Mixed, default: {} },
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
    // accessories that go with this combination (joint central, cales…)
    rules: { type: [ruleSchema], default: [] },
    // a profile DXF changed after the node was measured: to check
    stale: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileNode", profileNodeSchema);
