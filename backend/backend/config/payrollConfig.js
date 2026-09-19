/**
 * ============================================================
 * MOROCCO PAYROLL CONFIGURATION — PRIVATE SECTOR (RÉGIME GÉNÉRAL)
 * ============================================================
 * ⚠️  READ BEFORE USING THIS FOR REAL PAYROLL  ⚠️
 *
 * Every number below is a real, named Moroccan payroll parameter
 * (CNSS, AMO, IR, frais professionnels, SMIG) as of the 2024
 * Loi de Finances reform of the income-tax brackets. Morocco
 * revises some of these figures via the Loi de Finances, usually
 * announced in December and effective the following January —
 * so treat this file as "last known good", not "guaranteed
 * current", and re-verify it at least once a year:
 *
 *   - CNSS rates/ceiling: https://www.cnss.ma (Employeur > Cotisations)
 *   - IR brackets: Direction Générale des Impôts (tax.gov.ma), or
 *     the current year's Note Circulaire on the Loi de Finances.
 *   - SMIG: Ministère du Travail (updated periodically, not every year)
 *
 * This system has no way to detect that a rate is outdated — it
 * will keep calculating with whatever is written here. Update this
 * ONE file when rates change; every payslip calculation reads from
 * it (see services/payrollCalculationService.js), so nothing else
 * needs to change.
 *
 * Scope: this models the RÉGIME GÉNÉRAL (ordinary private-sector
 * employees under the CNSS/AMO system). It does NOT cover BTP
 * (construction) sector-specific rates, agricultural workers
 * (CNSS has a separate, lower-rate regime for them), or public-
 * sector/CMR pension rules — those need their own configuration
 * if you need them.
 * ============================================================
 */

module.exports = {
  CURRENCY: "MAD",

  // ----------------------------------------------------------
  // CNSS (Caisse Nationale de Sécurité Sociale)
  // Source: CNSS "Taux de cotisations" schedule.
  // ----------------------------------------------------------
  CNSS: {
    // Employee's share, deducted from gross salary. Only applies
    // up to the monthly ceiling — any salary above it is NOT
    // subject to this specific deduction (the ceiling has been
    // 6,000 MAD/month for several years).
    EMPLOYEE_RATE: 0.0448, // 4.48% — covers old-age/invalidity/death (long-term) + short-term (sickness/maternity) benefits, employee's combined share
    MONTHLY_CEILING: 6000, // MAD

    // Employer's share (informational only — doesn't change the
    // employee's net pay, but is needed for true "cost to company"
    // reporting). CNSS employer contributions are actually split
    // across several sub-branches, shown here individually so each
    // one can be corrected independently if you have exact figures:
    EMPLOYER_RATE_LONG_TERM: 0.0898, // 8.98% — old-age/invalidity/death, capped at MONTHLY_CEILING
    EMPLOYER_RATE_SHORT_TERM: 0.0067, // 0.67% — sickness/maternity, capped at MONTHLY_CEILING
    EMPLOYER_RATE_FAMILY_ALLOWANCE: 0.064, // 6.40% — family allowances ("allocations familiales"), NO ceiling

    // Vocational training tax ("taxe de formation professionnelle"),
    // employer-only, no ceiling.
    EMPLOYER_VOCATIONAL_TRAINING_RATE: 0.016, // 1.6%
  },

  // ----------------------------------------------------------
  // AMO (Assurance Maladie Obligatoire) — CNSS-administered
  // health insurance, separate from the CNSS contribution above.
  // ----------------------------------------------------------
  AMO: {
    EMPLOYEE_RATE: 0.0226, // 2.26%, NO ceiling — applies to full gross salary
    EMPLOYER_RATE: 0.0411, // 4.11%, NO ceiling
    // A small additional AMO participation fee sometimes cited
    // alongside the main rate ("participation à l'effort de
    // solidarité"), employer-only. Set to 0 if not applicable to
    // your company; left explicit here rather than silently
    // folded into EMPLOYER_RATE so it's easy to toggle off.
    EMPLOYER_SOLIDARITY_CONTRIBUTION_RATE: 0.0,
  },

  // ----------------------------------------------------------
  // CIMR (Caisse Interprofessionnelle Marocaine de Retraite)
  // Optional complementary retirement scheme — NOT every company
  // enrolls, and it's not required by law. Where offered, the rate
  // is chosen by the employer (commonly between 3% and 6%,
  // employee and employer usually matching). Defaults to 0 (not
  // enrolled) unless set on the employee's Salary record.
  // ----------------------------------------------------------
  CIMR: {
    DEFAULT_EMPLOYEE_RATE: 0,
    DEFAULT_EMPLOYER_RATE: 0,
  },

  // ----------------------------------------------------------
  // FRAIS PROFESSIONNELS (standard professional-expense deduction)
  // A flat percentage of taxable salary (after CNSS/AMO/CIMR) is
  // deducted before computing income tax, up to a monthly cap —
  // this is a standard allowance, not something the employee has
  // to justify with receipts.
  // ----------------------------------------------------------
  PROFESSIONAL_EXPENSES: {
    RATE: 0.2, // 20% — the long-standing general rate for most professions
    MONTHLY_CAP: 2500, // MAD (30,000 MAD/year)
  },

  // ----------------------------------------------------------
  // IR (Impôt sur le Revenu) — progressive ANNUAL brackets,
  // reformed by the 2023 Loi de Finances (effective January 2024):
  // the 0%-threshold rose from 30,000 to 40,000 MAD/year and the
  // top rate dropped from 38% to 37%.
  //
  // `deduction` is the standard "quick calculation" ("somme à
  // déduire") subtracted after applying the bracket's rate to the
  // full annual taxable income:
  //     IR_annuel = revenu_imposable_annuel × rate − deduction
  // These deduction values are derived FROM the rates/thresholds
  // themselves (they make the formula continuous across bracket
  // boundaries) — if you update a threshold or rate, recompute the
  // deductions for every bracket after it too.
  // ----------------------------------------------------------
  IR_BRACKETS: [
    { upTo: 40000, rate: 0, deduction: 0 },
    { upTo: 60000, rate: 0.1, deduction: 4000 },
    { upTo: 80000, rate: 0.2, deduction: 10000 },
    { upTo: 100000, rate: 0.3, deduction: 18000 },
    { upTo: 180000, rate: 0.34, deduction: 22000 },
    { upTo: Infinity, rate: 0.37, deduction: 27400 },
  ],

  // ----------------------------------------------------------
  // CHARGES DE FAMILLE (family-charge deduction)
  // A flat monthly reduction of the IR AMOUNT ITSELF (not of the
  // taxable base) per dependent (spouse + each child), up to a
  // maximum number of dependents.
  // ----------------------------------------------------------
  FAMILY_DEDUCTION: {
    PER_DEPENDENT_MONTHLY: 30, // MAD, subtracted from IR owed
    MAX_DEPENDENTS: 6, // i.e. a maximum of 180 MAD/month
  },

  // ----------------------------------------------------------
  // SMIG (Salaire Minimum Interprofessionnel Garanti)
  // General private-sector minimum wage — used only to flag
  // salaries that look non-compliant; not enforced automatically.
  // Morocco also has a separate, lower SMAG for agricultural
  // workers, not modeled here.
  // ----------------------------------------------------------
  SMIG_MONTHLY_APPROX: 3111, // MAD/month, based on the standard 191 hours/month at the hourly SMIG rate
};
