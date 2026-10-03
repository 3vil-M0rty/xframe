const PDFDocument = require("pdfkit");
const { formatDate, drawLetterhead, docBrand, drawDocumentTitle, finalizeFooters } = require("./pdfHelpers");
const { drawPartyBlocks, drawTable, ensureSpace, COL_X } = require("./purchasingPdfService");

/**
 * ============================================================
 * WORKSHOP PRINTOUTS — one paper per kind of material
 * ============================================================
 *   bars         débit des barres: cut list + bar-by-bar plan drawn to
 *                scale (blade, start / end of bar, offcuts)
 *   accessories  accessories, gaskets, consumables to prepare (checklist)
 *   powder       powder per colour + bars to lacquer
 *   glass        panes to assemble + glass cut list + plateau layouts
 * Built from services/cuttingReport.js, for one work order or a whole project.
 * ============================================================
 */
const SECTIONS = {
  bars: "DÉBIT DES BARRES",
  accessories: "ACCESSOIRES À PRÉPARER",
  powder: "POUDRE & LAQUAGE",
  glass: "VITRAGE — DÉBIT DES PLATEAUX",
  labels: "ÉTIQUETTES",
};
const TYPE_LABELS = {
  accessory: "Accessoires", gasket: "Joints", consumable: "Consommables", panel: "Tôles, panneaux, films",
  profile: "Profilés (hors débit)", glass: "Verre", other: "Autres",
};

const fmt = (n, d = 1) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(d).replace(/\.?0+$/, "");
};
const qty = (n) => fmt(n, 3);
const finishText = (f) => (f ? `${f.code}${f.name ? ` ${f.name}` : ""}` : "");

function sectionTitle(doc, text, width, subtitle) {
  ensureSpace(doc, 70);
  doc.moveDown(0.8);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(docBrand(doc).primaryInk).text(text, COL_X, doc.y, { width });
  if (subtitle) doc.fontSize(7.5).font("Helvetica").fillColor("#666").text(subtitle, COL_X, doc.y + 1, { width });
  doc.moveDown(0.35);
}

function emptyNote(doc, width, text) {
  doc.moveDown(0.6);
  doc.fontSize(9).font("Helvetica-Oblique").fillColor("#777").text(text, COL_X, doc.y, { width });
}

// ------------------------------------------------------------------
// Bars
// ------------------------------------------------------------------
const angleText = (c) => `${fmt(c.angleL ?? 90)}° / ${fmt(c.angleR ?? 90)}°`;
const barsLabel = (p) => (p.count > 1 ? `Barres ${p.firstBar} à ${p.lastBar}` : `Barre ${p.firstBar}`);

/** A piece drawn with its real end cuts (mitres as slanted ends, long side top or bottom). */
function piecePolygon(doc, x0, x1, y0, h, c, offPx) {
  const off = (a) => (a === 90 || a === undefined ? 0 : offPx / Math.tan((a * Math.PI) / 180));
  const oL = Math.min(off(c.angleL), (x1 - x0) / 2);
  const oR = Math.min(off(c.angleR), (x1 - x0) / 2);
  const top = y0;
  const bot = y0 + h;
  if (c.longTop) return [[x0, top], [x1, top], [x1 - oR, bot], [x0 + oL, bot]];
  return [[x0 + oL, top], [x1 - oR, top], [x1, bot], [x0, bot]];
}

function drawBar(doc, pattern, barLength, s, width, depth) {
  const h = 18;
  const seqText = pattern.cuts.map((c) => `${c.n}) ${fmt(c.length)} ${fmt(c.angleL ?? 90)}/${fmt(c.angleR ?? 90)}${c.nested ? " TB" : ""}${c.ref ? ` ${c.ref}` : ""}${c.label ? ` ${c.label}` : ""}`).join("   ");
  doc.fontSize(6.8).font("Helvetica");
  const seqH = doc.heightOfString(seqText, { width: width - 4 });
  ensureSpace(doc, h + 48 + seqH);
  const y0 = doc.y + 22;
  const k = width / barLength;
  const offPx = depth > 0 ? Math.max(3, depth * k) : h * 0.55;
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#000").text(`${barsLabel(pattern)}  (× ${pattern.count})`, COL_X, y0 - 21, { width: width / 2, lineBreak: false });
  doc.fontSize(7.5).font("Helvetica").fillColor(pattern.reusable ? "#2e7d32" : "#555")
    .text(`chute ${fmt(pattern.offcut)} mm${pattern.reusable ? " — à garder" : ""}`, COL_X + width / 2, y0 - 21, { width: width / 2, align: "right", lineBreak: false });
  doc.lineWidth(0.6).rect(COL_X, y0, width, h).fillAndStroke("#f3f3f3", "#888");
  if (s.trim > 0) doc.rect(COL_X, y0, Math.max(0.8, s.trim * k), h).fill("#c9c9c9");
  if (s.endTrim > 0) doc.rect(COL_X + width - Math.max(0.8, s.endTrim * k), y0, Math.max(0.8, s.endTrim * k), h).fill("#c9c9c9");
  const last = pattern.cuts[pattern.cuts.length - 1];
  const lastEnd = last ? last.pos + last.length : s.trim;
  const offStart = COL_X + (lastEnd + s.kerf) * k;
  const offW = COL_X + width - (s.endTrim * k) - offStart;
  if (offW > 2 && pattern.offcut > 0) doc.rect(offStart, y0, offW, h).fill(pattern.reusable ? "#e3f4e1" : "#fbe9e7");
  for (const c of pattern.cuts) {
    const x0 = COL_X + c.pos * k;
    const x1 = COL_X + (c.pos + c.length) * k;
    const pts = piecePolygon(doc, x0, x1, y0, h, c, offPx);
    doc.lineWidth(0.6).polygon(...pts).fillAndStroke(c.nested ? "#cfe0ff" : "#d6e6ff", "#2f5fa8");
    const cw = x1 - x0;
    const label = fmt(c.length);
    doc.fontSize(6.6).font("Helvetica-Bold").fillColor("#0d2a55");
    if (doc.widthOfString(label) + 6 < cw) doc.text(label, x0, y0 + 6, { width: cw, align: "center", lineBreak: false });
    // cut number above the piece
    doc.fontSize(6).font("Helvetica-Bold").fillColor("#333").text(String(c.n), x0 + cw / 2 - 6, y0 - 8.5, { width: 12, align: "center", lineBreak: false });
  }
  doc.lineWidth(0.6).rect(COL_X, y0, width, h).stroke("#888");
  doc.fontSize(6.8).font("Helvetica").fillColor("#333").text(seqText, COL_X + 2, y0 + h + 4, { width: width - 4 });
  doc.y = Math.max(doc.y, y0 + h + 10) + 6;
}

// ------------------------------------------------------------------
// Machining (usinages) of the cut pieces — from the series' rules
// ------------------------------------------------------------------
const OP_LABELS = { drain: "Drainage", drill: "Perçage", mill: "Fraisage", slot: "Lumière", notch: "Entaille", other: "Usinage" };
const FACE_LABELS = { ext: "face ext.", int: "face int.", top: "dessus", bottom: "dessous", side: "chant" };
const opText = (o) => [o.label || OP_LABELS[o.kind] || "Usinage", o.size, FACE_LABELS[o.face]].filter(Boolean).join(" · ");

function machiningTable(doc, cuts, width) {
  const rows = [];
  for (const c of cuts) for (const o of c.ops || []) rows.push({ r: c.ref || "", d: `${fmt(c.length)} — ${c.label || ""}`, o: opText(o), p: o.positions.map((x) => fmt(x)).join(" · "), t: o.tool || "" });
  if (!rows.length) return;
  sectionTitle(doc, "USINAGES (cotes depuis l'extrémité gauche de la pièce)", width);
  drawTable(doc, [
    { key: "r", label: "REPÈRE", width: 45 },
    { key: "d", label: "PIÈCE", width: 160 },
    { key: "o", label: "OPÉRATION", width: 130 },
    { key: "p", label: "POSITIONS (mm)", width: 125 },
    { key: "t", label: "OUTIL", width: 55 },
  ], rows);
}

function barsSection(doc, report, width) {
  const s = report.settings;
  doc.moveDown(0.4);
  doc.fontSize(8).font("Helvetica").fillColor("#444")
    .text(`Réglages : lame ${fmt(s.kerf)} mm · début de barre ${fmt(s.trim)} mm · fin de barre ${fmt(s.endTrim)} mm · espace entre coupes ${fmt(s.spacing)} mm · chute à garder dès ${fmt(s.minReusableOffcut)} mm · onglets tête-bêche ${s.nest ? "oui" : "non"}`, COL_X, doc.y, { width });
  doc.fontSize(7.5).fillColor("#666").text("Longueurs pointe à pointe (cotes extérieures, couvre-joint compris). Talon = cote aux pointes courtes. TB = pièce retournée (onglet tête-bêche : une seule coupe pour deux pièces).", COL_X, doc.y + 2, { width });
  if (!report.bars.length) return emptyNote(doc, width, "Aucun profilé à débiter.");
  sectionTitle(doc, "RÉCAPITULATIF DES BARRES", width);
  drawTable(doc, [
    { key: "p", label: "PROFILÉ", width: 215 },
    { key: "l", label: "BARRE (mm)", width: 65, align: "right" },
    { key: "n", label: "PIÈCES", width: 50, align: "right" },
    { key: "b", label: "BARRES", width: 55, align: "right", bold: true },
    { key: "e", label: "RENDEMENT", width: 65, align: "right" },
    { key: "s", label: "STOCK", width: 65, align: "right" },
  ], report.bars.map((b) => ({
    p: b.name,
    subtext: [b.ref && `Réf. ${b.ref}`, b.finish && `Couleur ${finishText(b.finish)}`, b.workshop].filter(Boolean).join("   ") || undefined,
    l: b.barLength ? fmt(b.barLength) : "—",
    n: qty(b.cuts.reduce((a, c) => a + c.qty, 0)),
    b: b.plan ? qty(b.plan.bars) : `${fmt(b.totalLength / 1000, 2)} m`,
    e: b.plan ? `${fmt(b.plan.efficiency)} %` : "",
    s: b.stock === null || b.stock === undefined ? "" : qty(b.stock),
  })));

  for (const b of report.bars) {
    doc.addPage();
    doc.y = 50;
    sectionTitle(doc, `${b.name}${b.ref ? `  (${b.ref})` : ""}${b.finish ? `  —  ${finishText(b.finish)}` : ""}`, width,
      [b.barLength && `Barre de ${fmt(b.barLength)} mm`, b.depth ? `profilé : chambre ${fmt(b.geometry?.ch)} + ailette ext. ${fmt(b.geometry?.ae)} + ailette int. ${fmt(b.geometry?.ai)} = hauteur ${fmt(b.depth)} mm${b.geometry?.lp ? ` · largeur ${fmt(b.geometry.lp)} mm` : ""}` : "géométrie du profilé non renseignée (pas de talon ni de tête-bêche)", b.plan && `${b.plan.bars} barre(s) · rendement ${fmt(b.plan.efficiency)} %`, b.plan?.savedByNesting ? `${fmt(b.plan.savedByNesting)} mm gagnés en tête-bêche` : null, b.plan?.reusableOffcuts ? `${b.plan.reusableOffcuts} chute(s) à garder` : null, b.workshop].filter(Boolean).join("  ·  "));
    drawTable(doc, [
      { key: "r", label: "REPÈRE", width: 50 },
      { key: "d", label: "DÉSIGNATION", width: 205 },
      { key: "l", label: "LONG. POINTES", width: 75, align: "right", bold: true },
      { key: "t", label: "TALON", width: 55, align: "right" },
      { key: "a", label: "ANGLES", width: 75, align: "center" },
      { key: "q", label: "QTÉ", width: 55, align: "right", bold: true },
    ], b.cuts.map((c) => ({ r: c.ref || "", d: c.label || "", l: fmt(c.length), t: c.heel !== null && c.heel !== undefined ? fmt(c.heel) : "—", a: angleText(c), q: qty(c.qty) })));
    machiningTable(doc, b.cuts, width);
    if (b.plan) {
      sectionTitle(doc, "PLAN DE COUPE (ordre des coupes de gauche à droite)", width);
      for (const p of b.plan.patterns) drawBar(doc, p, b.plan.barLength, b.plan.settings, width, b.depth);
      if (b.plan.oversize.length) {
        doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#b23b2b").text(`${b.plan.oversize.length} pièce(s) plus longue(s) que la barre : ${b.plan.oversize.map((o) => `${fmt(o.length)}${o.ref ? ` ${o.ref}` : ""}`).join(", ")} — à raccorder ou barre plus longue`, COL_X, doc.y, { width });
      }
      sectionTitle(doc, "RÉGLAGE DE BUTÉE (une longueur = un réglage)", width);
      drawTable(doc, [
        { key: "l", label: "LONGUEUR (mm)", width: 100, align: "right", bold: true },
        { key: "a", label: "ANGLES", width: 90, align: "center" },
        { key: "q", label: "QTÉ", width: 60, align: "right", bold: true },
        { key: "r", label: "REPÈRES", width: 175 },
        { key: "c", label: "FAIT", width: 90, align: "center" },
      ], b.plan.sawList.map((x) => { const [aL, aR] = String(x.angle).split("/"); return { l: fmt(x.length), a: `${aL}° / ${aR}°`, q: qty(x.qty), r: x.refs.join(", "), c: "[   ]" }; }));
    }
  }
}

// ------------------------------------------------------------------
// Labels (étiquettes) — one per piece, 3 × 8 per A4
// ------------------------------------------------------------------
function labelsSection(doc, report, width, header) {
  const labels = [];
  for (const b of report.bars) {
    if (!b.plan) continue;
    for (const p of b.plan.patterns) {
      for (let bar = p.firstBar; bar <= p.lastBar; bar += 1) {
        for (const c of p.cuts) labels.push({ title: `${fmt(c.length)} mm`, sub: `${fmt(c.angleL)}°/${fmt(c.angleR)}°${c.nested ? " TB" : ""}`, ref: c.ref, line1: c.label, line2: `${b.name}${b.finish ? ` — ${b.finish.code}` : ""}`, tag: `B${bar}-${c.n}` });
      }
    }
  }
  for (const g of report.glass) {
    for (const pc of g.pieceList || []) {
      for (let i = 0; i < (pc.qty || 0); i += 1) labels.push({ title: `${fmt(pc.width)} × ${fmt(pc.height)}`, sub: "verre", ref: pc.ref, line1: pc.label, line2: g.name, tag: "VIT" });
    }
  }
  if (!labels.length) return emptyNote(doc, width, "Aucune pièce.");
  const cols = 3;
  const rows = 8;
  const gap = 6;
  const lw = (width - gap * (cols - 1)) / cols;
  const top0 = 50;
  const lh = (doc.page.height - top0 - 70 - gap * (rows - 1)) / rows;
  labels.forEach((l, i) => {
    const slot = i % (cols * rows);
    if (slot === 0) { doc.addPage(); }
    const x = COL_X + (slot % cols) * (lw + gap);
    const y = top0 + Math.floor(slot / cols) * (lh + gap);
    doc.lineWidth(0.5).roundedRect(x, y, lw, lh, 4).stroke("#999");
    doc.fontSize(7).font("Helvetica").fillColor("#666").text(header.partyName || "", x + 6, y + 5, { width: lw - 50, lineBreak: false, ellipsis: true });
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#333").text(l.tag, x + lw - 46, y + 5, { width: 40, align: "right", lineBreak: false });
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#000").text(l.title, x + 6, y + 17, { width: lw - 12, lineBreak: false });
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0d2a55").text(`${l.ref || ""}   ${l.sub}`, x + 6, y + 35, { width: lw - 12, lineBreak: false, ellipsis: true });
    doc.fontSize(7).font("Helvetica").fillColor("#333").text(l.line1 || "", x + 6, y + 48, { width: lw - 12, lineBreak: false, ellipsis: true });
    doc.fontSize(6.5).fillColor("#666").text(l.line2 || "", x + 6, y + 58, { width: lw - 12, lineBreak: false, ellipsis: true });
  });
}

// ------------------------------------------------------------------
// Accessories
// ------------------------------------------------------------------
function accessoriesSection(doc, report, width) {
  if (!report.accessories.length) return emptyNote(doc, width, "Aucun accessoire.");
  const groups = new Map();
  for (const a of report.accessories) {
    const t = TYPE_LABELS[a.type] ? a.type : "other";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(a);
  }
  for (const [type, rows] of groups) {
    sectionTitle(doc, TYPE_LABELS[type].toUpperCase(), width);
    // the article first: its reference line (subtext) goes under the first column
    drawTable(doc, [
      { key: "p", label: "ARTICLE", width: 270 },
      { key: "q", label: "QUANTITÉ", width: 70, align: "right", bold: true },
      { key: "u", label: "UNITÉ", width: 70 },
      { key: "s", label: "STOCK", width: 70, align: "right" },
      { key: "c", label: "OK", width: 35, align: "center" },
    ], rows.map((a) => ({
      c: "[   ]",
      p: a.name,
      subtext: [a.ref && `Réf. ${a.ref}`, a.finish && `Couleur ${finishText(a.finish)}`, a.workshop, a.warning].filter(Boolean).join("   ") || undefined,
      q: qty(a.theoretical),
      u: a.unit || "",
      s: a.stock === null || a.stock === undefined ? "" : qty(a.stock),
    })));
  }
}

// ------------------------------------------------------------------
// Powder & lacquering
// ------------------------------------------------------------------
function powderSection(doc, report, width) {
  if (!report.powder.length && !report.lacquerOutputs.length && !report.lacquer.length) return emptyNote(doc, width, "Rien à laquer.");
  if (report.powder.length) {
    sectionTitle(doc, "POUDRE", width);
    drawTable(doc, [
      { key: "p", label: "POUDRE", width: 260 },
      { key: "s", label: "SURFACE (m²)", width: 85, align: "right" },
      { key: "k", label: "PRÉVU (kg)", width: 80, align: "right", bold: true },
      { key: "c", label: "UTILISÉ (kg)", width: 90, align: "right" },
    ], report.powder.map((p) => ({
      p: p.name,
      subtext: [p.ref && `Réf. ${p.ref}`, p.label !== p.name ? p.label : null, p.workshop, p.warning].filter(Boolean).join("   ") || undefined,
      s: p.surface ? fmt(p.surface, 2) : "",
      k: qty(p.theoretical),
      c: p.consumed ? qty(p.consumed) : "…………",
    })));
  }
  if (report.lacquerOutputs.length) {
    sectionTitle(doc, "BARRES À LAQUER", width);
    drawTable(doc, [
      { key: "p", label: "ARTICLE BRUT", width: 240 },
      { key: "f", label: "COULEUR", width: 120 },
      { key: "q", label: "QTÉ", width: 60, align: "right", bold: true },
      { key: "s", label: "SURFACE (m²)", width: 95, align: "right" },
    ], report.lacquerOutputs.map((o) => ({
      p: o.name, subtext: [o.ref && `Réf. ${o.ref}`, o.order].filter(Boolean).join("   ") || undefined,
      f: finishText(o.finish), q: qty(o.quantity), s: o.paintSurface ? fmt(o.paintSurface, 2) : "",
    })));
  } else if (report.lacquer.length) {
    sectionTitle(doc, "BARRES À LAQUER", width);
    drawTable(doc, [
      { key: "p", label: "ARTICLE", width: 340 },
      { key: "q", label: "QTÉ", width: 80, align: "right", bold: true },
      { key: "u", label: "UNITÉ", width: 95 },
    ], report.lacquer.map((o) => ({ p: o.name, subtext: o.ref ? `Réf. ${o.ref}` : undefined, q: qty(o.theoretical), u: o.unit })));
  }
}

// ------------------------------------------------------------------
// Glass
// ------------------------------------------------------------------
function drawSheet(doc, pattern, W, H, settings, width) {
  const maxH = 210;
  const k = Math.min(width / W, maxH / H);
  const w = W * k;
  const h = H * k;
  ensureSpace(doc, h + 30);
  const y0 = doc.y;
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#000").text(`× ${pattern.count}   ·   occupation ${fmt(pattern.efficiency)} %`, COL_X, y0, { width });
  const top = y0 + 13;
  doc.lineWidth(0.7).rect(COL_X, top, w, h).fillAndStroke("#f4f4f4", "#777");
  if (settings?.edgeTrim > 0) {
    const e = settings.edgeTrim * k;
    doc.save().lineWidth(0.4).dash(2, { space: 2 }).rect(COL_X + e, top + e, w - 2 * e, h - 2 * e).stroke("#aaa").undash().restore();
  }
  for (const p of pattern.pieces) {
    const x = COL_X + p.x * k;
    const y = top + p.y * k;
    const pw = p.w * k;
    const ph = p.h * k;
    doc.lineWidth(0.5).rect(x, y, pw, ph).fillAndStroke("#d8f1f4", "#2b8a96");
    const dims = `${fmt(p.rotated ? p.h : p.w)} × ${fmt(p.rotated ? p.w : p.h)}`;
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#0b4c55");
    if (doc.widthOfString(dims) + 4 < pw && ph > 10) {
      doc.text(dims, x, y + ph / 2 - (p.ref && ph > 20 ? 7 : 3), { width: pw, align: "center", lineBreak: false });
      if (p.ref && ph > 20) doc.fontSize(6).font("Helvetica").fillColor("#333").text(`${p.ref}${p.rotated ? " (tourné)" : ""}`, x, y + ph / 2 + 1, { width: pw, align: "center", lineBreak: false });
    }
  }
  doc.fontSize(6.5).font("Helvetica").fillColor("#666").text(`${fmt(W)} × ${fmt(H)} mm`, COL_X, top + h + 2, { width: w });
  doc.y = top + h + 14;
}

function glassSection(doc, report, width) {
  const s = report.settings;
  doc.moveDown(0.4);
  doc.fontSize(8).font("Helvetica").fillColor("#444")
    .text(`Réglages : bord de plateau ${fmt(s.edgeTrim)} mm · trait de coupe ${fmt(s.gap)} mm · rotation ${s.allowRotation ? "autorisée" : "interdite"}`, COL_X, doc.y, { width });
  if (!report.glass.length && !report.panes.length) return emptyNote(doc, width, "Aucun vitrage.");

  if (report.panes.length) {
    sectionTitle(doc, "VITRAGES À FABRIQUER", width);
    drawTable(doc, [
      { key: "r", label: "REPÈRE", width: 55 },
      { key: "d", label: "COMPOSITION / EMPLACEMENT", width: 300 },
      { key: "l", label: "L (mm)", width: 55, align: "right" },
      { key: "h", label: "H (mm)", width: 55, align: "right" },
      { key: "q", label: "QTÉ", width: 50, align: "right", bold: true },
    ], report.panes.map((p) => ({ r: p.ref, d: p.label, l: p.L ? fmt(p.L) : "", h: p.H ? fmt(p.H) : "", q: qty(p.quantity) })));
  }

  if (report.glass.length) {
    sectionTitle(doc, "PLATEAUX À UTILISER", width);
    drawTable(doc, [
      { key: "p", label: "PLATEAU", width: 210 },
      { key: "f", label: "FORMAT", width: 85 },
      { key: "n", label: "VERRES", width: 50, align: "right" },
      { key: "m", label: "m²", width: 50, align: "right" },
      { key: "q", label: "PLATEAUX", width: 60, align: "right", bold: true },
      { key: "e", label: "OCCUP.", width: 60, align: "right" },
    ], report.glass.map((g) => ({
      p: g.name,
      subtext: [g.label, g.toBuy ? `${g.toBuy} à acheter` : null, g.stock !== null && g.stock !== undefined ? `stock ${qty(g.stock)}` : null].filter(Boolean).join("   ") || undefined,
      f: g.plan ? `${fmt(g.plan.sheetWidth)} × ${fmt(g.plan.sheetHeight)}` : "—",
      n: qty(g.pieces),
      m: fmt(g.area, 2),
      q: g.plan ? qty(g.plan.count) : `${qty(g.theoretical)} ${g.unit || ""}`,
      e: g.plan ? `${fmt(g.plan.efficiency)} %` : "",
    })));

    for (const g of report.glass) {
      sectionTitle(doc, `${g.name}${g.ref ? `  (${g.ref})` : ""}`, width,
        [g.label, g.plan && `${g.plan.count} plateau(x) ${fmt(g.plan.sheetWidth)} × ${fmt(g.plan.sheetHeight)} · occupation ${fmt(g.plan.efficiency)} %`, g.warning].filter(Boolean).join("  ·  "));
      drawTable(doc, [
        { key: "r", label: "REPÈRE", width: 60 },
        { key: "d", label: "VERRE", width: 255 },
        { key: "l", label: "L (mm)", width: 70, align: "right", bold: true },
        { key: "h", label: "H (mm)", width: 70, align: "right", bold: true },
        { key: "q", label: "QTÉ", width: 60, align: "right", bold: true },
      ], [...g.pieceList].sort((a, b) => String(a.ref).localeCompare(String(b.ref)) || b.width - a.width).map((p) => ({ r: p.ref || "", d: p.label || "", l: fmt(p.width), h: fmt(p.height), q: qty(p.qty) })));
      if (g.plan) {
        doc.moveDown(0.5);
        for (const p of g.plan.patterns) drawSheet(doc, p, g.plan.sheetWidth, g.plan.sheetHeight, g.plan.settings, width);
        if (g.plan.unfit) doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#b23b2b").text(`${g.plan.unfit} verre(s) plus grand(s) que le plateau`, COL_X, doc.y, { width });
      }
    }
  }
}

/**
 * header = { title, ref, partyLabel, partyName, address, contact, rows: [[label, value]] }
 */
function generateCuttingPdf({ section, report, header = {}, company, logoBuffer }) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { width } = drawLetterhead(doc, company, { logoBuffer });
  drawDocumentTitle(doc, `${SECTIONS[section] || section}${header.title ? ` — ${String(header.title).toUpperCase()}` : ""}`, { colX: COL_X, width, ref: header.ref });
  drawPartyBlocks(doc, {
    label: header.partyLabel || "PROJET",
    supplier: { name: header.partyName || "—", address: header.address, contactName: header.contact },
    width,
    infoRows: [["Imprimé le", formatDate(new Date())], ...(header.rows || [])],
  });
  if (section === "bars") barsSection(doc, report, width);
  else if (section === "accessories") accessoriesSection(doc, report, width);
  else if (section === "powder") powderSection(doc, report, width);
  else if (section === "glass") glassSection(doc, report, width);
  else if (section === "labels") labelsSection(doc, report, width, header);

  if (section !== "labels") {
    ensureSpace(doc, 70);
    doc.moveDown(1.2);
    const y = doc.y;
    const half = width / 2 - 10;
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#333");
    doc.text("Préparé par (nom, date, visa)", COL_X, y, { width: half });
    doc.text("Contrôlé par (nom, date, visa)", COL_X + half + 20, y, { width: half });
    doc.moveTo(COL_X, y + 40).lineTo(COL_X + half, y + 40).strokeColor("#999").stroke();
    doc.moveTo(COL_X + half + 20, y + 40).lineTo(COL_X + width, y + 40).stroke();
  }
  finalizeFooters(doc, company);
  return doc;
}

module.exports = {
  generateCuttingPdf, SECTIONS,
  // building blocks reused by the CAD fabrication file (services/fabricationPdfService.js)
  barsSection, glassSection, accessoriesSection, sectionTitle, emptyNote, machiningTable, piecePolygon, OP_LABELS, FACE_LABELS, opText, fmt,
};
