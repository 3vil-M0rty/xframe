const mongoose = require("mongoose");

/**
 * ============================================================
 * ADVANCE (avance sur salaire)
 * ============================================================
 * A salary advance request, going through the same
 * pending → accepted/rejected workflow as Absence. Once
 * accepted, repayment is tracked with a simple running total
 * (`repaidAmount`) rather than a full installment schedule —
 * good enough to know at a glance how much of an advance is
 * still outstanding.
 * ============================================================
 */

const advanceSchema = new mongoose.Schema(
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

        amount: {
            type: Number,
            required: [true, "Amount is required"],
            min: 0,
        },

        currency: {
            type: String,
            trim: true,
            default: "MAD",
        },

        requestDate: {
            type: Date,
            default: Date.now,
        },

        reason: {
            type: String,
            trim: true,
            maxlength: 2000,
        },

        // =========================================================
        // WORKFLOW
        // =========================================================

        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
            index: true,
        },

        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

        reviewComment: {
            type: String,
            trim: true,
            maxlength: 2000,
        },

        // =========================================================
        // REPAYMENT (only meaningful once status === "accepted")
        // =========================================================

        repaidAmount: {
            type: Number,
            min: 0,
            default: 0,
        },

        repaid: {
            type: Boolean,
            default: false,
        },

        // =========================================================
        // SYSTEM
        // =========================================================

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

// =============================================================
// VIRTUALS
// =============================================================

advanceSchema.virtual("remainingAmount").get(function computeRemaining() {
    return Math.max((this.amount || 0) - (this.repaidAmount || 0), 0);
});

advanceSchema.set("toJSON", { virtuals: true });
advanceSchema.set("toObject", { virtuals: true });

// =============================================================
// INDEXES
// =============================================================

advanceSchema.index({ company: 1, employee: 1, requestDate: -1 });
advanceSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model("Advance", advanceSchema);
