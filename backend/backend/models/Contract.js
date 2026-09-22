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

    // Set once a "contract_expiring" notification has been sent for
    // this contract's CURRENT endDate — prevents the daily
    // expiry-check job (see services/scheduledNotificationsService.js)
    // from re-notifying HR every single day of the 30-day warning
    // window. Cleared automatically if endDate is pushed further out
    // (a renewal), so an extended contract can re-enter the window
    // and be notified again for its new date.
    expiryNotifiedAt: { type: Date, default: null },

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

// If endDate is pushed out (a renewal, or simply corrected), clear
// any prior expiry notification flag so the daily expiry-check job
// can notify HR again once the NEW date enters the warning window —
// otherwise a renewed contract would silently never be flagged
// again.
contractSchema.pre("save", function clearStaleExpiryFlag(next) {
  if (this.isModified("endDate") && this.expiryNotifiedAt) {
    this.expiryNotifiedAt = null;
  }
  next();
});

module.exports = mongoose.model("Contract", contractSchema);
