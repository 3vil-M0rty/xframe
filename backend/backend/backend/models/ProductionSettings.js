// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * Production settings — one document per company (created on first read).
 *
 * powderMethod — how the powder need of a laquage order is computed:
 *   per_unit  each article's `powderPerUnit` (kg per bar / sheet)
 *   surface   painted surface (article `paintSurface`, or perimeter ×
 *             bar length) × coverage (powder article `coverage`, else
 *             `defaultCoverage` kg/m²)
 *   manual    no estimate — the laquage manager enters the kg used
 */
const productionSettingsSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    powderMethod: { type: String, enum: ["per_unit", "surface", "manual"], default: "surface" },
    defaultCoverage: { type: Number, default: 0.12, min: 0 }, // kg/m²
    powderWastePercent: { type: Number, default: 10, min: 0, max: 100 },
    // Bar cutting
    defaultBarLength: { type: Number, default: 6500, min: 100 }, // mm
    kerf: { type: Number, default: 4, min: 0, max: 20 }, // épaisseur de la lame (mm)
    trimAllowance: { type: Number, default: 10, min: 0, max: 500 }, // début de barre: squaring cut at the start (mm)
    barEndTrim: { type: Number, default: 0, min: 0, max: 500 }, // fin de barre: unusable end (clamp / damage) (mm)
    cutSpacing: { type: Number, default: 0, min: 0, max: 200 }, // extra space between two cuts, on top of the blade (mm)
    mitreNesting: { type: Boolean, default: true }, // tête-bêche: neighbouring mitres share one cut (needs the article's profileDepth)
    minReusableOffcut: { type: Number, default: 600, min: 0 }, // offcuts ≥ this are kept (mm)
    // Glass & sheets
    glassWastePercent: { type: Number, default: 8, min: 0, max: 100 }, // only when no plateau optimisation is possible (m² articles)
    glassEdgeTrim: { type: Number, default: 10, min: 0, max: 200 }, // unusable border of a plateau, per side (mm)
    glassCutGap: { type: Number, default: 2, min: 0, max: 50 }, // cutting line between two panes (mm)
    glassAllowRotation: { type: Boolean, default: true }, // panes may be turned 90° on the plateau
    // Planning
    lacquerFromStockFirst: { type: Boolean, default: true }, // use lacquered bars already in stock before lacquering
    consumeOnComplete: { type: Boolean, default: true }, // completing an order books the remaining theoretical quantities
    defaultCoefficient: { type: Number, default: 1.8, min: 0 },
    // Logistics: only parts marked "ready" (checked / packed) can go on a
    // delivery note; off → anything made can be delivered.
    deliverRequiresReady: { type: Boolean, default: true },
    // Devis pricing: profiles are costed by the metre + this % for offcuts.
    pricingProfileWaste: { type: Number, default: 10, min: 0, max: 100 },
  },
  { timestamps: true }
);
productionSettingsSchema.index({ company: 1 }, { unique: true });

module.exports = mongoose.model("ProductionSettings", productionSettingsSchema);
