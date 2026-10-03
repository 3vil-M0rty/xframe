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

// ============================================================
// COMPANY BRAND (colors + date format) — set by drawLetterhead
// ============================================================
// Every document opens with drawLetterhead(doc, company), so that is
// where the company's branding is resolved once:
//  - doc._brand  → read by the drawing helpers (titles, table
//    headers, totals, signature boxes) through docBrand(doc);
//  - an AsyncLocalStorage store → read by formatDate(), which is
//    called from dozens of places that only have a date in hand.
//    enterWith() scopes it to the current request's async context,
//    so two companies printing at the same time never mix formats.
const { AsyncLocalStorage } = require("async_hooks");
const brandStore = new AsyncLocalStorage();

const DEFAULT_INK = "#1a1a1a";
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(value, fallback) {
  const m = HEX.exec(String(value || "").trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h.toLowerCase()}`;
}

function rgb(hex) {
  const h = normalizeHex(hex, DEFAULT_INK).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// WCAG relative luminance (0 = black, 1 = white)
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Black or white, whichever reads better on `background`. */
function textOn(background) {
  return contrast(background, "#ffffff") >= contrast(background, "#000000") ? "#ffffff" : "#000000";
}

/**
 * The colour itself when it is readable as text/lines on white paper,
 * otherwise a darkened version of it (a pale yellow brand colour
 * still gives a legible title, in the same hue).
 */
function inkOnWhite(hex) {
  let [r, g, b] = rgb(hex);
  for (let i = 0; i < 12; i += 1) {
    const cur = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    if (contrast(cur, "#ffffff") >= 4.5) return cur;
    [r, g, b] = [r, g, b].map((v) => Math.round(v * 0.85));
  }
  return DEFAULT_INK;
}

function brandFor(company) {
  const primary = normalizeHex(company?.branding?.primaryColor, DEFAULT_INK);
  const secondary = normalizeHex(company?.branding?.secondaryColor, primary);
  return {
    primary,
    secondary,
    onPrimary: textOn(primary),
    onSecondary: textOn(secondary),
    primaryInk: inkOnWhite(primary),
    secondaryInk: inkOnWhite(secondary),
    dateFormat: company?.localization?.dateFormat || "DD/MM/YYYY",
  };
}

function docBrand(doc) {
  return doc?._brand || brandFor(null);
}

/** Applies a company's brand to a document that has no letterhead (payslip). */
function useCompanyBrand(doc, company) {
  const brand = brandFor(company);
  if (doc) doc._brand = brand;
  brandStore.enterWith(brand);
  return brand;
}

const pad2 = (n) => String(n).padStart(2, "0");

/** DD/MM/YYYY by default; follows the company's "Format de date". */
function formatDate(date, pattern) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const fmt = pattern || brandStore.getStore()?.dateFormat || "DD/MM/YYYY";
  return fmt
    .replace("YYYY", String(d.getFullYear()))
    .replace("MM", pad2(d.getMonth() + 1))
    .replace("DD", pad2(d.getDate()));
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
  const brand = useCompanyBrand(doc, company);
  const accentColor = brand.primary;

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
  if (company?.professionalTaxNumber) legalIds.push(`TP: ${company.professionalTaxNumber}`);
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
  const brand = docBrand(doc);
  doc.fontSize(15).font("Helvetica-Bold").fillColor(brand.primaryInk).text(title, colX, doc.y, { align: "center", width: pageWidth });
  doc.moveDown(0.3);
  const ruleY = doc.y;
  doc.moveTo(colX + pageWidth / 2 - 70, ruleY).lineTo(colX + pageWidth / 2 + 70, ruleY).lineWidth(1.5).stroke(brand.primary);
  doc.fillColor("#000");
  doc.moveDown(1.3);
}

/**
 * Draws the standard "Fait à <city>, le <date>" + signature line
 * block used at the bottom of every attestation/certificate.
 */
function drawSignatureBlock(doc, { city, companyName, colX = 40, width } = {}) {
  const pageWidth = width ?? doc.page.width - colX * 2;
  const brand = docBrand(doc);
  doc.moveDown(2.5);
  const dateLine = city
    ? `Fait à ${city}, le ${formatDateLong(new Date())}`
    : `Le ${formatDateLong(new Date())}`;

  // Keep the date line and its box together on one page
  const BOX = { width: 210, height: 78 };
  if (doc.y + 18 + BOX.height > doc.page.height - doc.page.margins.bottom) doc.addPage();

  doc.fontSize(9).font("Helvetica").fillColor("#000").text(dateLine, colX, doc.y, { align: "right", width: pageWidth });
  doc.moveDown(0.6);

  // Signature box in the company's secondary colour: a coloured band
  // with "Pour <company>", and room underneath to sign and stamp.
  const x = colX + pageWidth - BOX.width;
  const top = doc.y;
  const band = 18;
  doc.save();
  doc.roundedRect(x, top, BOX.width, BOX.height, 4).lineWidth(0.9).stroke(brand.secondary);
  doc.rect(x + 0.45, top + 0.45, BOX.width - 0.9, band).fill(brand.secondary);
  doc.restore();
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(brand.onSecondary).text(
    companyName ? `Pour ${companyName}` : "Signature et cachet de l'entreprise",
    x + 8, top + 5, { width: BOX.width - 16, lineBreak: false, ellipsis: true }
  );
  if (companyName) {
    doc.fontSize(7).font("Helvetica").fillColor("#888").text(
      "Signature et cachet", x + 8, top + BOX.height - 13, { width: BOX.width - 16, align: "right", lineBreak: false }
    );
  }
  doc.fillColor("#000");
  doc.x = colX;
  doc.y = top + BOX.height + 6;
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
  brandFor,
  docBrand,
  useCompanyBrand,
  textOn,
  inkOnWhite,
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
