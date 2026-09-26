// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * ============================================================
 * PAYSLIP
 * ============================================================
 * One document per employee, per PayrollRun. Snapshots the full
 * calculation output from services/payrollCalculationService.js
 * at the time the run was generated — so even if the employee's
 * salary or the tax config changes later, this record still shows
 * exactly what was paid for that period.
 * ============================================================
 */

const lineItemSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const payslipSchema = new mongoose.Schema(
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

    payrollRun: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      required: true,
      index: true,
    },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    currency: { type: String, default: "MAD" },

    // ----- Earnings -----
    baseSalary: { type: Number, required: true },
    allowances: [lineItemSchema],
    allowanceTotal: { type: Number, default: 0 },
    overtimeAmount: { type: Number, default: 0 },
    // Premium for public holidays (jours fériés) worked — see
    // services/payrollAttendanceService.js.
    holidayAmount: { type: Number, default: 0 },
    holidayHours: { type: Number, default: 0 },
    unpaidDeduction: { type: Number, default: 0 },
    grossSalary: { type: Number, required: true },

    // ----- Statutory deductions -----
    cnssEmployee: { type: Number, default: 0 },
    amoEmployee: { type: Number, default: 0 },
    cimrEmployee: { type: Number, default: 0 },
    professionalExpenses: { type: Number, default: 0 },
    monthlyTaxableIncome: { type: Number, default: 0 },
    incomeTax: { type: Number, default: 0 },
    familyDeduction: { type: Number, default: 0 },

    // ----- Other deductions (e.g. advance repayment) -----
    otherDeductions: [lineItemSchema],
    otherDeductionTotal: { type: Number, default: 0 },

    totalEmployeeDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },

    // ----- Employer-side cost (informational) -----
    employerCnss: { type: Number, default: 0 },
    employerVocationalTraining: { type: Number, default: 0 },
    employerAmo: { type: Number, default: 0 },
    employerCimr: { type: Number, default: 0 },
    totalEmployerCost: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["draft", "validated", "paid"],
      default: "draft",
      index: true,
    },

    paidAt: { type: Date, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// One payslip per employee per run.
payslipSchema.index({ payrollRun: 1, employee: 1 }, { unique: true });
// "This employee's payslip history" / "this company's payslips this year".
payslipSchema.index({ employee: 1, year: -1, month: -1 });
payslipSchema.index({ company: 1, year: -1, month: -1 });

module.exports = mongoose.model("Payslip", payslipSchema);
