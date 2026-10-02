import { describe, it, expect } from "vitest";
const { calculatePayslip, computeFamilyDeduction } = require("./payrollCalculationService");

describe("payslip calculation — 2025/2026 rules", () => {
  it("frais professionnels 25% of GROSS, capped at 2,916.67/month above 6,500 gross (CGI art. 59, LF 2023)", () => {
    const p = calculatePayslip({ baseSalary: 10000, allowances: [], deductions: [], numberOfDependents: 0 });
    expect(p.professionalExpenses).toBe(2500); // 25% × 10,000
    const high = calculatePayslip({ baseSalary: 20000, allowances: [], deductions: [], numberOfDependents: 0 });
    expect(high.professionalExpenses).toBe(2916.67);
  });

  it("35% of gross up to 78,000/year (6,500/month)", () => {
    const p = calculatePayslip({ baseSalary: 6000, allowances: [], deductions: [], numberOfDependents: 0 });
    expect(p.professionalExpenses).toBe(2100);
  });

  it("10,000 gross, no dependents: full chain", () => {
    const p = calculatePayslip({ baseSalary: 10000, allowances: [], deductions: [], numberOfDependents: 0 });
    expect(p.cnssEmployee).toBe(268.8); // 6,000 × 4.48%
    expect(p.amoEmployee).toBe(226); // 10,000 × 2.26%
    // net taxable = 10,000 − 268.80 − 226 − 2,500 = 7,005.20 → 84,062.40/yr → 30% − 18,000
    expect(p.monthlyTaxableIncome).toBe(7005.2);
    expect(p.incomeTax).toBe(Math.round(((84062.4 * 0.3 - 18000) / 12) * 100) / 100);
  });

  it("family reduction: 500 MAD/year per dependent, 6 max (LF 2025)", () => {
    expect(computeFamilyDeduction(1)).toBe(41.67);
    expect(computeFamilyDeduction(6)).toBe(250);
    expect(computeFamilyDeduction(9)).toBe(250);
  });
});
