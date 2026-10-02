const mongoose = require("mongoose");

/**
 * ============================================================
 * AUDIT LOG
 * ============================================================
 * Append-only record of who changed what. `before`/`after` are
 * loose snapshots (Mixed) rather than typed schemas on purpose —
 * this needs to log changes to many different resource types
 * (Employee, Salary, Absence, Advance, Contract, User, ...)
 * without a matching schema per type. See services/auditLogger.js
 * for the single helper every route calls into.
 * ============================================================
 */

const auditLogSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    // Client this entry belongs to (set automatically — see services/tenantScope.js).
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: ["create", "update", "delete", "review"],
      required: true,
    },

    resourceType: {
      type: String,
      required: true,
      index: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Human-readable label of the affected record (e.g. an
    // employee's name) so the log is readable without joining
    // against a resource that may since have been deleted.
    resourceLabel: { type: String, trim: true },

    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

auditLogSchema.index({ company: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
