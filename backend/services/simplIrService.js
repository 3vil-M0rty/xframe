const ExcelJS = require("exceljs");

/**
 * ============================================================
 * SIMPL-IR — income tax withheld on salaries (DGI)
 * ============================================================
 * Two things the employer files on the DGI's Simpl-IR portal:
 *
 * 1. MONTHLY payment (versement): the IR withheld on month M's
 *    salaries, paid before the end of month M+1 (CGI art. 174).
 *    monthlySummary() gives the amount and the details behind it.
 *
 * 2. ANNUAL declaration of salaries (état 9421, CGI art. 79), filed
 *    before 1 March of the following year: one line per employee
 *    with gross pay, deductions, net taxable income and IR withheld.
 *    buildAnnualDeclaration() computes it from the year's COMPLETED
 *    payroll runs; buildAnnualXml() writes the EDI file uploaded on
 *    Simpl-IR, buildAnnualXlsx() the same as a spreadsheet.
 *
 * ⚠️ The XML follows the DGI EDI "traitements et salaires" structure
 * (element names from the DGI cahier des charges). I could not
 * retrieve the official XSD to check it element by element: download
 * it from the Simpl-IR space and compare before the first filing —
 * all element names are in ANNUAL_XML below, in one place.
 * ============================================================
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (rows, k) => round2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));

function deadlineFor(month, year) {
  // last day of the month after the pay month
  return new Date(year, month + 1, 0);
}

/** Month M: what to pay on Simpl-IR, and the details. */
function monthlySummary({ run, payslips }) {
  const rows = payslips.map((p) => ({
    employeeId: p.employee?._id,
    name: `${p.employee?.lastName || ""} ${p.employee?.firstName || ""}`.trim(),
    cin: p.employee?.cin || "",
    gross: round2(p.grossSalary),
    taxable: round2(p.monthlyTaxableIncome),
    incomeTax: round2(p.incomeTax),
  }));
  return {
    month: run.month,
    year: run.year,
    employees: rows.length,
    taxedEmployees: rows.filter((r) => r.incomeTax > 0).length,
    totalGross: sum(rows, "gross"),
    totalTaxable: sum(rows, "taxable"),
    totalIncomeTax: sum(rows, "incomeTax"),
    deadline: deadlineFor(run.month, run.year),
    runCompleted: run.status === "completed",
    rows,
  };
}

const FAMILY_CODES = { single: "C", married: "M", divorced: "D", widowed: "V" };

/**
 * @param {Object} p
 * @param {Object} p.company
 * @param {number} p.year
 * @param {Array}  p.payslips - the year's payslips from COMPLETED runs, employee populated
 * @param {Array}  [p.monthsCompleted] - month numbers with a completed run
 */
function buildAnnualDeclaration({ company, year, payslips, monthsCompleted = [] }) {
  const byEmployee = new Map();
  for (const p of payslips) {
    const id = String(p.employee?._id || p.employee);
    if (!byEmployee.has(id)) byEmployee.set(id, { employee: p.employee || {}, slips: [] });
    byEmployee.get(id).slips.push(p);
  }

  const problems = [];
  const warnings = [];
  if (!company?.taxId) problems.push({ code: "company_if", message: "The company's tax identifier (IF) is missing (Organisation → Company)." });
  if (!company?.ice) warnings.push({ code: "company_ice", message: "The company's ICE is missing." });
  const missingMonths = [];
  for (let m = 1; m <= 12; m += 1) if (!monthsCompleted.includes(m)) missingMonths.push(m);
  if (missingMonths.length) {
    warnings.push({ code: "missing_months", message: `No completed payroll for month(s) ${missingMonths.join(", ")} of ${year}: the declaration only covers completed payroll runs.` });
  }

  const employees = [...byEmployee.values()].map(({ employee: e, slips }) => {
    const name = `${e.lastName || ""} ${e.firstName || ""}`.trim();
    if (!e.cin) warnings.push({ code: "missing_cin", employeeId: e._id, message: `${name}: no CIN on file.` });
    const contributions = slips.reduce((s, p) => s + (p.cnssEmployee || 0) + (p.amoEmployee || 0) + (p.cimrEmployee || 0), 0);
    const days = slips.reduce((s, p) => s + (Number.isFinite(p.declaredDays) ? p.declaredDays : 26), 0);
    return {
      employeeId: e._id,
      lastName: e.lastName || "",
      firstName: e.firstName || "",
      address: [e.address?.street, e.address?.city].filter(Boolean).join(", "),
      cin: (e.cin || "").toUpperCase(),
      cnssNumber: e.cnssNumber || "",
      taxId: e.taxIdentificationNumber || "",
      hireDate: e.hireDate || null,
      familyStatus: FAMILY_CODES[e.maritalStatus] || "C",
      dependents: Math.min(e.numberOfDependents || 0, 6),
      months: slips.length,
      days,
      baseSalary: round2(slips.reduce((s, p) => s + (p.baseSalary || 0), 0)),
      gross: round2(slips.reduce((s, p) => s + (p.grossSalary || 0), 0)),
      exempt: 0,
      grossTaxable: round2(slips.reduce((s, p) => s + (p.grossSalary || 0), 0)),
      professionalExpenses: round2(slips.reduce((s, p) => s + (p.professionalExpenses || 0), 0)),
      contributions: round2(contributions),
      otherDeductions: 0,
      netTaxable: round2(slips.reduce((s, p) => s + (p.monthlyTaxableIncome || 0), 0)),
      incomeTax: round2(slips.reduce((s, p) => s + (p.incomeTax || 0), 0)),
    };
  }).sort((a, b) => a.lastName.localeCompare(b.lastName));

  for (const e of employees) e.totalDeductions = round2(e.professionalExpenses + e.contributions + e.otherDeductions);

  return {
    year,
    company: {
      name: company?.name || "",
      taxId: company?.taxId || "",
      ice: company?.ice || "",
      rc: company?.registrationNumber || "",
      cnssNumber: company?.cnssNumber || "",
      professionalTaxNumber: company?.professionalTaxNumber || "",
      address: [company?.address?.street, company?.address?.city].filter(Boolean).join(", "),
      phone: company?.phone || "",
      email: company?.email || "",
    },
    employees,
    totals: {
      employees: employees.length,
      gross: sum(employees, "gross"),
      grossTaxable: sum(employees, "grossTaxable"),
      netTaxable: sum(employees, "netTaxable"),
      totalDeductions: sum(employees, "totalDeductions"),
      incomeTax: sum(employees, "incomeTax"),
    },
    deadline: new Date(year + 1, 2, 1), // before 1 March
    problems,
    warnings,
    ready: problems.length === 0 && employees.length > 0,
  };
}

function xmlEscape(v) {
  return String(v ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}
const amt = (n) => round2(n).toFixed(2);
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function el(name, value, indent) {
  return `${indent}<${name}>${xmlEscape(value)}</${name}>`;
}

/** EDI XML for the annual declaration (état 9421). */
function buildAnnualXml(decl) {
  if (!decl.ready) throw Object.assign(new Error("The declaration has unresolved problems"), { status: 400, problems: decl.problems });
  const c = decl.company;
  const i1 = "  ";
  const i3 = "      ";
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<TraitementEtSalaire>"];
  lines.push(
    el("identifiantFiscal", c.taxId, i1),
    el("nom", "", i1),
    el("prenom", "", i1),
    el("raisonSociale", c.name, i1),
    el("exerciceFiscalDu", `${decl.year}-01-01`, i1),
    el("exerciceFiscalAu", `${decl.year}-12-31`, i1),
    el("annee", decl.year, i1),
    el("adresse", c.address, i1),
    el("numeroCNSS", c.cnssNumber, i1),
    el("numeroRC", c.rc, i1),
    el("identifiantTP", c.professionalTaxNumber, i1),
    el("numeroTelephone", c.phone, i1),
    el("email", c.email, i1),
    el("effectifTotal", decl.totals.employees, i1),
    el("nbrPersoPermanent", decl.totals.employees, i1),
    el("nbrPersoOccasionnel", 0, i1),
    el("nbrStagiaires", 0, i1),
    el("totalMtRevenuBrutImposablePP", amt(decl.totals.grossTaxable), i1),
    el("totalMtRevenuNetImposablePP", amt(decl.totals.netTaxable), i1),
    el("totalMtTotalDeductionPP", amt(decl.totals.totalDeductions), i1),
    el("totalMtIrPrelevePP", amt(decl.totals.incomeTax), i1),
    `${i1}<listPersonnelPermanent>`
  );
  for (const e of decl.employees) {
    lines.push(
      "    <PersonnelPermanent>",
      el("nom", e.lastName, i3),
      el("prenom", e.firstName, i3),
      el("adressePersonnelle", e.address, i3),
      el("numCNI", e.cin, i3),
      el("numCNSS", e.cnssNumber, i3),
      el("ifu", e.taxId, i3),
      el("salaireBaseAnnuel", amt(e.baseSalary), i3),
      el("mtBrutTraitementSalaire", amt(e.gross), i3),
      el("periode", e.days, i3),
      el("mtExonere", amt(e.exempt), i3),
      el("mtEcheances", amt(0), i3),
      el("nbrReductions", e.dependents, i3),
      el("mtIndemnite", amt(0), i3),
      el("mtAvantages", amt(0), i3),
      el("mtRevenuBrutImposable", amt(e.grossTaxable), i3),
      el("mtFraisProfess", amt(e.professionalExpenses), i3),
      el("mtCotisationAssur", amt(e.contributions), i3),
      el("mtAutresRetenues", amt(e.otherDeductions), i3),
      el("mtRevenuNetImposable", amt(e.netTaxable), i3),
      el("mtTotalDeduction", amt(e.totalDeductions), i3),
      el("irPreleve", amt(e.incomeTax), i3),
      el("casSportif", "false", i3),
      el("dateRecrutement", isoDate(e.hireDate), i3),
      `${i3}<situationFamilliale><code>${e.familyStatus}</code></situationFamilliale>`,
      "    </PersonnelPermanent>"
    );
  }
  lines.push(`${i1}</listPersonnelPermanent>`, "</TraitementEtSalaire>");
  return lines.join("\n") + "\n";
}

async function buildAnnualXlsx(decl) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Etat 9421 - ${decl.year}`);
  ws.addRow([`Déclaration des traitements et salaires ${decl.year} — ${decl.company.name}`]).font = { bold: true, size: 13 };
  ws.addRow(["IF", decl.company.taxId, "ICE", decl.company.ice, "CNSS", decl.company.cnssNumber]);
  ws.addRow([]);
  const cols = [
    ["Nom", "lastName", 18], ["Prénom", "firstName", 16], ["CIN", "cin", 12], ["N° CNSS", "cnssNumber", 12],
    ["Sit. fam.", "familyStatus", 9], ["Pers. à charge", "dependents", 12], ["Jours", "days", 8],
    ["Brut", "gross", 14], ["Brut imposable", "grossTaxable", 15], ["Frais prof.", "professionalExpenses", 13],
    ["Cotisations", "contributions", 13], ["Net imposable", "netTaxable", 15], ["IR retenu", "incomeTax", 13],
  ];
  ws.addRow(cols.map((c) => c[0])).font = { bold: true };
  decl.employees.forEach((e) => ws.addRow(cols.map((c) => e[c[1]])));
  const t = decl.totals;
  ws.addRow(["TOTAL", "", "", "", "", "", "", t.gross, t.grossTaxable, "", "", t.netTaxable, t.incomeTax]).font = { bold: true };
  cols.forEach((c, i) => {
    ws.getColumn(i + 1).width = c[2];
    if (i >= 7) ws.getColumn(i + 1).numFmt = "#,##0.00";
  });
  return wb.xlsx.writeBuffer();
}

module.exports = { monthlySummary, buildAnnualDeclaration, buildAnnualXml, buildAnnualXlsx, deadlineFor };
