const PDFDocument = require("pdfkit");
const { formatDate, drawLetterhead, docBrand, drawDocumentTitle, finalizeFooters } = require("./pdfHelpers");
const { drawPartyBlocks, drawTable, ensureSpace, drawWatermark, COL_X } = require("./purchasingPdfService");

/**
 * ============================================================
 * FICHE DE FABRICATION (work order PDF)
 * ============================================================
 * One document per workshop order:
 *   - what to produce (ouvrages / panes / bars to lacquer)
 *   - the planned materials, by type: number of bars per profile
 *     (for the article's bar length), accessories, gaskets, glass…
 *   Quantities only — the cutting plans (bars, glass plateaux) and one paper
 *   per material are in services/cuttingPdfService.js (?section=…).
 * ============================================================
 */
const fmt = (n, d = 1) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(d).replace(/\.0+$/, "");
};
const qty = (n) => fmt(n, 3).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
const STATUS = { draft: "Brouillon", planned: "Planifié", in_progress: "En cours", done: "Terminé", cancelled: "Annulé" };
const PRIORITY = { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" };

const MATERIAL_LABELS = {
  profile: "Profilés",
  accessory: "Accessoires",
  gasket: "Joints",
  glass: "Vitrage",
  panel: "Tôles, panneaux",
  powder: "Poudre",
  consumable: "Consommables",
  other: "Autres",
};

function unitLabel(n) {
  if (n.barLength) return `barre${Number(n.theoretical) > 1 ? "s" : ""} de ${fmt(n.barLength)} mm`;
  return n.unit || "";
}

function sectionTitle(doc, text, width) {
  ensureSpace(doc, 60);
  doc.moveDown(0.8);
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(docBrand(doc).primaryInk).text(text, COL_X, doc.y, { width });
  doc.fillColor("#000");
  doc.moveDown(0.3);
}

function generateProductionOrderPdf({ order, company, logoBuffer }) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, `ORDRE DE FABRICATION — ${String(order.workshop?.name || "").toUpperCase()}`, { colX: COL_X, width, ref: order.number });

  drawPartyBlocks(doc, {
    label: order.project ? "PROJET" : "CLIENT",
    supplier: {
      name: order.project ? `${order.project.number} — ${order.project.name}` : order.customer?.name || order.title,
      address: order.project?.location,
      contactName: order.customer?.name && order.project ? `Client : ${order.customer.name}` : undefined,
    },
    width,
    infoRows: [
      ["N° d'ordre", order.number],
      ["Atelier", order.workshop?.name],
      ["Statut", STATUS[order.status] || order.status],
      ["Priorité", PRIORITY[order.priority] || order.priority],
      ["Échéance", order.dueDate ? formatDate(order.dueDate) : null],
      ["Matière client", order.customerMaterial ? "Oui (pas de sortie de profilés)" : null],
    ],
  });

  // ---------- what to produce ----------
  if (order.items?.length) {
    sectionTitle(doc, order.kind === "laquage" ? "BARRES À LAQUER" : order.kind === "vitrage" ? "VITRAGES À FABRIQUER" : "OUVRAGES À FABRIQUER", width);
    drawTable(doc, [
      { key: "label", label: "DÉSIGNATION", width: 300 },
      { key: "ref", label: "REPÈRE", width: 55 },
      { key: "L", label: "L (mm)", width: 55, align: "right" },
      { key: "H", label: "H (mm)", width: 55, align: "right" },
      { key: "q", label: "QTÉ", width: 50, align: "right", bold: true },
    ], order.items.map((i) => ({
      label: i.label || "",
      subtext: i.finish ? `Couleur : ${i.finish.code}${i.finish.name ? ` ${i.finish.name}` : ""}` : undefined,
      ref: i.ref || "",
      L: i.L ? fmt(i.L) : "",
      H: i.H ? fmt(i.H) : "",
      q: qty(i.quantity),
    })));
  }

  // ---------- laquage outputs ----------
  if (order.outputs?.length) {
    sectionTitle(doc, "LAQUAGE — PRODUCTION ATTENDUE", width);
    drawTable(doc, [
      { key: "p", label: "ARTICLE BRUT", width: 245 },
      { key: "f", label: "COULEUR", width: 110 },
      { key: "q", label: "QTÉ", width: 55, align: "right", bold: true },
      { key: "s", label: "SURFACE (m²)", width: 105, align: "right" },
    ], order.outputs.map((o) => ({
      p: o.product?.name || "",
      subtext: o.product?.internalReference ? `Réf. ${o.product.internalReference}` : undefined,
      f: o.finish ? `${o.finish.code}${o.finish.name ? ` ${o.finish.name}` : ""}` : "",
      q: qty(o.quantity),
      s: o.paintSurface ? fmt(o.paintSurface, 2) : "",
    })));
  }

  // ---------- planned materials ----------
  // Quantities only (bars of the article's length, accessories, gaskets,
  // plateaux of glass…) — the débit is printed separately (?section=bars|glass).
  if (order.needs?.length) {
    sectionTitle(doc, "MATÉRIEL PRÉVU", width);
    const groups = new Map();
    for (const n of order.needs) {
      const mt = n.materialType || n.product?.materialType;
      const type = MATERIAL_LABELS[mt] ? mt : "other";
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(n);
    }
    const ordered = Object.keys(MATERIAL_LABELS).filter((k) => groups.has(k));
    for (const type of ordered) {
      ensureSpace(doc, 50);
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#333").text(MATERIAL_LABELS[type], COL_X, doc.y, { width });
      doc.moveDown(0.2);
      drawTable(doc, [
        { key: "p", label: "ARTICLE", width: 255 },
        { key: "t", label: "PRÉVU", width: 60, align: "right", bold: true },
        { key: "u", label: "UNITÉ", width: 100 },
        { key: "c", label: "CONSOMMÉ", width: 100, align: "right" },
      ], groups.get(type).map((n) => ({
        p: n.product?.name || `${n.label} (article non défini)`,
        subtext: [n.product?.internalReference && `Réf. ${n.product.internalReference}`, n.finish && `Couleur ${n.finish.code}`, n.warning].filter(Boolean).join("   ") || undefined,
        t: qty(n.theoretical),
        u: unitLabel(n),
        c: n.consumed ? qty(n.consumed) : "…………",
      })));
      doc.moveDown(0.4);
    }
  }

  if (order.notes) {
    sectionTitle(doc, "REMARQUES", width);
    doc.fontSize(8.5).font("Helvetica").fillColor("#000").text(order.notes, COL_X, doc.y, { width });
  }

  ensureSpace(doc, 80);
  doc.moveDown(1.2);
  const y = doc.y;
  const half = width / 2 - 10;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#333");
  doc.text("Responsable d'atelier (nom, date, visa)", COL_X, y, { width: half });
  doc.text("Contrôle qualité (nom, date, visa)", COL_X + half + 20, y, { width: half });
  doc.moveTo(COL_X, y + 45).lineTo(COL_X + half, y + 45).strokeColor("#999").stroke();
  doc.moveTo(COL_X + half + 20, y + 45).lineTo(COL_X + width, y + 45).stroke();

  if (order.status === "cancelled") drawWatermark(doc, "ANNULÉ");
  finalizeFooters(doc, company);
  return doc;
}

module.exports = { generateProductionOrderPdf };
