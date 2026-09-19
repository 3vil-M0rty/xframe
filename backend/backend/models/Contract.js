const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * CONTRACT
 * ============================================================
 * Unlike `employee.employmentType` (a single field on the
 * employee describing their CURRENT contract type), this is a
 * full history: every contract an employee has had, with its own
 * dates, document, and renewal chain. Renewing a contract doesn't
 * mutate the old record — it creates a NEW one referencing the
 * old one via `previousContract`, same pattern as Salary history.
 *
 * Morocco-specific compliance note: a CDD (fixed-term) contract
 * legally converts to a CDI (permanent) after a certain number of
 * renewals/total duration depending on sector — this system
 * surfaces the renewal COUNT so HR can catch that themselves; it
 * does not attempt to auto-enforce the legal conversion rule
 * (which varies by collective bargaining agreement).
 * ============================================================
 */

const contractSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "permanent", // CDI
        "fixed_term", // CDD
        "temporary",
        "intern",
        "apprentice",
        "freelance",
        "part_time",
        "other",
      ],
      required: true,
    },

    startDate: { type: Date, required: true },
    // null = open-ended (CDI)
    endDate: { type: Date, default: null },

    jobTitle: { type: String, trim: true },
    department: { type: String, trim: true },

    status: {
      type: String,
      enum: ["active", "expired", "terminated", "renewed"],
      default: "active",
      index: true,
    },

    renewalCount: { type: Number, default: 0 },

    previousContract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },

    document: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },

    notes: { type: String, trim: true, maxlength: 2000 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

contractSchema.index({ company: 1, employee: 1, startDate: -1 });
contractSchema.index({ company: 1, status: 1 });
// Supports "contracts expiring soon" queries.
contractSchema.index({ endDate: 1, status: 1 });

// Multilingual content layer (see plugins/translatable.js) for the
// free-text field(s) below — every language in config/i18nContent.js's
// CONTENT_LANGUAGES gets its own auto-translated + manually-editable slot.
contractSchema.plugin(translatable, { fields: ["jobTitle", "department", "notes"] });

module.exports = mongoose.model("Contract", contractSchema);
