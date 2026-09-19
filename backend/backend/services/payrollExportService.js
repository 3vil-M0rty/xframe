const payrollConfig = require("../config/payrollConfig");

/**
 * ============================================================
 * PAYROLL EXPORT SERVICE — CSV generators
 * ============================================================
 * Three exports, all built from a completed PayrollRun's payslips:
 *
 * 1. CNSS BDS worksheet (buildCnssExport) — every field CNSS's
 *    monthly Bordereau de Déclaration de Salaires needs, in a
 *    clearly-labeled CSV. ⚠️ This is a DECLARATION WORKSHEET, not
 *    a guaranteed-compatible Damancom upload file: CNSS's exact
 *    technical file format for direct portal/API upload is a
 *    separate specification (available from CNSS's employer
 *    portal documentation) that can change independently of this
 *    code. Use this to fill the Damancom portal by hand or hand it
 *    to your comptable — verify the exact upload format before
 *    wiring any direct automated submission.
 *
 * 2. Payroll register ("État de paie" / "Livre de paie")
 *    (buildPayrollRegister) — the full per-employee breakdown
 *    employers are required to keep on file.
 *
 * 3. Bank mass-transfer file (buildBankTransferExport) — a
 *    generic virement-de-masse CSV (employee, RIB/IBAN, net
 *    amount). Moroccan banks each have their own exact required
 *    column layout for their mass-payment portals (Attijariwafa,
 *    BMCE/Bank of Africa, Banque Populaire, CIH, ...) — treat this
 *    as a solid starting point to adapt to your bank's specific
 *    template, not a drop-in file for every bank.
 * ============================================================
 */

function csvEscape(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(";")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(";"));
  }
  // Leading BOM so Excel opens the accented French headers correctly.
  return "\uFEFF" + lines.join("\r\n");
}

function fullName(employee) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim();
}

/**
 * @param {Object} run - PayrollRun
 * @param {Array} payslips - populated with `employee`
 * @param {Object} company
 */
function buildCnssExport(run, payslips, company) {
  const headers = [
    "N° Affiliation CNSS Employeur",
    "Mois",
    "Année",
    "N° CNSS Salarié",
    "CIN",
    "Nom",
    "Prénom",
    "Matricule",
    "Nombre de jours déclarés",
    "Salaire Brut Déplafonné (MAD)",
    "Salaire Brut Plafonné CNSS (MAD)",
    "Cotisation CNSS Salarié (MAD)",
    "Cotisation CNSS Employeur (MAD)",
  ];

  const rows = payslips.map((p) => {
    const employee = p.employee || {};
    const cappedBase = Math.min(p.grossSalary, payrollConfig.CNSS.MONTHLY_CEILING);

    return [
      company?.cnssNumber || "",
      run.month,
      run.year,
      employee.cnssNumber || "",
      employee.cin || "",
      employee.lastName || "",
      employee.firstName || "",
      employee.employeeNumber || "",
      26, // standard declared days/month convention — adjust per actual worked days if tracked
      p.grossSalary.toFixed(2),
      cappedBase.toFixed(2),
      p.cnssEmployee.toFixed(2),
      (p.employerCnss || 0).toFixed(2),
    ];
  });

  return toCsv(headers, rows);
}

function buildPayrollRegister(run, payslips, company) {
  const headers = [
    "Matricule", "Nom", "Prénom", "CIN", "N° CNSS", "Poste",
    "Salaire de Base", "Indemnités", "Salaire Brut",
    "CNSS", "AMO", "CIMR", "IR", "Autres Retenues", "Total Retenues",
    "Net à Payer", "Coût Employeur Total",
  ];

  const rows = payslips.map((p) => {
    const employee = p.employee || {};
    const allowanceTotal = (p.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);

    return [
      employee.employeeNumber || "",
      employee.lastName || "",
      employee.firstName || "",
      employee.cin || "",
      employee.cnssNumber || "",
      employee.jobTitle || "",
      p.baseSalary.toFixed(2),
      allowanceTotal.toFixed(2),
      p.grossSalary.toFixed(2),
      p.cnssEmployee.toFixed(2),
      p.amoEmployee.toFixed(2),
      (p.cimrEmployee || 0).toFixed(2),
      p.incomeTax.toFixed(2),
      (p.otherDeductionTotal || 0).toFixed(2),
      p.totalEmployeeDeductions.toFixed(2),
      p.netSalary.toFixed(2),
      (p.totalEmployerCost || 0).toFixed(2),
    ];
  });

  // Totals row.
  const sum = (key) => payslips.reduce((s, p) => s + (p[key] || 0), 0);
  rows.push([
    "", "", "", "", "", "TOTAUX",
    sum("baseSalary").toFixed(2),
    payslips.reduce((s, p) => s + (p.allowances || []).reduce((a, b) => a + (b.amount || 0), 0), 0).toFixed(2),
    sum("grossSalary").toFixed(2),
    sum("cnssEmployee").toFixed(2),
    sum("amoEmployee").toFixed(2),
    sum("cimrEmployee").toFixed(2),
    sum("incomeTax").toFixed(2),
    sum("otherDeductionTotal").toFixed(2),
    sum("totalEmployeeDeductions").toFixed(2),
    sum("netSalary").toFixed(2),
    sum("totalEmployerCost").toFixed(2),
  ]);

  return toCsv(headers, rows);
}

function buildBankTransferExport(run, payslips, company) {
  const headers = [
    "Nom du Donneur d'Ordre", "Mois/Année",
    "Matricule", "Nom et Prénom", "RIB", "IBAN", "Banque",
    "Montant Net (MAD)", "Référence",
  ];

  const rows = payslips
    .filter((p) => (p.employee?.paymentMethod || "bank_transfer") === "bank_transfer")
    .map((p) => {
      const employee = p.employee || {};
      return [
        company?.name || "",
        `${run.month}/${run.year}`,
        employee.employeeNumber || "",
        fullName(employee),
        employee.bank?.rib || "",
        employee.bank?.iban || "",
        employee.bank?.bankName || "",
        p.netSalary.toFixed(2),
        `PAIE-${run.month}${run.year}-${employee.employeeNumber || ""}`,
      ];
    });

  return toCsv(headers, rows);
}

module.exports = {
  buildCnssExport,
  buildPayrollRegister,
  buildBankTransferExport,
};
