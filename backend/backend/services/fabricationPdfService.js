const PDFDocument = require("pdfkit");
const { formatDate, drawLetterhead, docBrand, drawDocumentTitle, finalizeFooters } = require("./pdfHelpers");
const { drawPartyBlocks, drawTable, ensureSpace, COL_X } = require("./purchasingPdfService");
const {
  barsSection, glassSection, accessoriesSection, sectionTitle, emptyNote, piecePolygon, opText, fmt,
} = require("./cuttingPdfService");
const { parseAngles } = require("./cuttingOptimizer");

/**
 * ============================================================
 * DOSSIER DE FABRICATION — one CAD chassis at L × H × quantity
 * ============================================================
 * What LogiKal prints for the workshop, from services/chassisFabrication.js
 * and the usual débit engine:
 *   plan        plan coté (vue de face), vantaux (dimensions, poids,
 *               ouverture), contrôles
 *   pieces      liste de débit par position (dormant haut, montant côté
 *               paumelles…) with angles and machining count
 *   bars        plans de coupe optimisés (bar by bar) + réglages de butée
 *   machining   fiche d'usinage: each piece drawn with its operations
 *   accessories accessoires, joints, consommables (by rule + stock units)
 *   glass       vitrages à commander / débiter (plateaux)
 * ============================================================
 */
const SECTIONS = ["plan", "pieces", "bars", "machining", "accessories", "glass"];
const OPENING_LABELS = {
  left: "à la française, paumelles à gauche", right: "à la française, paumelles à droite",
  "tilt-left": "oscillo-battant, paumelles à gauche", "tilt-right": "oscillo-battant, paumelles à droite",
  top: "à l'italienne (haut)", bottom: "soufflet (bas)", slide: "coulissant",
};
const MARK_COLORS = ["#c62828", "#1565c0", "#2e7d32", "#ef6c00", "#6a1b9a", "#00838f"];

// ------------------------------------------------------------------
// Plan coté (vue de face)
// ------------------------------------------------------------------
function drawElevation(doc, layout, L, H, top, width, maxH) {
  const frame = layout.find((r) => r.type === "frame");
  const jour = layout.find((r) => r.type === "jour");
  if (!frame) return top;
  const k = Math.min((width - 90) / frame.w, (maxH - 70) / frame.h);
  const ox = COL_X + 50 + (width - 90 - frame.w * k) / 2 - frame.x * k;
  const oy = top + 34 - frame.y * k;
  const X = (x) => ox + x * k;
  const Y = (y) => oy + y * k;
  const rect = (r, fill, stroke, lw = 0.6) => doc.lineWidth(lw).rect(X(r.x), Y(r.y), r.w * k, r.h * k).fillAndStroke(fill, stroke);

  rect(frame, "#e6e6e6", "#333", 0.9);
  if (jour) rect(jour, "#ffffff", "#888", 0.5);
  const leaves = layout.filter((r) => r.type === "leaf");
  const inLeaf = (g) => leaves.some((l) => g.id.startsWith(`${l.id}_`));
  for (const g of layout.filter((r) => (r.type === "glass" || r.type === "panel") && !inLeaf(r))) rect(g, g.type === "glass" ? "#dcefff" : "#d9d9d9", "#6b9bd1", 0.4);
  for (const l of leaves) {
    rect(l, "#f1f1f1", "#222", 0.8);
    for (const g of layout.filter((r) => (r.type === "glass" || r.type === "panel") && r.id.startsWith(`${l.id}_`))) rect(g, g.type === "glass" ? "#dcefff" : "#d9d9d9", "#6b9bd1", 0.4);
    // opening symbol (dashed lines towards the hinge side)
    const lx = X(l.x); const ty = Y(l.y); const rx = X(l.x + l.w); const by = Y(l.y + l.h); const cx = (lx + rx) / 2; const cy = (ty + by) / 2;
    const o = String(l.opening || "");
    doc.save().lineWidth(0.6).dash(4, { space: 3 }).strokeColor("#555");
    if (l.slide) { doc.moveTo(cx - 25, cy).lineTo(cx + 25, cy).stroke(); doc.undash().moveTo(cx + 25, cy).lineTo(cx + 18, cy - 4).moveTo(cx + 25, cy).lineTo(cx + 18, cy + 4).stroke(); }
    else {
      if (o.endsWith("left") || o.endsWith("right")) {
        const hinge = o.endsWith("left") ? lx : rx;
        const free = o.endsWith("left") ? rx : lx;
        doc.moveTo(free, ty).lineTo(hinge, cy).lineTo(free, by).stroke();
      }
      if (o.startsWith("tilt") || o === "bottom") doc.moveTo(lx, ty).lineTo(cx, by).lineTo(rx, ty).stroke();
      if (o === "top") doc.moveTo(lx, by).lineTo(cx, ty).lineTo(rx, by).stroke();
    }
    doc.undash().restore();
  }
  for (const m of layout.filter((r) => r.type === "mullion" || r.type === "transom")) rect(m, "#e6e6e6", "#333", 0.7);
  // cell numbers and infill sizes
  for (const c of layout.filter((r) => r.type === "cell")) {
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#888").text(String(c.no), X(c.x) + 4, Y(c.y) + 4, { lineBreak: false });
  }
  for (const g of layout.filter((r) => r.type === "glass" || r.type === "panel")) {
    const t = `${fmt(g.w, 0)} × ${fmt(g.h, 0)}`;
    doc.fontSize(6.5).font("Helvetica").fillColor("#2b5d8f");
    if (doc.widthOfString(t) < g.w * k - 4) doc.text(t, X(g.x), Y(g.y + g.h / 2) - 3, { width: g.w * k, align: "center", lineBreak: false });
  }

  // cotes
  const dimH = (x1, x2, y, strong) => {
    doc.lineWidth(strong ? 0.7 : 0.5).strokeColor(strong ? docBrand(doc).primaryInk : "#777");
    doc.moveTo(X(x1), y).lineTo(X(x2), y).moveTo(X(x1), y - 4).lineTo(X(x1), y + 4).moveTo(X(x2), y - 4).lineTo(X(x2), y + 4).stroke();
    doc.fontSize(strong ? 8.5 : 7).font(strong ? "Helvetica-Bold" : "Helvetica").fillColor(strong ? docBrand(doc).primaryInk : "#555")
      .text(fmt(x2 - x1), X(x1), y - (strong ? 11 : 9), { width: (x2 - x1) * k, align: "center", lineBreak: false });
  };
  const dimV = (y1, y2, x, strong) => {
    doc.lineWidth(strong ? 0.7 : 0.5).strokeColor(strong ? docBrand(doc).primaryInk : "#777");
    doc.moveTo(x, Y(y1)).lineTo(x, Y(y2)).moveTo(x - 4, Y(y1)).lineTo(x + 4, Y(y1)).moveTo(x - 4, Y(y2)).lineTo(x + 4, Y(y2)).stroke();
    const label = fmt(y2 - y1);
    doc.save().fontSize(strong ? 8.5 : 7).font(strong ? "Helvetica-Bold" : "Helvetica").fillColor(strong ? docBrand(doc).primaryInk : "#555");
    const tw = doc.widthOfString(label);
    doc.rotate(-90, { origin: [x - 4, (Y(y1) + Y(y2)) / 2] }).text(label, x - 4 - tw / 2, (Y(y1) + Y(y2)) / 2 - (strong ? 9 : 7), { lineBreak: false });
    doc.restore();
  };
  dimH(0, L, Y(frame.y) - 14, true);
  dimV(0, H, X(frame.x) - 18, true);
  const cells = layout.filter((r) => r.type === "cell");
  if (jour) {
    const bottom = [...new Map(cells.filter((c) => Math.abs(c.y + c.h - (jour.y + jour.h)) < 1).map((c) => [`${c.x}|${c.w}`, c])).values()].sort((a, b) => a.x - b.x);
    const right = [...new Map(cells.filter((c) => Math.abs(c.x + c.w - (jour.x + jour.w)) < 1).map((c) => [`${c.y}|${c.h}`, c])).values()].sort((a, b) => a.y - b.y);
    if (bottom.length > 1) for (const c of bottom) dimH(c.x, c.x + c.w, Y(frame.y + frame.h) + 16, false);
    if (right.length > 1) for (const c of right) dimV(c.y, c.y + c.h, X(frame.x + frame.w) + 16, false);
  }
  return Y(frame.y + frame.h) + 34;
}

function planSection(doc, data, width) {
  const top = doc.y;
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#777").text("VUE DE FACE — cotes en mm (cote de commande L × H, couvre-joints en plus)", COL_X, top, { width });
  doc.y = drawElevation(doc, data.layout || [], data.L, data.H, top + 10, width, 330);
  const fab = data.fabrication;
  if (fab?.leaves?.length) {
    sectionTitle(doc, "VANTAUX", width);
    drawTable(doc, [
      { key: "c", label: "CASE", width: 45 },
      { key: "o", label: "OUVERTURE", width: 150 },
      { key: "d", label: "VANTAIL (mm)", width: 85, align: "right" },
      { key: "g", label: "VITRAGE (mm)", width: 85, align: "right" },
      { key: "p", label: "POIDS", width: 55, align: "right", bold: true },
      { key: "f", label: "FERRURE", width: 95 },
    ], fab.leaves.map((l) => ({
      c: `${l.no}${l.leaves === 2 ? `.${l.index + 1}` : ""}`,
      o: `${OPENING_LABELS[l.opening] || l.opening}${l.leaves === 2 ? (l.active ? " — principal" : " — semi-fixe") : ""}`,
      subtext: l.code,
      d: `${fmt(l.lw, 0)} × ${fmt(l.lh, 0)}`,
      g: l.infill === "none" ? "—" : `${fmt(l.gw, 0)} × ${fmt(l.gh, 0)}`,
      p: l.poids ? `${fmt(l.poids)} kg` : "—",
      f: Object.entries(l.fits || {}).map(([g, names]) => `${g} : ${names.filter(Boolean).join(", ") || "oui"}`).join("\n") || "—",
    })));
  }
  // "no glass composition chosen" once, instead of once per pane
  const noGlass = (data.warnings || []).filter((w) => /aucun modèle choisi/.test(w.message) && /Vitrage/.test(w.message));
  const issues = [
    ...(data.errors || []).map((e) => e.message),
    ...(noGlass.length ? ["Aucune composition de vitrage choisie : vitrages donnés en dimensions seulement (pas de plan de découpe des plateaux)"] : []),
    ...(data.warnings || []).filter((w) => !noGlass.includes(w)).map((w) => w.message),
    ...(fab?.checks || []).filter((c) => c.level === "info").map((c) => c.message),
  ];
  if (issues.length) {
    sectionTitle(doc, "CONTRÔLES", width);
    doc.fontSize(8).font("Helvetica").fillColor("#a15c00");
    for (const m of [...new Set(issues)]) doc.text(`•  ${m}`, COL_X, doc.y + 1, { width });
  }
}

// ------------------------------------------------------------------
// Liste de débit (by position)
// ------------------------------------------------------------------
function piecesSection(doc, data, width) {
  const pieces = data.fabrication?.pieces || [];
  if (!pieces.length) return emptyNote(doc, width, "Aucun profilé.");
  const byCode = new Map();
  for (const p of pieces) {
    if (!byCode.has(p.code)) byCode.set(p.code, []);
    byCode.get(p.code).push(p);
  }
  let n = 0;
  for (const [code, rows] of byCode) {
    sectionTitle(doc, `${code} — ${rows[0].productName || "profilé absent de la série"}`, width);
    drawTable(doc, [
      { key: "n", label: "POS.", width: 35 },
      { key: "d", label: "DÉSIGNATION", width: 205 },
      { key: "l", label: "LONG. (mm)", width: 70, align: "right", bold: true },
      { key: "a", label: "ANGLES", width: 60, align: "center" },
      { key: "q", label: "QTÉ", width: 45, align: "right", bold: true },
      { key: "u", label: "USINAGES", width: 100 },
    ], rows.map((p) => {
      n += 1;
      const [aL, aR] = parseAngles(p.angle);
      return { n: String(n), d: p.label, l: fmt(p.length), a: `${fmt(aL)}° / ${fmt(aR)}°`, q: fmt(p.totalQty, 3), u: p.ops.length ? p.ops.map((o) => `${o.label} ×${o.positions.length}`).join("\n") : "—" };
    }));
  }
}

// ------------------------------------------------------------------
// Fiche d'usinage: each piece drawn with its operations
// ------------------------------------------------------------------
function drawMachinedPiece(doc, p, width) {
  const ops = p.ops || [];
  const rowsH = ops.length * 10;
  ensureSpace(doc, 100 + rowsH + ops.length * 18);
  const [angleL, angleR] = parseAngles(p.angle);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#000").text(`${p.label}`, COL_X, doc.y, { width: width * 0.65, continued: false });
  doc.fontSize(8).font("Helvetica").fillColor("#555").text(`${p.code} · ${fmt(p.length)} mm · ${fmt(angleL)}°/${fmt(angleR)}° · × ${fmt(p.totalQty, 3)}`, COL_X, doc.y + 1, { width });
  const y0 = doc.y + 8;
  const h = 16;
  const k = width / Math.max(p.length, 1);
  const pts = piecePolygon(doc, COL_X, COL_X + width, y0, h, { angleL, angleR, longTop: true }, Math.max(3, h * 0.9));
  doc.lineWidth(0.6).polygon(...pts).fillAndStroke("#e9eef5", "#2f5fa8");
  ops.forEach((o, i) => {
    const color = MARK_COLORS[i % MARK_COLORS.length];
    for (const x of o.positions) {
      const px = COL_X + x * k;
      doc.lineWidth(1.1).strokeColor(color).moveTo(px, y0 - 3).lineTo(px, y0 + h + 3).stroke();
      const t = fmt(x);
      doc.fontSize(6.3).font("Helvetica-Bold").fillColor(color);
      const tw = doc.widthOfString(t);
      doc.text(t, Math.min(Math.max(COL_X, px - tw / 2), COL_X + width - tw), y0 + h + 5 + i * 10, { lineBreak: false });
    }
  });
  // legend: colour of each operation
  let lx = COL_X;
  let ly = y0 + h + 10 + rowsH;
  ops.forEach((o, i) => {
    const t = `${i + 1}. ${opText(o)}`;
    doc.fontSize(7).font("Helvetica");
    const tw = doc.widthOfString(t);
    if (lx > COL_X && lx + tw + 10 > COL_X + width) { lx = COL_X; ly += 11; }
    doc.rect(lx, ly + 1, 7, 7).fill(MARK_COLORS[i % MARK_COLORS.length]);
    doc.fillColor("#333").text(t, lx + 10, ly, { lineBreak: false });
    lx += tw + 24;
  });
  doc.y = ly + 14;
  drawTable(doc, [
    { key: "c", label: "N°", width: 28 },
    { key: "o", label: "OPÉRATION", width: 185 },
    { key: "p", label: "POSITIONS DEPUIS LA GAUCHE (mm)", width: 225 },
    { key: "t", label: "OUTIL", width: 77 },
  ], ops.map((o, i) => ({ c: String(i + 1), o: opText(o), p: o.positions.map((x) => fmt(x)).join(" · "), t: o.tool || "" })));
  doc.moveDown(0.6);
}

function machiningSection(doc, data, width) {
  const pieces = (data.fabrication?.pieces || []).filter((p) => p.ops?.length);
  if (!pieces.length) {
    return emptyNote(doc, width, data.fabrication?.rules?.machining
      ? "Aucun usinage ne s'applique à ce châssis."
      : "Aucun usinage défini : ajoutez les usinages (drainages, perçages, fraisages…) sur les fiches des profilés (Technique › Séries › profilé).");
  }
  doc.fontSize(7.5).font("Helvetica").fillColor("#666").text("Pièce vue de face, pointe longue en haut ; cotes depuis l'extrémité gauche (pointe à pointe).", COL_X, doc.y + 2, { width });
  doc.moveDown(0.6);
  for (const p of pieces) drawMachinedPiece(doc, p, width);
}

// ------------------------------------------------------------------
// Accessories (detail by rule + stock units)
// ------------------------------------------------------------------
function accessoriesDetail(doc, data, width) {
  const lines = (data.lines || []).filter((l) => l.fromRule);
  if (lines.length) {
    const groups = new Map();
    for (const l of lines) {
      const key = `${l.product}|${l.rule}|${l.ruleWhere}|${l.length || ""}`;
      if (!groups.has(key)) groups.set(key, { ...l, pieces: 0 });
      groups.get(key).pieces += l.pieces;
    }
    sectionTitle(doc, "DÉTAIL PAR RÈGLE DE LA SÉRIE", width);
    drawTable(doc, [
      { key: "a", label: "ARTICLE", width: 190 },
      { key: "w", label: "POUR", width: 175 },
      { key: "q", label: "QTÉ", width: 60, align: "right", bold: true },
      { key: "l", label: "LONG. (mm)", width: 90, align: "right" },
    ], [...groups.values()].map((g) => ({ a: g.productName || g.label, subtext: g.rule && g.rule !== g.productName ? g.rule : undefined, w: g.ruleWhere || "", q: fmt(g.pieces, 3), l: g.length ? fmt(g.length) : "" })));
  } else if (!data.fabrication?.rules?.accessories) {
    doc.moveDown(0.4);
    doc.fontSize(8).font("Helvetica-Oblique").fillColor("#777").text("Aucun accessoire défini : ajoutez ferrures, équerres, joints… sur les fiches des profilés et sur les nœuds de la série pour qu'ils soient calculés automatiquement.", COL_X, doc.y, { width });
  }
  sectionTitle(doc, "À PRÉPARER (unités de stock)", width);
  accessoriesSection(doc, data.report, width);
}

/**
 * { company, logoBuffer, name, series, L, H, quantity, finish, data (computeDesign), sections?, ref }
 */
function generateFabricationPdf({ company, logoBuffer, name, series, L, H, quantity, finish, data, sections, ref }) {
  const wanted = (sections && sections.length ? sections : SECTIONS).filter((s) => SECTIONS.includes(s));
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, `DOSSIER DE FABRICATION — ${String(name || "").toUpperCase()}`, { colX: COL_X, width, ref });
  drawPartyBlocks(doc, {
    label: "OUVRAGE",
    supplier: { name: name || "—", address: series ? `Série ${series.name}${series.supplier ? ` (${series.supplier})` : ""}` : "" },
    width,
    infoRows: [
      ["Dimensions", `${fmt(L, 0)} × ${fmt(H, 0)} mm`],
      ["Quantité", String(quantity)],
      ["Vitrage", data.glassType || ""],
      ["Couleur", finish ? `${finish.code}${finish.name ? ` ${finish.name}` : ""}` : ""],
      ["Imprimé le", formatDate(new Date())],
    ],
  });
  const full = { ...data, L, H };
  const titles = {
    pieces: "LISTE DE DÉBIT PAR POSITION", bars: "PLANS DE COUPE", machining: "FICHE D'USINAGE", accessories: "ACCESSOIRES, JOINTS, QUINCAILLERIE", glass: "VITRAGES",
  };
  wanted.forEach((s, i) => {
    if (s !== "plan" && (i > 0)) { doc.addPage(); doc.y = 50; }
    if (titles[s]) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor(docBrand(doc).primaryInk).text(titles[s], COL_X, doc.y, { width });
      doc.moveDown(0.3);
    }
    if (s === "plan") planSection(doc, full, width);
    else if (s === "pieces") piecesSection(doc, full, width);
    else if (s === "bars") barsSection(doc, data.report, width);
    else if (s === "machining") machiningSection(doc, full, width);
    else if (s === "accessories") accessoriesDetail(doc, full, width);
    else if (s === "glass") {
      const report = { ...data.report, panes: (data.panes || []).map((p) => ({ ref: `Case ${p.cells.join(", ")}`, label: p.type === "glass" ? data.glassType || "Vitrage" : "Panneau", L: p.width, H: p.height, quantity: p.qty })) };
      glassSection(doc, report, width);
    }
  });
  ensureSpace(doc, 70);
  doc.moveDown(1.2);
  const y = doc.y;
  const half = width / 2 - 10;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#333");
  doc.text("Préparé par (nom, date, visa)", COL_X, y, { width: half });
  doc.text("Contrôlé par (nom, date, visa)", COL_X + half + 20, y, { width: half });
  doc.moveTo(COL_X, y + 40).lineTo(COL_X + half, y + 40).strokeColor("#999").stroke();
  doc.moveTo(COL_X + half + 20, y + 40).lineTo(COL_X + width, y + 40).stroke();
  finalizeFooters(doc, company);
  return doc;
}

module.exports = { generateFabricationPdf, SECTIONS, drawElevation };
