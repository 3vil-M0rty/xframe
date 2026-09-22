const PDFDocument = require("pdfkit");

const {
  formatDate,
  formatAmount,
  seniorityLabel,
  employeeFullName,
  buildDocumentRef,
  drawLetterhead,
  drawDocumentTitle,
  drawSignatureBlock,
  finalizeFooters,
} = require("./pdfHelpers");

/**
 * ============================================================
 * EMPLOYEE DOCUMENTS (attestations & certificats)
 * ============================================================
 * Three of the documents Moroccan employees most commonly need
 * from HR:
 *
 *   - Attestation de travail: a simple, current-employment
 *     certificate ("this person currently works here, since X, as
 *     Y") — the one most often asked for banks, visas, housing,
 *     school enrollment, etc. No legal minimum content is mandated;
 *     this covers what's conventionally expected.
 *
 *   - Attestation de salaire: same, plus the current salary — for
 *     loan applications, visas, and anywhere income needs proving.
 *
 *   - Certificat de travail: the END-OF-EMPLOYMENT document, and
 *     the one Moroccan labour law DOES mandate — Article 72 of the
 *     Code du Travail requires the employer to hand this over when
 *     a contract ends, stating only the dates the employee worked
 *     and the position(s) they held (deliberately no appraisal of
 *     their work, positive or negative — the law is specific that
 *     this document is neutral).
 *
 * Each function takes an optional `logoBuffer` (see
 * pdfHelpers.fetchLogoBuffer — the caller fetches it once and passes
 * it in, so the generator itself stays a plain synchronous function)
 * and returns a finished PDFDocument (footers already stamped on
 * every page); the caller pipes it to a response exactly like
 * generatePayslipPdf does.
 * ============================================================
 */

function guardEmployeeAndCompany(employee, company) {
  if (!employee) throw new Error("employee is required");
  if (!company) throw new Error("company is required");
}

function legalRepLine(company) {
  const legalRep = company?.owner && `${company.owner.firstName || ""} ${company.owner.lastName || ""}`.trim();
  return legalRep
    ? `Je soussigné(e), ${legalRep}, représentant légal de la société ${company?.name || "—"}`
    : `La société ${company?.name || "—"}`;
}

function drawIntroParagraph(doc, { colX, width, text }) {
  doc.fontSize(10.5).font("Helvetica").fillColor("#000");
  doc.text(text, colX, doc.y, { width, align: "justify", lineGap: 5 });
}

function generateAttestationTravail({ employee, company, logoBuffer }) {
  guardEmployeeAndCompany(employee, company);
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

  const { colX, width } = drawLetterhead(doc, company, { logoBuffer });
  const ref = buildDocumentRef("ATT", employee?.employeeNumber);
  drawDocumentTitle(doc, "ATTESTATION DE TRAVAIL", { colX, width, ref });

  const text =
    `${legalRepLine(company)}, atteste par la présente que ` +
    `${employeeFullName(employee)}, titulaire de la CIN n° ${employee?.cin || "—"}, ` +
    `est employé(e) au sein de notre société depuis le ${formatDate(employee?.hireDate)} ` +
    `(soit une ancienneté de ${seniorityLabel(employee?.hireDate)}), ` +
    `en qualité de ${employee?.jobTitle || employee?.position || "—"}` +
    (employee?.department?.name ? `, au sein du département ${employee.department.name}` : "") +
    `.\n\nCette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`;

  drawIntroParagraph(doc, { colX, width, text });
  drawSignatureBlock(doc, { city: company?.address?.city, companyName: company?.name, colX, width });

  finalizeFooters(doc, company);
  return doc;
}

function generateAttestationSalaire({ employee, company, salary, logoBuffer }) {
  guardEmployeeAndCompany(employee, company);
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

  const { colX, width } = drawLetterhead(doc, company, { logoBuffer });
  const ref = buildDocumentRef("ATS", employee?.employeeNumber);
  drawDocumentTitle(doc, "ATTESTATION DE TRAVAIL ET DE SALAIRE", { colX, width, ref });

  const currency = salary?.currency || company?.currency || "MAD";
  const grossLine = salary
    ? `un salaire mensuel brut de ${formatAmount(salary.grossSalary ?? salary.baseSalary)} ${currency}`
    : "un salaire non communiqué à ce jour";

  const text =
    `${legalRepLine(company)}, atteste par la présente que ` +
    `${employeeFullName(employee)}, titulaire de la CIN n° ${employee?.cin || "—"}` +
    (employee?.cnssNumber ? ` et immatriculé(e) à la CNSS sous le n° ${employee.cnssNumber}` : "") +
    `, est employé(e) au sein de notre société depuis le ${formatDate(employee?.hireDate)} ` +
    `en qualité de ${employee?.jobTitle || employee?.position || "—"}, et perçoit à ce titre ${grossLine}.` +
    `\n\nCette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`;

  drawIntroParagraph(doc, { colX, width, text });
  drawSignatureBlock(doc, { city: company?.address?.city, companyName: company?.name, colX, width });

  finalizeFooters(doc, company);
  return doc;
}

function generateCertificatTravail({ employee, company, logoBuffer }) {
  guardEmployeeAndCompany(employee, company);
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

  const { colX, width } = drawLetterhead(doc, company, { logoBuffer });
  const ref = buildDocumentRef("CT", employee?.employeeNumber);
  drawDocumentTitle(doc, "CERTIFICAT DE TRAVAIL", { colX, width, ref });

  const endDate = employee?.terminationDate ? formatDate(employee.terminationDate) : "ce jour";

  // Deliberately neutral, per Article 72 of the Code du Travail: only
  // the dates worked and the position(s) held — no appraisal of the
  // employee's work.
  const text =
    `${legalRepLine(company)}, certifie que ` +
    `${employeeFullName(employee)}, titulaire de la CIN n° ${employee?.cin || "—"}, ` +
    `a travaillé au sein de notre société du ${formatDate(employee?.hireDate)} au ${endDate}, ` +
    `en qualité de ${employee?.jobTitle || employee?.position || "—"}.` +
    `\n\nCe certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit, ` +
    `conformément à l'article 72 du Code du Travail.`;

  drawIntroParagraph(doc, { colX, width, text });
  drawSignatureBlock(doc, { city: company?.address?.city, companyName: company?.name, colX, width });

  finalizeFooters(doc, company);
  return doc;
}

module.exports = {
  generateAttestationTravail,
  generateAttestationSalaire,
  generateCertificatTravail,
};
