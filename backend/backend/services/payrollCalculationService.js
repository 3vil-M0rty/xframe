const payrollConfig = require("../config/payrollConfig");

/**
 * ============================================================
 * PAYROLL CALCULATION SERVICE
 * ============================================================
 * Pure functions — no database access, no side effects. Given a
 * gross salary and a few employee-specific inputs, returns every
 * line of a Moroccan payslip. See config/payrollConfig.js for the
 * rates/brackets this reads from (and the disclaimer about keeping
 * them current).
 * ============================================================
 */

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Sum of a Salary record's allowances/deductions line-item arrays.
 */
function sumLineItems(items = []) {
  return (items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
}

/**
 * Computes the monthly CNSS employee contribution: rate × salary,
 * capped at the monthly ceiling.
 */
function computeCNSSEmployee(grossSalary) {
  const base = Math.min(grossSalary, payrollConfig.CNSS.MONTHLY_CEILING);
  return round2(base * payrollConfig.CNSS.EMPLOYEE_RATE);
}

/**
 * Employer-side CNSS cost — three sub-branches, since two of them
 * (long-term, short-term) are capped at the monthly ceiling while
 * family allowances are not. See config/payrollConfig.js for what
 * each one represents.
 */
function computeCNSSEmployer(grossSalary) {
  const cappedBase = Math.min(grossSalary, payrollConfig.CNSS.MONTHLY_CEILING);

  const longTerm = cappedBase * payrollConfig.CNSS.EMPLOYER_RATE_LONG_TERM;
  const shortTerm = cappedBase * payrollConfig.CNSS.EMPLOYER_RATE_SHORT_TERM;
  const familyAllowance =
    grossSalary * payrollConfig.CNSS.EMPLOYER_RATE_FAMILY_ALLOWANCE;

  return round2(longTerm + shortTerm + familyAllowance);
}

function computeVocationalTraining(grossSalary) {
  return round2(
    grossSalary * payrollConfig.CNSS.EMPLOYER_VOCATIONAL_TRAINING_RATE
  );
}

/**
 * AMO has no ceiling — applied to the full gross salary.
 */
function computeAMOEmployee(grossSalary) {
  return round2(grossSalary * payrollConfig.AMO.EMPLOYEE_RATE);
}

function computeAMOEmployer(grossSalary) {
  const base =
    payrollConfig.AMO.EMPLOYER_RATE +
    payrollConfig.AMO.EMPLOYER_SOLIDARITY_CONTRIBUTION_RATE;
  return round2(grossSalary * base);
}

function computeCIMR(grossSalary, employeeRate, employerRate) {
  const empRate = employeeRate ?? payrollConfig.CIMR.DEFAULT_EMPLOYEE_RATE;
  const erRate = employerRate ?? payrollConfig.CIMR.DEFAULT_EMPLOYER_RATE;

  return {
    employee: round2(grossSalary * empRate),
    employer: round2(grossSalary * erRate),
  };
}

/**
 * Professional-expenses deduction: a flat % of the salary that's
 * left after CNSS/AMO/CIMR, capped at a monthly ceiling.
 */
function computeProfessionalExpenses(taxableBeforeExpenses) {
  const uncapped =
    taxableBeforeExpenses * payrollConfig.PROFESSIONAL_EXPENSES.RATE;
  return round2(
    Math.min(uncapped, payrollConfig.PROFESSIONAL_EXPENSES.MONTHLY_CAP)
  );
}

/**
 * Progressive IR (income tax) using the annualized quick-calculation
 * method: find the bracket the ANNUAL taxable income falls into,
 * apply (income × rate) − deduction, then divide by 12.
 */
function computeAnnualIR(annualTaxableIncome) {
  const bracket = payrollConfig.IR_BRACKETS.find(
    (b) => annualTaxableIncome <= b.upTo
  );

  if (!bracket || bracket.rate === 0) return 0;

  const raw = annualTaxableIncome * bracket.rate - bracket.deduction;
  return Math.max(raw, 0);
}

/**
 * Family-charge deduction: a flat amount subtracted from the IR
 * itself (not the taxable base), per dependent up to the max.
 */
function computeFamilyDeduction(numberOfDependents = 0) {
  const count = Math.min(
    numberOfDependents,
    payrollConfig.FAMILY_DEDUCTION.MAX_DEPENDENTS
  );
  return round2(count * payrollConfig.FAMILY_DEDUCTION.PER_DEPENDENT_MONTHLY);
}

/**
 * Full payslip calculation for one employee, one month.
 *
 * @param {Object} input
 * @param {number} input.baseSalary
 * @param {Array}  input.allowances  - [{ label, amount }]
 * @param {Array}  input.deductions  - [{ label, amount }] (non-statutory, e.g. advance repayment)
 * @param {number} input.numberOfDependents
 * @param {number} [input.cimrEmployeeRate]
 * @param {number} [input.cimrEmployerRate]
 * @param {number} [input.overtimeAmount] - extra pay for overtime hours, already computed
 * @param {number} [input.unpaidDeduction] - deduction for unpaid absence days, already computed
 */
function calculatePayslip({
  baseSalary,
  allowances = [],
  deductions = [],
  numberOfDependents = 0,
  cimrEmployeeRate,
  cimrEmployerRate,
  overtimeAmount = 0,
  unpaidDeduction = 0,
}) {
  const allowanceTotal = sumLineItems(allowances);
  const otherDeductionTotal = sumLineItems(deductions);

  // Gross salary = base + allowances + overtime, minus any unpaid
  // days already known at this point (unpaid absence reduces the
  // salary base itself, before statutory contributions).
  const grossSalary = round2(
    baseSalary + allowanceTotal + overtimeAmount - unpaidDeduction
  );

  const cnssEmployee = computeCNSSEmployee(grossSalary);
  const cnssEmployer = computeCNSSEmployer(grossSalary);
  const vocationalTraining = computeVocationalTraining(grossSalary);

  const amoEmployee = computeAMOEmployee(grossSalary);
  const amoEmployer = computeAMOEmployer(grossSalary);

  const cimr = computeCIMR(grossSalary, cimrEmployeeRate, cimrEmployerRate);

  const taxableBeforeExpenses = round2(
    grossSalary - cnssEmployee - amoEmployee - cimr.employee
  );

  const professionalExpenses = computeProfessionalExpenses(
    taxableBeforeExpenses
  );

  const monthlyTaxableIncome = round2(
    taxableBeforeExpenses - professionalExpenses
  );

  const annualIR = computeAnnualIR(monthlyTaxableIncome * 12);
  const monthlyIRBeforeFamilyDeduction = round2(annualIR / 12);

  const familyDeduction = computeFamilyDeduction(numberOfDependents);

  const incomeTax = round2(
    Math.max(monthlyIRBeforeFamilyDeduction - familyDeduction, 0)
  );

  const totalEmployeeDeductions = round2(
    cnssEmployee + amoEmployee + cimr.employee + incomeTax + otherDeductionTotal
  );

  const netSalary = round2(grossSalary - totalEmployeeDeductions);

  const totalEmployerCost = round2(
    grossSalary +
      cnssEmployer +
      vocationalTraining +
      amoEmployer +
      cimr.employer
  );

  return {
    currency: payrollConfig.CURRENCY,

    baseSalary: round2(baseSalary),
    allowances,
    allowanceTotal: round2(allowanceTotal),
    overtimeAmount: round2(overtimeAmount),
    unpaidDeduction: round2(unpaidDeduction),
    grossSalary,

    cnssEmployee,
    amoEmployee,
    cimrEmployee: cimr.employee,
    professionalExpenses,
    monthlyTaxableIncome,
    incomeTax,
    familyDeduction,
    otherDeductions: deductions,
    otherDeductionTotal: round2(otherDeductionTotal),
    totalEmployeeDeductions,

    netSalary,

    // Employer-side (doesn't affect employee net pay, but needed
    // for payroll-cost reporting).
    employer: {
      cnssEmployer,
      vocationalTraining,
      amoEmployer,
      cimrEmployer: cimr.employer,
      totalEmployerCost,
    },
  };
}

module.exports = {
  calculatePayslip,
  computeCNSSEmployee,
  computeCNSSEmployer,
  computeAMOEmployee,
  computeAMOEmployer,
  computeAnnualIR,
  computeFamilyDeduction,
  sumLineItems,
  round2,
};
