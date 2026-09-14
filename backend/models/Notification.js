const mongoose = require("mongoose");

/**
 * ============================================================
 * NOTIFICATION
 * ============================================================
 * In-app only for now — there's no email/SMS provider configured
 * in this backend. See services/notificationService.js for the
 * single choke point that creates these; wiring in real email
 * later means adding a send step there, not touching every call
 * site that currently calls notify(...).
 * ============================================================
 */

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "absence_pending",
        "absence_reviewed",
        "advance_pending",
        "advance_reviewed",
        "contract_expiring",
        "document_expiring",
        "payslip_available",
        "other",
      ],
      required: true,
    },

    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },

    // Frontend route to navigate to when the notification is
    // clicked, e.g. "/hr/absences".
    link: { type: String, trim: true },

    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
