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
    kerf: { type: Number, default: 4, min: 0, max: 20 }, // saw blade (mm)
    trimAllowance: { type: Number, default: 10, min: 0, max: 200 }, // bar end squaring (mm)
    minReusableOffcut: { type: Number, default: 600, min: 0 }, // offcuts ≥ this are kept (mm)
    // Glass & sheets
    glassWastePercent: { type: Number, default: 8, min: 0, max: 100 },
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
