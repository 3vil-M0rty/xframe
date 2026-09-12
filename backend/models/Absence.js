const mongoose = require("mongoose");

/**
 * ============================================================
 * ABSENCE
 * ============================================================
 * Covers both planned leave requests (paid/unpaid leave, sick
 * leave) and unplanned absences, each going through the same
 * request → review workflow (the "Synergie"-style flow the
 * product asked for):
 *
 *   status:    pending → accepted | rejected
 *   justified: whether the employee provided a valid reason /
 *              supporting document for the absence. Relevant
 *              mainly for `type: "absence"` (an unplanned
 *              no-show); for planned leave this is typically
 *              left justified since the request itself is the
 *              justification.
 * ============================================================
 */

const absenceSchema = new mongoose.Schema(
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

        // =========================================================
        // TYPE
        // =========================================================

        type: {
            type: String,
            enum: [
                "paid_leave", // congé payé
                "unpaid_leave", // congé sans solde
                "sick_leave", // congé maladie
                "absence", // absence non planifiée
                "other",
            ],
            required: [true, "Absence type is required"],
            index: true,
        },

        // =========================================================
        // PERIOD
        // =========================================================

        startDate: {
            type: Date,
            required: [true, "Start date is required"],
        },

        endDate: {
            type: Date,
            required: [true, "End date is required"],
        },

        halfDay: {
            type: Boolean,
            default: false,
        },

        // Denormalized so list views don't need to recompute this
        // from startDate/endDate on every render. Kept in sync by
        // the route handler on create/update.
        daysCount: {
            type: Number,
            min: 0,
        },

        // =========================================================
        // JUSTIFICATION
        // =========================================================

        justified: {
            type: Boolean,
            default: true,
        },

        reason: {
            type: String,
            trim: true,
            maxlength: 2000,
        },

        attachment: {
            url: { type: String, trim: true },
            publicId: { type: String, trim: true },
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
// INDEXES
// =============================================================

absenceSchema.index({ company: 1, employee: 1, startDate: -1 });
absenceSchema.index({ company: 1, status: 1 });
absenceSchema.index({ company: 1, type: 1 });

module.exports = mongoose.model("Absence", absenceSchema);
