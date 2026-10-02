const PDFDocument = require("pdfkit");
const { formatDate, formatAmount, drawLetterhead, drawDocumentTitle, drawSignatureBlock, finalizeFooters } = require("./pdfHelpers");
const { drawPartyBlocks, drawTable, ensureSpace, drawWatermark, COL_X } = require("./purchasingPdfService");
const { amountToFrenchWords } = require("./frenchNumberWords");
const { lineHT } = require("./salesCalc");
const { drawSketchPdf } = require("./chassisSketch");

/**
 * ============================================================
 * SALES DOCUMENTS — devis & facture (PDF)
 * ============================================================
 * Same look as the purchasing documents. Invoices carry what a
 * Moroccan invoice must show: the seller's ICE / IF / RC / TP / CNSS
 * (letterhead), the customer's ICE, a number and date, each line HT,
 * VAT per rate, totals, and the amount in words.
 * ============================================================
 */

const money = (n) => `${formatAmount(n)} MAD`;

function customerParty(customer) {
  return {
    name: customer?.name,
    contactName: customer?.contacts?.[0]?.name,
    address: customer?.address,
    city: customer?.city,
    phone: customer?.phone,
    email: customer?.email,
    ice: customer?.ice,
    identifiantFiscal: customer?.identifiantFiscal,
    rc: customer?.rc,
  };
}

const FIG = { width: 62, height: 50 };

/**
 * A chassis line reads as a small block instead of one long sentence:
 * the schematic (or the model's uploaded picture) on the left, then
 * "F1 · Coulissant 2 vantaux" in bold, the series / L × H / colour on
 * one line and the options under it.
 */
function chassisRow(info, line, images) {
  const title = `${info.ref ? `${info.ref} · ` : ""}${info.name}`;
  const details = [[info.series, info.size, info.finish].filter(Boolean).join(" · ")];
  if (info.options.length) details.push(info.options.join(" · "));
  const own = String(line.description || "").trim();
  if (own && own !== info.autoDescription && own !== `${info.ref} · ${info.autoDescription}`) details.push(own);
  const buffer = info.image ? images.get(info.image) : null;
  return {
    title,
    details,
    figure: {
      ...FIG,
      draw: (doc, x, y) => {
        if (buffer) {
          try {
            doc.image(buffer, x, y, { fit: [FIG.width, FIG.height], align: "center", valign: "center" });
            return;
          } catch { /* unreadable picture: fall back to the schematic */ }
        }
        drawSketchPdf(doc, { x, y, width: FIG.width, height: FIG.height, drawing: info.drawing, L: info.L, H: info.H, params: info.params });
      },
    },
  };
}

function linesTable(doc, lines, { chassis = [], images = new Map() } = {}) {
  const hasDiscount = lines.some((l) => l.discount > 0);
  const columns = [
    { key: "description", label: "DÉSIGNATION", width: hasDiscount ? 185 : 219 },
    { key: "quantity", label: "QTÉ", width: 44, align: "right" },
    { key: "unit", label: "UNITÉ", width: 42 },
    { key: "unitPrice", label: "P.U. HT", width: 70, align: "right" },
    ...(hasDiscount ? [{ key: "discount", label: "REMISE", width: 38, align: "right" }] : []),
    { key: "vat", label: "TVA", width: 36, align: "right" },
    { key: "total", label: "TOTAL HT", width: 90, align: "right", bold: true },
  ];
  drawTable(doc, columns, lines.map((l, i) => {
    const info = chassis[i];
    const rich = info ? chassisRow(info, l, images) : null;
    return {
      description: rich ? rich.title : l.description,
      ...(rich ? { titleBold: true, details: rich.details, figure: rich.figure } : {}),
      quantity: formatAmount(l.quantity).replace(/,00$/, ""),
      unit: l.unit || "",
      unitPrice: formatAmount(l.unitPrice),
      discount: l.discount ? `${l.discount}%` : "",
      vat: `${l.vatRate ?? 0}%`,
      total: formatAmount(lineHT(l)),
    };
  }));
}

function totalsBox(doc, width, rows, ttcLabel, ttc) {
  ensureSpace(doc, 40 + rows.length * 16 + 60);
  doc.moveDown(0.8);
  const boxWidth = 250;
  const boxX = COL_X + width - boxWidth;
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.fontSize(8.5).font("Helvetica").fillColor("#333").text(label, boxX, y, { width: 140 });
    doc.text(value, boxX + 140, y, { width: boxWidth - 140, align: "right" });
    doc.y = y + 14;
  }
  const ttcY = doc.y + 2;
  doc.rect(boxX, ttcY, boxWidth, 22).fill("#1a1a1a");
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#fff").text(ttcLabel, boxX + 8, ttcY + 6, { width: 140 });
  doc.text(money(ttc), boxX + 140, ttcY + 6, { width: boxWidth - 148, align: "right" });
  doc.fillColor("#000");
  doc.y = ttcY + 32;
}

function textBlock(doc, width, title, text) {
  if (!text) return;
  ensureSpace(doc, 60);
  doc.moveDown(0.6);
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#777").text(title, COL_X, doc.y, { width });
  doc.fontSize(8.5).font("Helvetica").fillColor("#000").text(text, COL_X, doc.y + 2, { width });
}

// ============================================================
// DEVIS
// ============================================================
function generateQuotePdf({ quote, company, customer, logoBuffer, chassis }) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, "DEVIS", { colX: COL_X, width, ref: quote.number });
  drawPartyBlocks(doc, {
    supplier: customerParty(customer),
    label: "CLIENT",
    width,
    infoRows: [
      ["N° de devis", quote.number],
      ["Date", formatDate(quote.date)],
      ["Valable jusqu'au", quote.validUntil ? formatDate(quote.validUntil) : null],
      ["Objet", quote.subject],
    ],
  });
  linesTable(doc, quote.lines, chassis);
  const rows = [["Total HT", money(quote.totalHT)]];
  const { vatBreakdown } = require("./salesCalc");
  vatBreakdown(quote.lines).forEach((r) => { if (r.rate > 0) rows.push([`TVA ${r.rate}% (base ${formatAmount(r.baseHT)})`, money(r.vat)]); });
  totalsBox(doc, width, rows, "TOTAL TTC", quote.totalTTC);
  doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#333").text(
    `Arrêté le présent devis à la somme de : ${amountToFrenchWords(quote.totalTTC)} TTC.`, COL_X, doc.y, { width }
  );
  textBlock(doc, width, "CONDITIONS DE PAIEMENT", quote.paymentTerms);
  textBlock(doc, width, "REMARQUES", quote.notes);
  ensureSpace(doc, 120);
  doc.moveDown(0.8);
  doc.fontSize(8).font("Helvetica").fillColor("#555").text("Bon pour accord — date, cachet et signature du client :", COL_X, doc.y, { width });
  drawSignatureBlock(doc, { city: company.address?.city, companyName: company.name, colX: COL_X, width });
  if (quote.status === "draft") drawWatermark(doc, "BROUILLON");
  if (quote.status === "cancelled") drawWatermark(doc, "ANNULÉ");
  finalizeFooters(doc, company);
  return doc;
}

// ============================================================
// FACTURE / FACTURE D'ACOMPTE / AVOIR
// ============================================================
const TITLES = { invoice: "FACTURE", deposit: "FACTURE D'ACOMPTE", credit_note: "AVOIR" };

function generateInvoicePdf({ invoice, company, customer, quote, creditedInvoice, logoBuffer, chassis }) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, TITLES[invoice.type] || "FACTURE", { colX: COL_X, width, ref: invoice.number || "BROUILLON" });
  drawPartyBlocks(doc, {
    supplier: customerParty(customer),
    label: "CLIENT",
    width,
    infoRows: [
      [invoice.type === "credit_note" ? "N° d'avoir" : "N° de facture", invoice.number || "— (brouillon)"],
      ["Date", formatDate(invoice.date)],
      [invoice.type === "credit_note" ? null : "Échéance", invoice.type === "credit_note" ? null : invoice.dueDate ? formatDate(invoice.dueDate) : null],
      ["Devis", quote?.number],
      ["Facture corrigée", creditedInvoice?.number],
      ["Objet", invoice.subject],
    ].filter(([label]) => label),
  });
  linesTable(doc, invoice.lines, chassis);

  const rows = [];
  const linesHT = (invoice.totalHT || 0) + (invoice.depositsDeductedHT || 0);
  rows.push(["Total HT", money(linesHT)]);
  if (invoice.depositsDeductedHT) rows.push(["Acomptes déjà facturés (HT)", `- ${money(invoice.depositsDeductedHT)}`]);
  if (invoice.depositsDeductedHT) rows.push(["Net HT", money(invoice.totalHT)]);
  (invoice.vatBreakdown || []).forEach((r) => { if (r.rate > 0) rows.push([`TVA ${r.rate}% (base ${formatAmount(r.baseHT)})`, money(r.vat)]); });
  const label = invoice.type === "credit_note" ? "TOTAL AVOIR TTC" : invoice.depositsDeductedHT ? "NET À PAYER TTC" : "TOTAL TTC";
  totalsBox(doc, width, rows, label, invoice.totalTTC);
  doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#333").text(
    `Arrêtée la présente ${invoice.type === "credit_note" ? "facture d'avoir" : "facture"} à la somme de : ${amountToFrenchWords(invoice.totalTTC)} TTC.`,
    COL_X, doc.y, { width }
  );
  if (invoice.amountPaid > 0 && invoice.type !== "credit_note") {
    doc.moveDown(0.3);
    doc.fontSize(8.5).font("Helvetica").fillColor("#333").text(
      `Déjà réglé : ${money(invoice.amountPaid)} — Reste à payer : ${money(Math.max(invoice.totalTTC - invoice.amountPaid, 0))}`,
      COL_X, doc.y, { width }
    );
  }
  textBlock(doc, width, "CONDITIONS DE PAIEMENT", invoice.paymentTerms);
  if (company.bank?.rib) textBlock(doc, width, "RÈGLEMENT PAR VIREMENT", `${company.bank.bankName ? `${company.bank.bankName} — ` : ""}RIB : ${company.bank.rib}`);
  textBlock(doc, width, "REMARQUES", invoice.notes);
  ensureSpace(doc, 60);
  doc.moveDown(0.6);
  doc.fontSize(7.5).font("Helvetica").fillColor("#666").text(
    "En cas de retard de paiement, des pénalités de retard sont exigibles conformément à la loi n° 69-21.",
    COL_X, doc.y, { width }
  );
  drawSignatureBlock(doc, { city: company.address?.city, companyName: company.name, colX: COL_X, width });
  if (invoice.status === "draft") drawWatermark(doc, "BROUILLON");
  if (invoice.status === "cancelled") drawWatermark(doc, "ANNULÉE");
  finalizeFooters(doc, company);
  return doc;
}

module.exports = { generateQuotePdf, generateInvoicePdf };
