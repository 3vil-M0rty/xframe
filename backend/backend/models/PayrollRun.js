// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * ============================================================
 * PAYROLL RUN
 * ============================================================
 * One document per "run payroll for this company, this month".
 * Generating a run creates one Payslip per active employee (see
 * routes/payroll.js). A run starts as "draft" — payslips can still
 * be regenerated/deleted. Marking it "completed" locks it: past
 * payslips become historical record and shouldn't be silently
 * recalculated after the fact (re-running payroll for a closed
 * period should require an explicit correction, not an overwrite).
 * ============================================================
 */

const payrollRunSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    // 1-12
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "completed", "voided"],
      default: "draft",
      index: true,
    },

    employeeCount: {
      type: Number,
      default: 0,
    },

    totalGross: {
      type: Number,
      default: 0,
    },

    totalNet: {
      type: Number,
      default: 0,
    },

    totalEmployerCost: {
      type: Number,
      default: 0,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// One run per company/month/year.
payrollRunSchema.index({ company: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("PayrollRun", payrollRunSchema);
