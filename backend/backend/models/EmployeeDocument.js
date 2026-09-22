const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * EMPLOYEE DOCUMENT
 * ============================================================
 * A scanned/uploaded document tied to an employee (CIN, passport,
 * work permit, diploma, signed contract, ...). `expiryDate` is
 * optional — only ID-type documents typically have one — and is
 * what powers the "expiring soon" alerts (see
 * routes/documents.js -> GET /expiring and services/notificationService.js).
 * ============================================================
 */

const employeeDocumentSchema = new mongoose.Schema(
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
        "cin",
        "passport",
        "work_permit",
        "residence_permit",
        "contract",
        "diploma",
        "cv",
        "medical_certificate",
        "other",
      ],
      required: true,
    },

    label: { type: String, trim: true },

    file: {
      url: { type: String, trim: true, required: true },
      publicId: { type: String, trim: true },
      originalName: { type: String, trim: true },
    },

    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null, index: true },

    // Set once a "document_expiring" notification has been sent for
    // this document's CURRENT expiryDate — see the matching field
    // on Contract.js for why (avoids re-notifying HR every day of
    // the warning window; cleared if expiryDate moves later so a
    // replaced/renewed document can be notified again for its new
    // date).
    expiryNotifiedAt: { type: Date, default: null },

    notes: { type: String, trim: true, maxlength: 1000 },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

employeeDocumentSchema.index({ company: 1, employee: 1 });
employeeDocumentSchema.index({ company: 1, type: 1 });

// Multilingual content layer (see plugins/translatable.js) for the
// free-text field(s) below — every language in config/i18nContent.js's
// CONTENT_LANGUAGES gets its own auto-translated + manually-editable slot.
employeeDocumentSchema.plugin(translatable, { fields: ["label", "notes"] });

// Same reasoning as Contract.js's matching hook: if expiryDate moves
// later (a renewed passport/permit re-uploaded with a new date),
// clear the notified flag so the expiry-check job can notify HR
// again once the new date enters the warning window.
employeeDocumentSchema.pre("save", function clearStaleExpiryFlag(next) {
  if (this.isModified("expiryDate") && this.expiryNotifiedAt) {
    this.expiryNotifiedAt = null;
  }
  next();
});

module.exports = mongoose.model("EmployeeDocument", employeeDocumentSchema);
