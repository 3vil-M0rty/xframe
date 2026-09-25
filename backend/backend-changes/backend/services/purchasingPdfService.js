const PDFDocument = require("pdfkit");
const {
  formatDate, formatAmount, drawLetterhead, drawDocumentTitle, drawSignatureBlock, finalizeFooters,
} = require("./pdfHelpers");
const { amountToFrenchWords } = require("./frenchNumberWords");

/**
 * ============================================================
 * PURCHASING DOCUMENTS — bon de commande & demande de prix (PDF)
 * ============================================================
 * Same look as the other company documents (letterhead with logo and
 * ICE/IF/RC, title, signature, footers — services/pdfHelpers.js).
 * Lines paginate: the table header is repeated on each new page.
 * Drafts are watermarked BROUILLON and cancelled orders ANNULÉ, so an
 * unfinished or dead order can't be sent to a supplier by mistake.
 * ============================================================
 */

const COL_X = 40;
const BOTTOM_LIMIT = 90; // keep clear of the footer

const money = (n) => `${formatAmount(n)} MAD`;

/** Supplier + document info side by side, each in a light box. */
function drawPartyBlocks(doc, { supplier, infoRows, width }) {
  const gap = 14;
  const boxWidth = (width - gap) / 2;
  const top = doc.y;
  const pad = 8;

  const supplierLines = [
    supplier?.contactName && `À l'attention de : ${supplier.contactName}`,
    supplier?.address,
    supplier?.city,
    [supplier?.phone && `Tél : ${supplier.phone}`, supplier?.email].filter(Boolean).join("   "),
    [supplier?.ice && `ICE : ${supplier.ice}`, supplier?.identifiantFiscal && `IF : ${supplier.identifiantFiscal}`, supplier?.rc && `RC : ${supplier.rc}`]
      .filter(Boolean).join("   "),
  ].filter(Boolean);

  // left: supplier
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#777").text("FOURNISSEUR", COL_X + pad, top + pad, { width: boxWidth - pad * 2 });
  doc.fontSize(10.5).font("Helvetica-Bold").fillColor("#000").text(supplier?.name || "—", COL_X + pad, doc.y + 2, { width: boxWidth - pad * 2 });
  doc.fontSize(8.5).font("Helvetica").fillColor("#333");
  supplierLines.forEach((l) => doc.text(l, COL_X + pad, doc.y + 1, { width: boxWidth - pad * 2 }));
  const leftBottom = doc.y + pad;

  // right: document info (label: value rows)
  const rightX = COL_X + boxWidth + gap;
  let y = top + pad;
  for (const [label, value] of infoRows) {
    if (value === undefined || value === null || value === "") continue;
    doc.fontSize(8).font("Helvetica").fillColor("#777").text(label, rightX + pad, y, { width: 110 });
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#000").text(String(value), rightX + pad + 112, y, { width: boxWidth - pad * 2 - 112 });
    y = doc.y + 3;
  }
  const rightBottom = y + pad - 3;

  const bottom = Math.max(leftBottom, rightBottom);
  doc.lineWidth(0.6).strokeColor("#cfcfcf");
  doc.roundedRect(COL_X, top, boxWidth, bottom - top, 4).stroke();
  doc.roundedRect(rightX, top, boxWidth, bottom - top, 4).stroke();
  doc.y = bottom + 14;
  doc.x = COL_X;
}

/**
 * Lines table with automatic page breaks. `columns`: [{ key, label,
 * width, align }]; `rows`: [{ [key]: text }]; the first column wraps.
 */
function drawTable(doc, columns, rows) {
  const drawHeader = () => {
    const y = doc.y;
    doc.rect(COL_X, y, columns.reduce((s, c) => s + c.width, 0), 18).fill("#f1f1f1");
    let x = COL_X;
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#333");
    for (const c of columns) {
      doc.text(c.label, x + 5, y + 5.5, { width: c.width - 10, align: c.align || "left" });
      x += c.width;
    }
    doc.y = y + 18;
  };

  drawHeader();
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  rows.forEach((row, index) => {
    // Height = the wrapped description PLUS the reference line under
    // it (smaller font) — measuring only the description let the
    // reference spill onto the row border and into the next row.
    doc.fontSize(8.5).font("Helvetica");
    let firstHeight = doc.heightOfString(String(row[columns[0].key] ?? ""), { width: columns[0].width - 10 });
    if (row.subtext) {
      doc.fontSize(7);
      firstHeight += doc.heightOfString(row.subtext, { width: columns[0].width - 10 }) + 1;
    }
    const rowHeight = Math.max(firstHeight + 10, 20);

    if (doc.y + rowHeight > doc.page.height - BOTTOM_LIMIT) {
      doc.addPage();
      doc.y = 50;
      drawHeader();
    }

    const y = doc.y;
    if (index % 2 === 1) doc.rect(COL_X, y, tableWidth, rowHeight).fill("#fafafa");
    let x = COL_X;
    for (const c of columns) {
      const value = row[c.key] ?? "";
      doc.fontSize(8.5).font(c.bold ? "Helvetica-Bold" : "Helvetica").fillColor("#000");
      if (c.key === columns[0].key && row.subtext) {
        doc.text(String(value), x + 5, y + 5, { width: c.width - 10 });
        doc.fontSize(7).fillColor("#777").text(row.subtext, x + 5, doc.y, { width: c.width - 10 });
      } else {
        doc.text(String(value), x + 5, y + 5, { width: c.width - 10, align: c.align || "left" });
      }
      x += c.width;
    }
    doc.moveTo(COL_X, y + rowHeight).lineTo(COL_X + tableWidth, y + rowHeight).lineWidth(0.4).strokeColor("#e2e2e2").stroke();
    doc.y = y + rowHeight;
  });
  doc.x = COL_X;
}

/** Keeps a block of `height` together, moving to a new page if needed. */
function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - BOTTOM_LIMIT) {
    doc.addPage();
    doc.y = 50;
  }
}

function drawWatermark(doc, text) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const { width, height } = doc.page;
    const originalBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save();
    doc.rotate(-35, { origin: [width / 2, height / 2] });
    doc.fontSize(96).font("Helvetica-Bold").fillColor("#d32f2f").opacity(0.1)
      .text(text, 0, height / 2 - 55, { width, align: "center", lineBreak: false });
    doc.restore();
    doc.opacity(1);
    doc.page.margins.bottom = originalBottom;
  }
}

/** The supplier's own reference for an article, if recorded on it. */
function supplierRefFor(line, supplierName) {
  const prices = line.product?.prices || [];
  return prices.find((p) => p.supplierName === supplierName)?.supplierReference || "";
}

// ============================================================
// BON DE COMMANDE
// ============================================================
function generatePurchaseOrderPdf({ order, company, supplier, logoBuffer }) {
  if (!order || !company) throw new Error("order and company are required");

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, "BON DE COMMANDE", { colX: COL_X, width, ref: order.number });

  drawPartyBlocks(doc, {
    supplier,
    width,
    infoRows: [
      ["N° de commande", order.number],
      ["Date", formatDate(order.date)],
      ["Livraison prévue", order.expectedDate ? formatDate(order.expectedDate) : null],
      ["Conditions de paiement", supplier?.paymentTerms],
      ["Lieu de livraison", [company.address?.street, company.address?.city].filter(Boolean).join(", ") || null],
    ],
  });

  const columns = [
    { key: "description", label: "DÉSIGNATION", width: 219 },
    { key: "quantity", label: "QTÉ", width: 48, align: "right" },
    { key: "unit", label: "UNITÉ", width: 46 },
    { key: "unitPrice", label: "P.U. HT", width: 72, align: "right" },
    { key: "vat", label: "TVA", width: 38, align: "right" },
    { key: "total", label: "TOTAL HT", width: 92, align: "right", bold: true },
  ];
  const rows = order.lines.map((l) => {
    const refs = [
      l.product?.internalReference && `Réf. interne : ${l.product.internalReference}`,
      supplierRefFor(l, supplier?.name) && `Réf. fournisseur : ${supplierRefFor(l, supplier?.name)}`,
    ].filter(Boolean).join("   ");
    return {
      description: l.description,
      subtext: refs || undefined,
      quantity: formatAmount(l.quantity).replace(/,00$/, ""),
      unit: l.unit || "",
      unitPrice: formatAmount(l.unitPrice),
      vat: `${l.vatRate ?? 0}%`,
      total: formatAmount((l.quantity || 0) * (l.unitPrice || 0)),
    };
  });
  drawTable(doc, columns, rows);

  // ---------- totals, with VAT broken down per rate ----------
  const vatByRate = new Map();
  for (const l of order.lines) {
    const ht = (l.quantity || 0) * (l.unitPrice || 0);
    const rate = l.vatRate ?? 0;
    vatByRate.set(rate, (vatByRate.get(rate) || 0) + ht * (rate / 100));
  }
  const totalRows = [["Total HT", money(order.totalHT)]];
  [...vatByRate.entries()].sort((a, b) => b[0] - a[0]).forEach(([rate, amount]) => {
    if (rate > 0) totalRows.push([`TVA ${rate}%`, money(amount)]);
  });

  ensureSpace(doc, 40 + totalRows.length * 16 + 60);
  doc.moveDown(0.8);
  const boxWidth = 230;
  const boxX = COL_X + width - boxWidth;
  for (const [label, value] of totalRows) {
    const y = doc.y;
    doc.fontSize(8.5).font("Helvetica").fillColor("#333").text(label, boxX, y, { width: 110 });
    doc.text(value, boxX + 110, y, { width: boxWidth - 110, align: "right" });
    doc.y = y + 14;
  }
  const ttcY = doc.y + 2;
  doc.rect(boxX, ttcY, boxWidth, 22).fill("#1a1a1a");
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#fff").text("TOTAL TTC", boxX + 8, ttcY + 6, { width: 110 });
  doc.text(money(order.totalTTC), boxX + 110, ttcY + 6, { width: boxWidth - 118, align: "right" });
  doc.fillColor("#000");
  doc.y = ttcY + 32;

  doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#333").text(
    `Arrêté le présent bon de commande à la somme de : ${amountToFrenchWords(order.totalTTC)} TTC.`,
    COL_X, doc.y, { width }
  );

  if (order.notes) {
    ensureSpace(doc, 60);
    doc.moveDown(0.8);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#777").text("REMARQUES", COL_X, doc.y, { width });
    doc.fontSize(8.5).font("Helvetica").fillColor("#000").text(order.notes, COL_X, doc.y + 2, { width });
  }

  ensureSpace(doc, 110);
  doc.moveDown(0.6);
  doc.fontSize(7.5).font("Helvetica").fillColor("#666").text(
    "Merci de rappeler le numéro de ce bon de commande sur votre bon de livraison et votre facture.",
    COL_X, doc.y, { width }
  );
  drawSignatureBlock(doc, { city: company.address?.city, companyName: company.name, colX: COL_X, width });

  if (order.status === "draft") drawWatermark(doc, "BROUILLON");
  if (order.status === "cancelled") drawWatermark(doc, "ANNULÉ");
  finalizeFooters(doc, company);
  return doc;
}

// ============================================================
// DEMANDE DE PRIX
// ============================================================
function generatePriceRequestPdf({ priceRequest, company, supplier, logoBuffer }) {
  if (!priceRequest || !company) throw new Error("priceRequest and company are required");

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, "DEMANDE DE PRIX", { colX: COL_X, width, ref: priceRequest.number });

  drawPartyBlocks(doc, {
    supplier,
    width,
    infoRows: [
      ["N° de demande", priceRequest.number],
      ["Date", formatDate(priceRequest.date)],
      ["Réponse souhaitée avant le", priceRequest.responseDeadline ? formatDate(priceRequest.responseDeadline) : null],
    ],
  });

  doc.fontSize(9).font("Helvetica").fillColor("#000").text(
    "Madame, Monsieur,\n\nNous vous prions de bien vouloir nous communiquer votre meilleure offre de prix pour les articles "
    + "ci-dessous, en précisant vos délais de livraison et vos conditions de paiement.",
    COL_X, doc.y, { width }
  );
  doc.moveDown(1);

  // Price columns are left EMPTY: the supplier fills them in.
  const columns = [
    { key: "description", label: "DÉSIGNATION", width: 245 },
    { key: "quantity", label: "QTÉ", width: 55, align: "right" },
    { key: "unit", label: "UNITÉ", width: 55 },
    { key: "unitPrice", label: "P.U. HT", width: 75, align: "right" },
    { key: "total", label: "TOTAL HT", width: 85, align: "right" },
  ];
  const rows = priceRequest.lines.map((l) => ({
    description: l.description,
    subtext: [
      l.product?.internalReference && `Réf. interne : ${l.product.internalReference}`,
      supplierRefFor(l, supplier?.name) && `Votre réf. : ${supplierRefFor(l, supplier?.name)}`,
    ].filter(Boolean).join("   ") || undefined,
    quantity: formatAmount(l.quantity).replace(/,00$/, ""),
    unit: l.unit || "",
    unitPrice: "",
    total: "",
  }));
  drawTable(doc, columns, rows);

  if (priceRequest.notes) {
    ensureSpace(doc, 60);
    doc.moveDown(0.8);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#777").text("REMARQUES", COL_X, doc.y, { width });
    doc.fontSize(8.5).font("Helvetica").fillColor("#000").text(priceRequest.notes, COL_X, doc.y + 2, { width });
  }

  ensureSpace(doc, 110);
  doc.moveDown(1);
  doc.fontSize(9).font("Helvetica").fillColor("#000").text(
    "Dans l'attente de votre réponse, veuillez agréer, Madame, Monsieur, nos salutations distinguées.",
    COL_X, doc.y, { width }
  );
  drawSignatureBlock(doc, { city: company.address?.city, companyName: company.name, colX: COL_X, width });

  finalizeFooters(doc, company);
  return doc;
}

module.exports = { generatePurchaseOrderPdf, generatePriceRequestPdf };
