/**
 * ============================================================
 * SHARED PDF HELPERS
 * ============================================================
 * Small formatting/layout helpers reused across every PDF this
 * backend generates with pdfkit. Kept separate from
 * payslipPdfService.js (which has its own working copies of some of
 * these) so new generators — employee attestations, the company
 * fiche — don't duplicate this logic themselves, without touching
 * the payslip generator's already-working code.
 * ============================================================
 */

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR");
}

function formatDateLong(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatAmount(amount) {
  // Not using toLocaleString('fr-FR') directly: its thousands
  // separator is a non-breaking space (U+00A0), which pdfkit's
  // built-in Helvetica font can't render — falls back to a "/"
  // glyph. Formatting manually with a plain space avoids that.
  const value = Number(amount) || 0;
  const [intPart, decPart] = value.toFixed(2).split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces},${decPart}`;
}

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

function employeeFullName(employee) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "—";
}

/**
 * Builds a short, official-looking reference like "ATT/2026/EMP-0042"
 * for the top of an attestation/certificate — purely cosmetic (not
 * stored anywhere or guaranteed unique), but it's what makes a
 * generated document read as an official one rather than a form
 * letter, matching real French/Moroccan administrative documents.
 */
function buildDocumentRef(prefix, identifier) {
  const year = new Date().getFullYear();
  return `${prefix}/${year}/${identifier || "—"}`;
}

/**
 * Fetches the company's logo as a PNG buffer, ready for
 * doc.image(). Returns null on any failure — no logo set, network
 * error, timeout — so a document ALWAYS generates successfully even
 * if the logo can't be fetched; the letterhead just falls back to
 * text-only.
 *
 * pdfkit's doc.image() only understands JPEG and PNG, but the logo
 * upload form accepts PNG/JPEG/WEBP/GIF (see Company.jsx), so a
 * WEBP or GIF logo would otherwise silently fail to embed. Cloudinary
 * (where logos are stored) can transcode on the fly via a URL
 * transformation segment, so the fetch always requests PNG
 * regardless of the original upload format instead of trying to
 * detect and branch on it here.
 */
async function fetchLogoBuffer(company) {
  const url = company?.logo?.url;
  if (!url || typeof url !== "string") return null;

  const pngUrl = url.includes("/upload/")
    ? url.replace("/upload/", "/upload/f_png/")
    : url;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(pngUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn("[pdfHelpers] Failed to fetch company logo, generating document without it:", error.message);
    return null;
  }
}

/**
 * Draws the standard company letterhead (logo, name, address, legal
 * IDs) at the top of the page, with a branded accent rule under it —
 * the same block every outgoing document (payslip, attestation,
 * certificate, fiche) opens with, so a document handed to a bank or
 * an embassy is immediately identifiable as coming from this
 * company. `logoBuffer` is optional (see fetchLogoBuffer) — the
 * letterhead still looks complete without one.
 *
 * Returns the y position right below the letterhead, so the caller
 * knows where to start drawing the rest of the page.
 */
function drawLetterhead(doc, company, { colX = 40, pageWidth, logoBuffer } = {}) {
  const width = pageWidth ?? doc.page.width - colX * 2;
  const accentColor = company?.branding?.primaryColor || "#1a1a1a";

  // Logo, top-right — sized to fit within a fixed box so a very
  // wide or very tall source image never throws off the layout.
  const LOGO_BOX = { width: 90, height: 48 };
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, colX + width - LOGO_BOX.width, 40, {
        fit: [LOGO_BOX.width, LOGO_BOX.height],
        align: "right",
      });
    } catch (error) {
      // A corrupt/unsupported buffer slipping through fetchLogoBuffer's
      // own checks shouldn't take the whole document down with it.
      console.warn("[pdfHelpers] Failed to embed company logo:", error.message);
    }
  }

  const textWidth = logoBuffer ? width - LOGO_BOX.width - 12 : width;

  doc.fontSize(15).font("Helvetica-Bold").fillColor("#000").text(company?.name || "—", colX, 40, { width: textWidth });
  doc.fontSize(8).font("Helvetica").fillColor("#555");

  const addressParts = [
    company?.address?.street,
    company?.address?.city,
    company?.address?.region,
  ].filter(Boolean);
  if (addressParts.length) doc.text(addressParts.join(", "), colX, doc.y, { width: textWidth });

  const legalIds = [];
  if (company?.legalForm) legalIds.push(company.legalForm);
  if (company?.ice) legalIds.push(`ICE: ${company.ice}`);
  if (company?.taxId) legalIds.push(`IF: ${company.taxId}`);
  if (company?.registrationNumber) legalIds.push(`RC: ${company.registrationNumber}`);
  if (company?.cnssNumber) legalIds.push(`CNSS: ${company.cnssNumber}`);
  if (legalIds.length) doc.text(legalIds.join("   |   "), colX, doc.y, { width: textWidth });

  doc.fillColor("#000");

  // Push past the logo box too, in case the logo is taller than the
  // text block (a near-square logo, a short company name).
  const afterTextY = doc.y;
  const afterLogoY = logoBuffer ? 40 + LOGO_BOX.height : 0;
  doc.y = Math.max(afterTextY, afterLogoY) + 8;

  // Branded accent rule — the one visual element that makes each
  // company's documents feel distinctly theirs rather than a
  // generic template.
  doc.moveTo(colX, doc.y).lineTo(colX + width, doc.y).lineWidth(2).stroke(accentColor);
  doc.moveDown(0.6);

  return { y: doc.y, width, colX, accentColor };
}

/**
 * Draws a centered document title below the letterhead (e.g.
 * "ATTESTATION DE TRAVAIL"), with an optional reference line
 * (see buildDocumentRef) right above it, official-document style.
 */
function drawDocumentTitle(doc, title, { colX = 40, width, ref } = {}) {
  const pageWidth = width ?? doc.page.width - colX * 2;

  if (ref) {
    doc.moveDown(0.3);
    doc.fontSize(8).font("Helvetica").fillColor("#888").text(`Réf: ${ref}`, colX, doc.y, { width: pageWidth, align: "right" });
  }

  doc.moveDown(0.6);
  doc.fontSize(15).font("Helvetica-Bold").fillColor("#000").text(title, colX, doc.y, { align: "center", width: pageWidth });
  doc.moveDown(0.3);
  const ruleY = doc.y;
  doc.moveTo(colX + pageWidth / 2 - 70, ruleY).lineTo(colX + pageWidth / 2 + 70, ruleY).lineWidth(1.5).stroke("#000");
  doc.moveDown(1.3);
}

/**
 * Draws the standard "Fait à <city>, le <date>" + signature line
 * block used at the bottom of every attestation/certificate.
 */
function drawSignatureBlock(doc, { city, companyName, colX = 40, width } = {}) {
  const pageWidth = width ?? doc.page.width - colX * 2;
  doc.moveDown(2.5);
  const dateLine = city
    ? `Fait à ${city}, le ${formatDateLong(new Date())}`
    : `Le ${formatDateLong(new Date())}`;
  doc.fontSize(9).font("Helvetica").fillColor("#000").text(dateLine, colX, doc.y, { align: "right", width: pageWidth });
  doc.moveDown(1.6);
  doc.fontSize(9).font("Helvetica-Bold").text(
    companyName ? `Pour ${companyName}` : "Signature et cachet de l'entreprise",
    colX, doc.y, { align: "right", width: pageWidth }
  );
  if (companyName) {
    doc.moveDown(0.2);
    doc.fontSize(8).font("Helvetica").fillColor("#888").text("Signature et cachet", colX, doc.y, { align: "right", width: pageWidth });
  }
}

/**
 * Stamps a footer (company name, generation date, page number) on
 * EVERY page of the document, including ones already drawn — must
 * be called once, right before doc.end(), on a document created
 * with `new PDFDocument({ ..., bufferPages: true })`. That option is
 * what makes doc.bufferedPageRange()/switchToPage() available: pdfkit
 * normally streams pages out as soon as they're finished, so without
 * it there'd be no way to go back and add a footer to a page pdfkit
 * has already flushed.
 */
function finalizeFooters(doc, company) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  const colX = 40;
  const width = doc.page.width - colX * 2;

  for (let i = 0; i < total; i += 1) {
    doc.switchToPage(range.start + i);

    // Draw right at the bottom edge, inside the page's normal
    // bottom margin. pdfkit's text() auto-paginates when the
    // requested y + text height would cross page.height minus the
    // current bottom margin — which this deliberately does, since
    // the footer belongs in that margin area. Zeroing the margin
    // for the duration of this one call stops it from silently
    // inserting a blank extra page.
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const bottomY = doc.page.height - 32;
    doc.fontSize(7).font("Helvetica").fillColor("#999").text(
      `${company?.name || ""}   •   Document généré le ${formatDate(new Date())}` + (total > 1 ? `   •   Page ${i + 1}/${total}` : ""),
      colX,
      bottomY,
      { width, align: "center", lineBreak: false }
    );

    doc.page.margins.bottom = originalBottomMargin;
  }
}

module.exports = {
  formatDate,
  formatDateLong,
  formatAmount,
  seniorityLabel,
  employeeFullName,
  buildDocumentRef,
  fetchLogoBuffer,
  drawLetterhead,
  drawDocumentTitle,
  drawSignatureBlock,
  finalizeFooters,
};
