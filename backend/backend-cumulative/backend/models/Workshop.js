// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * WORKSHOP (atelier) — a production unit with its own manager
 * (responsable) and team: Laquage, Aluminium, Vitrage by default, and
 * any other the company adds (Pose, Menuiserie bois, Tôlerie…).
 *
 * `code` is what the chassis catalogue points at (component.workshop =
 * "ALU"), so renaming a workshop never breaks a formula.
 * `feeds` = the workshops this one delivers to: Laquage → Aluminium,
 * Vitrage → Aluminium. A work order of a fed workshop waits for the
 * work orders of its feeders on the same project.
 * `kind` gives the workshop its behaviour:
 *   laquage    turns raw bars/sheets into lacquered variants (+ powder)
 *   vitrage    produces glass panes / insulated units
 *   aluminium  cuts, machines and assembles the chassis
 *   other      a plain workshop (pose, finishing…)
 */
const workshopSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 12, match: [/^[A-Z0-9_]+$/, "Code: letters, digits and _ only"] },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: ["laquage", "aluminium", "vitrage", "other"], default: "other" },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    feeds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workshop" }],
    // Hourly cost used to price the labour minutes of the catalogue (MAD/h, HT).
    hourlyRate: { type: Number, default: 0, min: 0 },
    color: { type: String, trim: true, default: "#4c8dff" },
    order: { type: Number, default: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
workshopSchema.index({ company: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Workshop", workshopSchema);
