const mongoose = require("mongoose");

/**
 * ============================================================
 * SALARY
 * ============================================================
 * One document per salary period for an employee, not a single
 * mutable "current salary" field. Giving a raise creates a NEW
 * record (with its own effectiveDate) instead of overwriting the
 * old one, so salary history is preserved automatically:
 *
 *   - The record with `endDate: null` is the CURRENT salary.
 *   - Every other record for that employee is past history,
 *     closed off by `endDate` when the next raise was created.
 *
 * See routes/salaries.js — creating a new salary record for an
 * employee automatically sets `endDate` on whichever record was
 * previously current, so callers never have to manage that by
 * hand.
 * ============================================================
 */

const salarySchema = new mongoose.Schema(
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
        // AMOUNTS
        // =========================================================

        baseSalary: {
            type: Number,
            required: [true, "Base salary is required"],
            min: 0,
        },

        // Simple, flexible line items instead of a fixed set of
        // named fields — covers transport/housing allowances,
        // bonuses, deductions, etc. without a schema change.
        allowances: [
            {
                label: { type: String, trim: true, required: true },
                amount: { type: Number, required: true, min: 0 },
                _id: false,
            },
        ],

        deductions: [
            {
                label: { type: String, trim: true, required: true },
                amount: { type: Number, required: true, min: 0 },
                _id: false,
            },
        ],

        currency: {
            type: String,
            trim: true,
            default: "MAD",
        },

        // =========================================================
        // PERIOD
        // =========================================================

        effectiveDate: {
            type: Date,
            required: [true, "Effective date is required"],
            index: true,
        },

        // null = this is the employee's current salary.
        endDate: {
            type: Date,
            default: null,
        },

        notes: {
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
// VIRTUALS
// =============================================================

salarySchema.virtual("grossSalary").get(function computeGrossSalary() {
    const allowanceTotal = (this.allowances || []).reduce(
        (sum, item) => sum + (item.amount || 0),
        0
    );

    return (this.baseSalary || 0) + allowanceTotal;
});

salarySchema.virtual("netSalary").get(function computeNetSalary() {
    const deductionTotal = (this.deductions || []).reduce(
        (sum, item) => sum + (item.amount || 0),
        0
    );

    return this.grossSalary - deductionTotal;
});

salarySchema.set("toJSON", { virtuals: true });
salarySchema.set("toObject", { virtuals: true });

// =============================================================
// INDEXES
// =============================================================

// The most common query: "this employee's current salary".
salarySchema.index({ employee: 1, endDate: 1 });
salarySchema.index({ company: 1, employee: 1, effectiveDate: -1 });

module.exports = mongoose.model("Salary", salarySchema);
