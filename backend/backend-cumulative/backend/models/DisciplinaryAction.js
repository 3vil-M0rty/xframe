// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * DISCIPLINARY ACTION
 * ============================================================
 * A record of a warning or corrective action issued to an
 * employee — verbal warning through termination notice. Kept as
 * its own record type (rather than, say, a note on the Employee)
 * because these need their own timeline, their own
 * acknowledgment flow, and their own access restriction: this is
 * sensitive HR data, gated at Responsable RH and above (see
 * routes/disciplinaryActions.js), not just anyone with HR access.
 * ============================================================
 */

const disciplinaryActionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company is required"],
      index: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee is required"],
      index: true,
    },

    type: {
      type: String,
      enum: ["verbal_warning", "written_warning", "final_warning", "suspension", "termination_notice"],
      required: [true, "Type is required"],
    },

    date: { type: Date, required: true, default: Date.now },

    reason: { type: String, trim: true, required: [true, "Reason is required"], maxlength: 300 },
    description: { type: String, trim: true, maxlength: 3000 },

    // Only meaningful for type: "suspension" — left null otherwise.
    suspensionDays: { type: Number, min: 1, default: null },

    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },

    // Whether the employee has confirmed they've seen this record —
    // same acknowledgment pattern as PerformanceReview, since a
    // disciplinary action that was never actually communicated to
    // the employee is legally meaningless in most jurisdictions,
    // Morocco's Code du Travail included.
    acknowledgedByEmployee: { type: Boolean, default: false },
    acknowledgedAt: { type: Date, default: null },

    // An optional attached document (e.g. the signed written
    // warning letter, scanned) — stored the same way as
    // EmployeeDocument's file field.
    file: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      originalName: { type: String, trim: true },
    },

    notes: { type: String, trim: true, maxlength: 1000 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

disciplinaryActionSchema.index({ company: 1, employee: 1, date: -1 });

// Multilingual content layer (see plugins/translatable.js).
disciplinaryActionSchema.plugin(translatable, { fields: ["reason", "description", "notes"] });

module.exports = mongoose.model("DisciplinaryAction", disciplinaryActionSchema);
