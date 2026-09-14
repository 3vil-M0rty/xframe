const mongoose = require("mongoose");

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

    notes: { type: String, trim: true, maxlength: 1000 },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

employeeDocumentSchema.index({ company: 1, employee: 1 });
employeeDocumentSchema.index({ company: 1, type: 1 });

module.exports = mongoose.model("EmployeeDocument", employeeDocumentSchema);
