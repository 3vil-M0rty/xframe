/**
 * ============================================================
 * MOROCCO PAYROLL CONFIGURATION
 * ============================================================
 * ⚠️  IMPORTANT — READ BEFORE USING THIS FOR REAL PAYROLL  ⚠️
 *
 * The rates, ceilings, and brackets below reflect Morocco's
 * general payroll rules (CNSS, AMO, IR) as commonly published,
 * but tax law and contribution rates change over time (the
 * Direction Générale des Impôts and CNSS both revise figures,
 * sometimes yearly via the Loi de Finances). This file is a
 * STARTING POINT for a payroll calculation engine, not a
 * certified, up-to-date compliance source.
 *
 * Before running real payroll with this system:
 *   1. Verify every rate/ceiling/bracket below against the
 *      current official CNSS (cnss.ma) and DGI (tax.gov.ma)
 *      publications, or with a licensed accountant / expert-
 *      comptable.
 *   2. Update the constants here — nothing else in the codebase
 *      needs to change, since payrollCalculationService.js reads
 *      everything from this one file.
 *   3. Re-verify at least once a year (typically after the
 *      Loi de Finances is published, around January).
 *
 * This system will NOT stop you from running payroll with
 * outdated rates — it has no way to know they're outdated. That
 * responsibility is on whoever configures/maintains this file.
 * ============================================================
 */

module.exports = {
  CURRENCY: "MAD",

  // ----------------------------------------------------------
  // CNSS (Caisse Nationale de Sécurité Sociale)
  // ----------------------------------------------------------
  CNSS: {
    // Employee share, deducted from gross salary. Applied up to
    // the monthly ceiling below (any salary above the ceiling is
    // NOT subject to this deduction).
    EMPLOYEE_RATE: 0.0448, // 4.48%
    MONTHLY_CEILING: 6000, // MAD — contribution capped at this salary level

    // Employer share (informational — doesn't affect the
    // employee's net pay, but matters for total employer cost
    // reporting). Real employer CNSS is actually split across
    // several sub-branches (family allowances, short-term and
    // long-term benefits) each with their own rate/ceiling —
    // collapsed here into one aggregate rate for simplicity.
    EMPLOYER_RATE: 0.209, // ~20.9% (aggregate, approximate)

    // Vocational training tax ("taxe de formation professionnelle"),
    // employer-only, no ceiling.
    EMPLOYER_VOCATIONAL_TRAINING_RATE: 0.016, // 1.6%
  },

  // ----------------------------------------------------------
  // AMO (Assurance Maladie Obligatoire)
  // ----------------------------------------------------------
  AMO: {
    EMPLOYEE_RATE: 0.0226, // 2.26%, no ceiling
    EMPLOYER_RATE: 0.0411, // 4.11%, no ceiling (approximate)
  },

  // ----------------------------------------------------------
  // CIMR (Caisse Interprofessionnelle Marocaine de Retraite)
  // Optional private/complementary retirement scheme — NOT every
  // company or employee is enrolled. Rate is elective (companies
  // typically choose between 3% and 6%, employee and employer
  // usually matching). Defaults to 0 (not enrolled) unless set on
  // the Salary record.
  // ----------------------------------------------------------
  CIMR: {
    DEFAULT_EMPLOYEE_RATE: 0,
    DEFAULT_EMPLOYER_RATE: 0,
  },

  // ----------------------------------------------------------
  // PROFESSIONAL EXPENSES DEDUCTION ("frais professionnels")
  // A flat percentage of taxable salary (after CNSS/AMO/CIMR) is
  // deducted before computing income tax, up to a monthly cap.
  // ----------------------------------------------------------
  PROFESSIONAL_EXPENSES: {
    RATE: 0.2, // 20%
    MONTHLY_CAP: 2500, // MAD
  },

  // ----------------------------------------------------------
  // IR (Impôt sur le Revenu) — progressive annual brackets.
  // `deduction` is the standard "quick calculation" subtraction
  // used with each bracket's rate (IR = taxable × rate - deduction).
  // Figures are ANNUAL — the calculation service annualizes the
  // monthly taxable base ×12, computes annual IR, then divides
  // by 12 for the monthly withholding.
  // ----------------------------------------------------------
  IR_BRACKETS: [
    { upTo: 30000, rate: 0, deduction: 0 },
    { upTo: 50000, rate: 0.1, deduction: 3000 },
    { upTo: 60000, rate: 0.2, deduction: 8000 },
    { upTo: 80000, rate: 0.3, deduction: 14000 },
    { upTo: 180000, rate: 0.34, deduction: 17200 },
    { upTo: Infinity, rate: 0.38, deduction: 24400 },
  ],

  // ----------------------------------------------------------
  // FAMILY CHARGE DEDUCTION ("charges de famille")
  // A flat monthly reduction of the IR amount itself (not of the
  // taxable base) per dependent, up to a maximum number of
  // dependents.
  // ----------------------------------------------------------
  FAMILY_DEDUCTION: {
    PER_DEPENDENT_MONTHLY: 30, // MAD, subtracted from IR owed
    MAX_DEPENDENTS: 6,
  },

  // ----------------------------------------------------------
  // MINIMUM WAGE (SMIG) — used only to flag salaries that look
  // non-compliant; not enforced automatically.
  // ----------------------------------------------------------
  SMIG_MONTHLY_APPROX: 3111, // MAD, general private-sector SMIG (approximate)
};
