const PDFDocument = require("pdfkit");

const { formatDate, buildDocumentRef, drawLetterhead, drawDocumentTitle, finalizeFooters } = require("./pdfHelpers");

/**
 * ============================================================
 * FICHE DE L'ENTREPRISE (company fact sheet)
 * ============================================================
 * A summary of the company's legal, contact and business identity —
 * the kind of document handed to a bank, a new partner, or filed
 * alongside an administrative dossier. Pulls together every
 * identity field already stored on the Company record into one
 * printable document instead of someone copying it out of the app
 * by hand field by field. Usually fits on one page; overflows to a
 * second automatically (pdfkit's default pagination) for a company
 * with every optional field filled in, including banking details.
 *
 * The company's logo image itself isn't embedded (it lives on
 * Cloudinary as a URL, and fetching it mid-request adds a network
 * dependency + failure mode to something that should always work);
 * everything else on the record is included as text.
 * ============================================================
 */

const EMPTY_VALUE = "—";

function line(text) {
  return text && String(text).trim() ? String(text).trim() : EMPTY_VALUE;
}

function drawSectionHeading(doc, text, { colX, width }) {
  doc.moveDown(0.9);
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text(text.toUpperCase(), colX, doc.y, { width });
  const ruleY = doc.y + 2;
  doc.moveTo(colX, ruleY).lineTo(colX + width, ruleY).lineWidth(0.75).stroke("#999");
  doc.moveDown(0.5);
}

/**
 * Draws a simple two-column grid of label/value pairs, wrapping to
 * a new row every `perRow` entries. `rows` is an array of
 * [label, value] pairs; falsy values render as "—".
 */
function drawFieldGrid(doc, rows, { colX, width, perRow = 2 }) {
  const colWidth = width / perRow;
  rows.forEach(([label, value], i) => {
    const col = i % perRow;
    if (col === 0 && i > 0) doc.moveDown(0.9);
    const x = colX + col * colWidth;
    const y = doc.y;
    doc.fontSize(7.5).font("Helvetica").fillColor("#777").text(label, x, y, { width: colWidth - 10 });
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#000").text(line(value), x, doc.y, { width: colWidth - 10 });
  });
  doc.moveDown(0.9);
}

function generateCompanyFiche({ company, activeEmployeeCount, logoBuffer }) {
  if (!company) throw new Error("company is required");

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { colX, width } = drawLetterhead(doc, company, { logoBuffer });
  const ref = buildDocumentRef("FICHE", company.shortName || company.ice);
  drawDocumentTitle(doc, "FICHE DE L'ENTREPRISE", { colX, width, ref });

  // ---------- Identity ----------
  drawSectionHeading(doc, "Identité", { colX, width });
  drawFieldGrid(doc, [
    ["Raison sociale", company.name],
    ["Nom commercial", company.tradeName],
    ["Forme juridique", company.legalForm === "other" ? company.legalFormOther : company.legalForm],
    ["Secteur d'activité", company.industry],
    ["Activité", company.businessActivity],
    ["Date d'immatriculation", company.registrationDate ? formatDate(company.registrationDate) : null],
  ], { colX, width });

  // ---------- Legal / registration numbers ----------
  drawSectionHeading(doc, "Identifiants légaux", { colX, width });
  drawFieldGrid(doc, [
    ["ICE", company.ice],
    ["Identifiant Fiscal (IF)", company.taxId],
    ["Registre de Commerce (RC)", company.registrationNumber],
    ["Ville RC", company.registrationCity],
    ["N° CNSS", company.cnssNumber],
    ["Taxe professionnelle", company.professionalTaxNumber],
  ], { colX, width });

  // ---------- Contact ----------
  drawSectionHeading(doc, "Coordonnées", { colX, width });
  const addressLine = [company.address?.street, company.address?.additionalLine]
    .filter(Boolean).join(", ") || null;
  const cityLine = [company.address?.postalCode, company.address?.city, company.address?.region]
    .filter(Boolean).join(" ") || null;
  drawFieldGrid(doc, [
    ["Adresse", addressLine],
    ["Ville / Région", cityLine],
    ["Téléphone", company.phone],
    ["Email", company.email],
    ["Site web", company.website],
    ["Pays", company.address?.country],
  ], { colX, width });

  // ---------- Banking ----------
  if (company.bank?.bankName || company.bank?.rib || company.bank?.iban) {
    drawSectionHeading(doc, "Coordonnées bancaires", { colX, width });
    drawFieldGrid(doc, [
      ["Banque", company.bank?.bankName],
      ["Titulaire du compte", company.bank?.accountName],
      ["RIB", company.bank?.rib],
      ["IBAN", company.bank?.iban],
    ], { colX, width });
  }

  // ---------- Headcount ----------
  drawSectionHeading(doc, "Effectif", { colX, width });
  drawFieldGrid(doc, [
    ["Nombre d'employés actifs", activeEmployeeCount ?? "—"],
    ["Taille de l'entreprise", company.size],
  ], { colX, width });

  finalizeFooters(doc, company);
  return doc;
}

module.exports = { generateCompanyFiche };
