const PDFDocument = require("pdfkit");
const payrollConfig = require("../config/payrollConfig");

/**
 * ============================================================
 * BULLETIN DE PAIE (PAYSLIP PDF)
 * ============================================================
 * Lays out a Moroccan payslip covering what Article 370 of the
 * Code du Travail requires to appear on a bulletin de paie:
 * employer identity (raison sociale, adresse, CNSS employer
 * number, ICE), employee identity (nom, CIN, CNSS number, poste,
 * ancienneté), the pay period, an itemized breakdown of gains
 * (base salary + each allowance) and retenues (each statutory
 * deduction shown WITH its rate, not just the amount — required,
 * not just good practice), the net to pay, and the payment method.
 *
 * `month`/`year`-to-date cumulative gross/net are also shown
 * (summed from every payslip issued to this employee so far this
 * calendar year) since real Moroccan bulletins conventionally
 * include running annual totals.
 * ============================================================
 */

function formatAmount(amount) {
  // Not using toLocaleString('fr-FR') directly: its thousands
  // separator is a non-breaking space (U+00A0), which pdfkit's
  // built-in Helvetica font can't render — it silently falls back
  // to a "/" glyph (e.g. "8 000" showed up as "8/000"). Formatting
  // manually with a plain space sidesteps that entirely.
  const value = Number(amount) || 0;
  const [intPart, decPart] = value.toFixed(2).split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces},${decPart}`;
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR");
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function seniorityLabel(hireDate, asOf) {
  if (!hireDate) return "—";
  const start = new Date(hireDate);
  const end = asOf ? new Date(asOf) : new Date();
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  months = Math.max(months, 0);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} mois`;
  return `${years} an${years > 1 ? "s" : ""}${remMonths ? `, ${remMonths} mois` : ""}`;
}

/**
 * @param {Object} params
 * @param {Object} params.payslip - Payslip document
 * @param {Object} params.employee - Employee document
 * @param {Object} params.company - Company document
 * @param {number} [params.ytdGross] - year-to-date gross before this payslip
 * @param {number} [params.ytdNet] - year-to-date net before this payslip
 * @param {Object} [params.leaveBalance] - { remainingDays } (optional)
 * @returns {PDFDocument} - caller pipes this to a response/file
 */
function generatePayslipPdf({ payslip, employee, company, ytdGross = 0, ytdNet = 0, leaveBalance }) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  const pageWidth = doc.page.width - 80;
  const colX = 40;

  // ---------- Header: company + document title ----------
  doc.fontSize(14).font("Helvetica-Bold").text(company?.name || "—", colX, 40);
  doc.fontSize(8).font("Helvetica").fillColor("#555");

  const addressParts = [
    company?.address?.street,
    company?.address?.city,
    company?.address?.region,
  ].filter(Boolean);
  if (addressParts.length) doc.text(addressParts.join(", "));

  const employerIds = [];
  if (company?.cnssNumber) employerIds.push(`CNSS Employeur: ${company.cnssNumber}`);
  if (company?.ice) employerIds.push(`ICE: ${company.ice}`);
  if (company?.taxId) employerIds.push(`IF: ${company.taxId}`);
  if (employerIds.length) doc.text(employerIds.join("   |   "));

  doc.fillColor("#000");
  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").text(
    `BULLETIN DE PAIE — ${MONTHS_FR[payslip.month - 1]} ${payslip.year}`,
    colX,
    doc.y,
    { align: "center", width: pageWidth }
  );
  doc.moveDown(0.8);

  // ---------- Employee identity block ----------
  const empName = `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim();
  const boxTop = doc.y;
  doc.rect(colX, boxTop, pageWidth, 78).stroke("#ccc");

  doc.fontSize(9).font("Helvetica-Bold").text("Salarié(e)", colX + 8, boxTop + 6);
  doc.font("Helvetica").fontSize(8);
  doc.text(`Nom et prénom: ${empName}`, colX + 8, boxTop + 20);
  doc.text(`Matricule: ${employee?.employeeNumber || "—"}`, colX + 8, boxTop + 32);
  doc.text(`CIN: ${employee?.cin || "—"}`, colX + 8, boxTop + 44);
  doc.text(`N° CNSS: ${employee?.cnssNumber || "—"}`, colX + 8, boxTop + 56);

  const rightColX = colX + pageWidth / 2 + 8;
  doc.text(`Poste: ${employee?.jobTitle || "—"}`, rightColX, boxTop + 20);
  doc.text(`Date d'embauche: ${formatDate(employee?.hireDate)}`, rightColX, boxTop + 32);
  doc.text(`Ancienneté: ${seniorityLabel(employee?.hireDate)}`, rightColX, boxTop + 44);
  doc.text(`Département: ${employee?.department || "—"}`, rightColX, boxTop + 56);

  doc.y = boxTop + 86;

  // ---------- Earnings table ----------
  doc.fontSize(9).font("Helvetica-Bold").text("GAINS", colX, doc.y);
  doc.moveDown(0.3);

  const tableLeft = colX;
  const labelColW = pageWidth * 0.55;
  const baseColW = pageWidth * 0.25;
  const amountColW = pageWidth * 0.2;

  function tableRow(label, base, amount, opts = {}) {
    const y = doc.y;
    doc.fontSize(8).font(opts.bold ? "Helvetica-Bold" : "Helvetica");

    // Measure how tall the tallest cell will be (labels or the
    // "base/rate" column can wrap to 2 lines) and advance by THAT,
    // rather than a fixed amount — a fixed advance previously let
    // a wrapped line spill into and overlap the row below it.
    const labelHeight = doc.heightOfString(label, { width: labelColW });
    const baseHeight = base ? doc.heightOfString(base, { width: baseColW }) : 0;
    const rowHeight = Math.max(labelHeight, baseHeight, 10);

    doc.text(label, tableLeft, y, { width: labelColW });
    doc.text(base || "", tableLeft + labelColW, y, { width: baseColW, align: "right" });
    doc.text(amount, tableLeft + labelColW + baseColW, y, { width: amountColW, align: "right" });
    doc.y = y + rowHeight + 4;
  }

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#555");
  tableRow("Rubrique", "Taux / Base", "Montant (MAD)", { bold: true });
  doc.fillColor("#000");
  doc.moveTo(tableLeft, doc.y).lineTo(tableLeft + pageWidth, doc.y).stroke("#ccc");
  doc.moveDown(0.2);

  tableRow("Salaire de base", "", formatAmount(payslip.baseSalary));
  for (const item of payslip.allowances || []) {
    tableRow(item.label, "", formatAmount(item.amount));
  }
  if (payslip.overtimeAmount > 0) {
    tableRow("Heures supplémentaires", "", formatAmount(payslip.overtimeAmount));
  }
  if (payslip.unpaidDeduction > 0) {
    tableRow("Absences non payées", "", `-${formatAmount(payslip.unpaidDeduction)}`);
  }

  doc.moveTo(tableLeft, doc.y).lineTo(tableLeft + pageWidth, doc.y).stroke("#ccc");
  doc.moveDown(0.2);
  tableRow("SALAIRE BRUT", "", formatAmount(payslip.grossSalary), { bold: true });

  doc.moveDown(0.6);

  // ---------- Deductions table ----------
  doc.fontSize(9).font("Helvetica-Bold").text("RETENUES", colX, doc.y);
  doc.moveDown(0.3);

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#555");
  tableRow("Rubrique", "Taux / Base", "Montant (MAD)", { bold: true });
  doc.fillColor("#000");
  doc.moveTo(tableLeft, doc.y).lineTo(tableLeft + pageWidth, doc.y).stroke("#ccc");
  doc.moveDown(0.2);

  const cnssBase = Math.min(payslip.grossSalary, payrollConfig.CNSS.MONTHLY_CEILING);
  tableRow(
    "CNSS",
    `${(payrollConfig.CNSS.EMPLOYEE_RATE * 100).toFixed(2)}% × ${formatAmount(cnssBase)}`,
    formatAmount(payslip.cnssEmployee)
  );
  tableRow(
    "AMO",
    `${(payrollConfig.AMO.EMPLOYEE_RATE * 100).toFixed(2)}% × ${formatAmount(payslip.grossSalary)}`,
    formatAmount(payslip.amoEmployee)
  );
  if (payslip.cimrEmployee > 0) {
    tableRow("CIMR", "", formatAmount(payslip.cimrEmployee));
  }
  tableRow(
    "Frais professionnels (déduits avant IR)",
    `${(payrollConfig.PROFESSIONAL_EXPENSES.RATE * 100).toFixed(0)}%, plafond ${formatAmount(payrollConfig.PROFESSIONAL_EXPENSES.MONTHLY_CAP)}`,
    formatAmount(payslip.professionalExpenses)
  );
  tableRow(
    "IR (Impôt sur le Revenu)",
    payslip.familyDeduction > 0
      ? `dont réduction charges de famille: -${formatAmount(payslip.familyDeduction)}`
      : "",
    formatAmount(payslip.incomeTax)
  );
  for (const item of payslip.otherDeductions || []) {
    tableRow(item.label, "", formatAmount(item.amount));
  }

  doc.moveTo(tableLeft, doc.y).lineTo(tableLeft + pageWidth, doc.y).stroke("#ccc");
  doc.moveDown(0.2);
  tableRow("TOTAL RETENUES", "", formatAmount(payslip.totalEmployeeDeductions), { bold: true });

  doc.moveDown(0.6);

  // ---------- Net to pay (highlighted) ----------
  const netBoxTop = doc.y;
  doc.rect(colX, netBoxTop, pageWidth, 32).fill("#f0f0f0");
  doc.fillColor("#000").fontSize(11).font("Helvetica-Bold");
  doc.text("NET À PAYER", colX + 10, netBoxTop + 9);
  doc.fontSize(13).text(`${formatAmount(payslip.netSalary)} MAD`, colX, netBoxTop + 8, {
    width: pageWidth - 10,
    align: "right",
  });
  doc.y = netBoxTop + 40;

  // ---------- Payment method + cumulative + leave balance ----------
  doc.fontSize(8).font("Helvetica");
  const paymentLabels = {
    bank_transfer: "Virement bancaire",
    cash: "Espèces",
    check: "Chèque",
  };
  const paymentMethod = paymentLabels[employee?.paymentMethod] || "—";
  const ribOrIban = employee?.bank?.rib || employee?.bank?.iban || "";

  doc.text(
    `Mode de paiement: ${paymentMethod}${ribOrIban ? `  —  RIB/IBAN: ${ribOrIban}` : ""}`,
    colX,
    doc.y
  );
  doc.moveDown(0.4);

  doc.text(
    `Cumul annuel ${payslip.year} (avant ce bulletin) — Brut: ${formatAmount(ytdGross)} MAD   Net: ${formatAmount(ytdNet)} MAD`,
    colX,
    doc.y
  );

  if (leaveBalance) {
    doc.moveDown(0.4);
    doc.text(
      `Solde de congés payés: ${leaveBalance.remainingDays} jour(s)`,
      colX,
      doc.y
    );
  }

  doc.moveDown(1);
  doc.fontSize(7).fillColor("#888").text(
    "Document généré automatiquement. Les taux de cotisations appliqués sont ceux configurés dans le système à la date de génération de la paie — à vérifier périodiquement auprès de la CNSS/DGI.",
    colX,
    doc.y,
    { width: pageWidth }
  );

  return doc;
}

/**
 * Sums every payslip issued to this employee so far in `year`,
 * PRIOR to `beforeMonth` — used for the "cumul annuel avant ce
 * bulletin" line on the payslip PDF.
 */
async function computeYtdTotals(Payslip, employeeId, year, beforeMonth) {
  const priorPayslips = await Payslip.find({
    employee: employeeId,
    year,
    month: { $lt: beforeMonth },
  }).select("grossSalary netSalary");

  return priorPayslips.reduce(
    (acc, p) => ({
      gross: acc.gross + (p.grossSalary || 0),
      net: acc.net + (p.netSalary || 0),
    }),
    { gross: 0, net: 0 }
  );
}

module.exports = { generatePayslipPdf, computeYtdTotals };
