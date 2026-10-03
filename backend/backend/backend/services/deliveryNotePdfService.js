const PDFDocument = require("pdfkit");
const { formatDate, drawLetterhead, docBrand, drawDocumentTitle, finalizeFooters } = require("./pdfHelpers");
const { drawPartyBlocks, drawTable, ensureSpace, drawWatermark, COL_X } = require("./purchasingPdfService");

/**
 * ============================================================
 * BON DE LIVRAISON (PDF)
 * ============================================================
 * Letterhead, customer / site, transport (own vehicle, carrier or
 * customer pick-up), chassis lines (repère, désignation, dimensions,
 * colour, delivered element, quantity), extra items (accessories,
 * screws, sealant…), packages / weight, remarks, and the three boxes
 * a site delivery needs: driver, customer signature, reserves.
 * ============================================================
 */
const MODES = { own: "Véhicule de la société", carrier: "Transporteur", pickup: "Enlèvement par le client" };
const STATUS = { draft: "Brouillon", planned: "Planifié", shipped: "En livraison", delivered: "Livré", cancelled: "Annulé" };
const qty = (n) => String(Math.round((Number(n) || 0) * 1000) / 1000).replace(".", ",");

function box(doc, x, y, w, h, title, lines = []) {
  // Signature boxes framed in the company's secondary colour
  const brand = docBrand(doc);
  doc.roundedRect(x, y, w, h, 4).lineWidth(0.9).strokeColor(brand.secondary).stroke();
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(brand.secondaryInk).text(title, x + 8, y + 7, { width: w - 16 });
  // start under the title even when it wraps onto two lines
  let yy = Math.max(y + 20, doc.y + 4);
  for (const l of lines) {
    if (!l) continue;
    doc.fontSize(8.5).font("Helvetica").fillColor("#000").text(l, x + 8, yy, { width: w - 16 });
    yy = doc.y + 2;
  }
}

function generateDeliveryNotePdf({ note, company, logoBuffer }) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, "BON DE LIVRAISON", { colX: COL_X, width, ref: note.number });

  const c = note.customer || {};
  drawPartyBlocks(doc, {
    label: "CLIENT",
    supplier: {
      name: c.name, address: c.address, city: c.city, phone: c.phone, email: c.email, ice: c.ice,
      contactName: note.project ? `Projet ${note.project.number} — ${note.project.name}` : undefined,
    },
    width,
    infoRows: [
      ["N° BL", note.number],
      ["Date de livraison", `${formatDate(note.deliveredAt || note.date)}${note.timeSlot ? ` · ${note.timeSlot}` : ""}`],
      ["Statut", STATUS[note.status]],
      ["Chantier", note.address],
      ["Contact sur site", [note.siteContact, note.sitePhone].filter(Boolean).join(" · ") || null],
    ],
  });

  // Transport
  const t = note.transport || {};
  const transportLines = [
    t.mode === "carrier" && t.carrier ? `Transporteur : ${t.carrier}` : MODES[t.mode] || MODES.own,
    t.vehicle && `Véhicule : ${t.vehicle}`,
    (t.driver || t.driverPhone) && `Chauffeur : ${[t.driver, t.driverPhone].filter(Boolean).join(" · ")}`,
    t.trackingRef && `Réf. transport : ${t.trackingRef}`,
  ];
  const loadLines = [
    note.packages !== null && note.packages !== undefined && `Colis / chevalets : ${note.packages}`,
    note.weightKg && `Poids estimé : ${qty(note.weightKg)} kg`,
    `Châssis : ${new Set((note.lines || []).map((l) => l.ref)).size} · éléments : ${qty((note.lines || []).reduce((a, l) => a + l.quantity, 0))}`,
  ];
  ensureSpace(doc, 90);
  const y = doc.y;
  const half = (width - 12) / 2;
  box(doc, COL_X, y, half, 78, "TRANSPORT", transportLines);
  box(doc, COL_X + half + 12, y, half, 78, "CHARGEMENT", loadLines);
  doc.y = y + 90;
  doc.x = COL_X;

  // Lines
  drawTable(doc, [
    { key: "ref", label: "REPÈRE", width: 58, bold: true },
    { key: "label", label: "DÉSIGNATION", width: 190 },
    { key: "size", label: "L × H (mm)", width: 70 },
    { key: "finish", label: "COULEUR", width: 62 },
    { key: "part", label: "ÉLÉMENT LIVRÉ", width: 90 },
    { key: "q", label: "QTÉ", width: 45, align: "right", bold: true },
  ], (note.lines || []).map((l) => ({
    ref: l.ref,
    label: `${l.label || ""}${l.chassisSize && l.chassisSize !== l.size ? ` (châssis ${l.chassisSize})` : ""}${l.notes ? ` — ${l.notes}` : ""}`,
    size: l.size || "", finish: l.finish || "",
    part: l.partLabel || "", q: qty(l.quantity),
  })));

  if (note.extraLines?.length) {
    ensureSpace(doc, 60);
    doc.moveDown(0.6);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(docBrand(doc).primaryInk).text("FOURNITURES LIVRÉES", COL_X, doc.y, { width });
    doc.moveDown(0.3);
    drawTable(doc, [
      { key: "label", label: "DÉSIGNATION", width: 400 },
      { key: "q", label: "QTÉ", width: 60, align: "right", bold: true },
      { key: "u", label: "UNITÉ", width: 55 },
    ], note.extraLines.map((e) => ({ label: e.label, q: qty(e.quantity), u: e.unit || "" })));
  }

  if (note.notes) {
    ensureSpace(doc, 60);
    doc.moveDown(0.6);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#777").text("REMARQUES", COL_X, doc.y, { width });
    doc.fontSize(8.5).font("Helvetica").fillColor("#000").text(note.notes, COL_X, doc.y + 2, { width });
  }

  // Signatures & reserves
  ensureSpace(doc, 150);
  doc.moveDown(1);
  const sy = doc.y;
  const third = (width - 20) / 3;
  box(doc, COL_X, sy, third, 110, "LIVREUR (nom, signature)", [t.driver]);
  box(doc, COL_X + third + 10, sy, third, 110, "CLIENT — reçu en bon état (nom, date, signature, cachet)", [note.receivedBy, note.deliveredAt && formatDate(note.deliveredAt)]);
  box(doc, COL_X + 2 * (third + 10), sy, third, 110, "RÉSERVES À LA LIVRAISON", [note.reserves]);
  doc.y = sy + 120;
  doc.x = COL_X;
  doc.fontSize(7).font("Helvetica").fillColor("#666").text(
    "Toute réserve (casse, rayure, manquant) doit être notée ci-dessus à la réception et confirmée par écrit sous 48 heures. La marchandise voyage aux risques du destinataire en cas d'enlèvement par le client.",
    COL_X, doc.y, { width },
  );

  if (note.status === "draft") drawWatermark(doc, "BROUILLON");
  if (note.status === "cancelled") drawWatermark(doc, "ANNULÉ");
  finalizeFooters(doc, company);
  return doc;
}

module.exports = { generateDeliveryNotePdf };
