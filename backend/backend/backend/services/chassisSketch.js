/**
 * ============================================================
 * CHASSIS SKETCH — the schematic of a chassis as plain shapes
 * ============================================================
 * Built from the model's `drawing` hint ({ type, leaves, opening,
 * solid, layers, parts, bars }), its L × H ratio and its parameters
 * (n leaves, nx × ny grid…). Returns a list of primitives that any
 * renderer can draw:
 *   { t: "rect", x, y, w, h, fill?, sw, dash? }
 *   { t: "line", x1, y1, x2, y2, sw, dash? }
 *   { t: "dot",  x, y, r }
 * `fill` is "glass" | "solid" | "ink" | undefined (no fill).
 *
 * The same file lives in frontend/src/utils/chassisSketch.js (SVG on
 * screen) — this copy draws it in the PDFs (devis, facture). Keep
 * both in sync.
 * ============================================================
 */

const DRAWING_TYPES = ["design", "sliding", "casement", "door", "folding", "fixed", "grid", "combo", "shutter", "louvre", "railing", "pergola", "glass", "garage", "panel", "cladding", "generic"];
const OPENINGS = ["", "ob", "soufflet", "projetant", "basculant", "pivotant"];

function sketchChassis({ drawing = {}, L = 1200, H = 1000, params = {}, width = 150, height = 130, pad = 6 }) {
  const d = drawing || {};
  const type = DRAWING_TYPES.includes(d.type) ? d.type : "generic";
  const ratio = Math.max(0.15, Math.min(6, (Number(L) || 1) / (Number(H) || 1)));
  let w = width - pad * 2;
  let h = w / ratio;
  if (h > height - pad * 2) { h = height - pad * 2; w = h * ratio; }
  const x0 = (width - w) / 2;
  const y0 = (height - h) / 2;
  const n = Math.max(1, Math.min(12, Math.round(Number(params.n) || Number(d.leaves) || 1)));
  const out = [];
  const rect = (x, y, rw, rh, o = {}) => out.push({ t: "rect", x, y, w: Math.max(0, rw), h: Math.max(0, rh), sw: 1.2, ...o });
  const line = (x1, y1, x2, y2, o = {}) => out.push({ t: "line", x1, y1, x2, y2, sw: 0.9, ...o });
  const pane = (x, y, rw, rh) => rect(x, y, rw, rh, { fill: "glass", sw: 0.8 });
  const dash = { dash: [3, 2], sw: 0.7 };
  const f = Math.max(3, Math.min(w, h) * 0.06);
  const outer = () => rect(x0, y0, w, h, { sw: 1.6 });

  switch (type) {
    // CAD design (Technique › Conception): its regions in mm, scaled into the box
    case "design": {
      const lay = Array.isArray(d.layout) ? d.layout : [];
      const fr = lay.find((r) => r.type === "frame");
      if (!fr) { outer(); break; }
      const sx = w / (fr.w || 1);
      const sy = h / (fr.h || 1);
      const X = (v) => x0 + (v - fr.x) * sx;
      const Y = (v) => y0 + (v - fr.y) * sy;
      const box = (r, o) => rect(X(r.x), Y(r.y), r.w * sx, r.h * sy, o);
      for (const r of lay) {
        if (r.type === "frame") box(r, { sw: 1.6 });
        else if (r.type === "jour") box(r, { sw: 0.8 });
        else if (r.type === "mullion" || r.type === "transom") box(r, { sw: 0.9 });
        else if (r.type === "glass") box(r, { fill: "glass", sw: 0.6 });
        else if (r.type === "panel") box(r, { fill: "solid", sw: 0.6 });
      }
      for (const r of lay.filter((x) => x.type === "leaf")) {
        box(r, { sw: 1 });
        const l = X(r.x); const t = Y(r.y); const rr = X(r.x + r.w); const b = Y(r.y + r.h);
        const side = String(r.opening || "");
        if (r.slide) { line(l + (rr - l) * 0.3, (t + b) / 2, l + (rr - l) * 0.7, (t + b) / 2); continue; }
        if (side.endsWith("left") || side.endsWith("right")) {
          const hinge = side.endsWith("left") ? l : rr;
          const free = side.endsWith("left") ? rr : l;
          line(free, t, hinge, (t + b) / 2, dash);
          line(free, b, hinge, (t + b) / 2, dash);
        }
        if (side.startsWith("tilt") || side === "bottom") { line(l, t, (l + rr) / 2, b, dash); line(rr, t, (l + rr) / 2, b, dash); }
        if (side === "top") { line(l, b, (l + rr) / 2, t, dash); line(rr, b, (l + rr) / 2, t, dash); }
      }
      break;
    }
    case "sliding": {
      outer();
      const lw = (w - 2 * f) / n;
      for (let i = 0; i < n; i += 1) {
        const x = x0 + f + i * lw;
        const off = i % 2 ? 2 : 0;
        rect(x, y0 + f + off, lw + (i < n - 1 ? 3 : 0), h - 2 * f - off, { sw: 1 });
        pane(x + f * 0.6, y0 + f * 1.6 + off, lw - f * 1.2, h - f * 3.2 - off);
        const cy = y0 + h / 2;
        const cx = x + lw / 2;
        const a = Math.min(lw * 0.22, 12);
        const tip = i % 2 ? -a : a;
        const back = i % 2 ? 4 : -4;
        line(cx - a, cy, cx + a, cy);
        line(cx + tip, cy, cx + tip + back, cy - 3);
        line(cx + tip, cy, cx + tip + back, cy + 3);
      }
      break;
    }
    case "casement":
    case "door":
    case "folding": {
      outer();
      const lw = (w - 2 * f) / n;
      const isDoor = type === "door";
      for (let i = 0; i < n; i += 1) {
        const x = x0 + f + i * lw;
        rect(x, y0 + f, lw, h - (isDoor ? f : 2 * f), { sw: 1 });
        if (d.solid) rect(x + f, y0 + 2 * f, lw - 2 * f, h - 4 * f, { fill: "solid", sw: 0.6 });
        else pane(x + f * 0.8, y0 + f * 1.8, lw - f * 1.6, h - (isDoor ? f * 2.8 : f * 3.6));
        const top = y0 + f;
        const bottom = y0 + h - (isDoor ? 0 : f);
        const opening = d.opening;
        if (opening === "soufflet") { line(x, bottom, x + lw / 2, top, dash); line(x + lw, bottom, x + lw / 2, top, dash); }
        else if (opening === "projetant") { line(x, top, x + lw / 2, bottom, dash); line(x + lw, top, x + lw / 2, bottom, dash); }
        else if (opening === "basculant" || opening === "pivotant") { line(x, y0 + h / 2, x + lw, y0 + h / 2, dash); }
        else {
          const hingeLeft = n === 1 ? true : i < n / 2;
          const hx = hingeLeft ? x : x + lw;
          const ox = hingeLeft ? x + lw : x;
          line(hx, top, ox, (top + bottom) / 2, dash);
          line(hx, bottom, ox, (top + bottom) / 2, dash);
          if (opening === "ob") { line(x, bottom, x + lw / 2, top, dash); line(x + lw, bottom, x + lw / 2, top, dash); }
          out.push({ t: "dot", x: hingeLeft ? x + lw - f * 1.4 : x + f * 1.4, y: (top + bottom) / 2, r: 1.8 });
        }
      }
      break;
    }
    case "grid": {
      outer();
      const nx = Math.max(1, Math.min(20, Math.round(Number(params.nx) || Number(d.nx) || 2)));
      const ny = Math.max(1, Math.min(20, Math.round(Number(params.ny) || Number(d.ny) || 1)));
      const cw = (w - 2 * f) / nx;
      const ch = (h - 2 * f) / ny;
      for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) pane(x0 + f + i * cw + 1, y0 + f + j * ch + 1, cw - 2, ch - 2);
      break;
    }
    case "combo": {
      outer();
      const parts = Array.isArray(d.parts) ? d.parts : [];
      if (parts.includes("left")) {
        const lf = Math.min(w / 3, ((Number(params.lf) || Number(L) / 4) / (Number(L) || 1)) * w);
        pane(x0 + f, y0 + f, lf - f, h - 2 * f);
        pane(x0 + w - lf, y0 + f, lf - f, h - 2 * f);
        rect(x0 + lf + 2, y0 + f, w - 2 * lf - 4, h - 2 * f, { sw: 1 });
        line(x0 + lf + 2, y0 + f, x0 + w / 2, y0 + h / 2, dash);
        line(x0 + lf + 2, y0 + h - f, x0 + w / 2, y0 + h / 2, dash);
      } else {
        const part = Number(params.hi || params.ha) || Number(H) / 4;
        const ph = Math.min(h / 2, (part / (Number(H) || 1)) * h);
        const top = parts[0] === "bottom" ? ph : h - ph;
        pane(x0 + f, y0 + f, w - 2 * f, top - f - 2);
        pane(x0 + f, y0 + top + 2, w - 2 * f, h - top - f - 2);
        line(x0, y0 + top, x0 + w, y0 + top, { sw: 1.4 });
      }
      break;
    }
    case "shutter": {
      const box = Math.min(h * 0.14, 18);
      rect(x0, y0, w, box, { fill: "solid" });
      rect(x0, y0 + box, w, h - box);
      for (let y = y0 + box + 5; y < y0 + h - 2; y += 5) line(x0 + 2, y, x0 + w - 2, y, { sw: 0.5 });
      break;
    }
    case "louvre": {
      outer();
      for (let y = y0 + f + 4; y < y0 + h - f; y += 6) line(x0 + f, y + 2, x0 + w - f, y - 2, { sw: 0.7 });
      break;
    }
    case "railing": {
      const ent = Number(params.ent) || 1200;
      const posts = Math.max(1, Math.min(40, Math.ceil((Number(L) || 1) / ent)));
      line(x0, y0 + 2, x0 + w, y0 + 2, { sw: 2.2 });
      line(x0, y0 + h - 3, x0 + w, y0 + h - 3, { sw: 1 });
      for (let i = 0; i <= posts; i += 1) line(x0 + (i * w) / posts, y0 + 2, x0 + (i * w) / posts, y0 + h, { sw: 1.8 });
      if (d.bars) for (let x = x0 + 6; x < x0 + w; x += 6) line(x, y0 + 6, x, y0 + h - 3, { sw: 0.5 });
      else for (let i = 0; i < posts; i += 1) pane(x0 + (i * w) / posts + 3, y0 + 8, w / posts - 6, h - 14);
      break;
    }
    case "pergola": {
      outer();
      for (let y = y0 + 5; y < y0 + h; y += 5) line(x0 + 2, y, x0 + w - 2, y, { sw: 0.5 });
      [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].forEach(([x, y]) => rect(x - 3, y - 3, 6, 6, { fill: "ink", sw: 0 }));
      break;
    }
    case "glass": {
      const layers = Math.max(1, Math.min(4, Number(d.layers) || 1));
      for (let i = 0; i < layers; i += 1) pane(x0 + i * 5, y0 + i * 5, w - (layers - 1) * 5, h - (layers - 1) * 5);
      break;
    }
    case "garage": {
      outer();
      for (let y = y0 + h / 5; y < y0 + h - 1; y += h / 5) line(x0, y, x0 + w, y, { sw: 0.7 });
      break;
    }
    case "fixed":
      outer();
      pane(x0 + f, y0 + f, w - 2 * f, h - 2 * f);
      break;
    case "panel":
    case "cladding":
      rect(x0, y0, w, h, { fill: "solid" });
      if (type === "cladding") for (let x = x0 + w / 4; x < x0 + w - 1; x += w / 4) line(x, y0, x, y0 + h, { sw: 0.6 });
      break;
    default:
      outer();
      line(x0, y0, x0 + w, y0 + h, { sw: 0.5 });
      line(x0 + w, y0, x0, y0 + h, { sw: 0.5 });
  }
  return { shapes: out, box: { x: x0, y: y0, w, h } };
}

/**
 * Draws the sketch into a pdfkit document at (x, y), inside a w × h box,
 * with the L and H dimensions written along the bottom and right side.
 */
function drawSketchPdf(doc, { x, y, width, height, drawing, L, H, params, dimensions = true }) {
  const dimSpace = dimensions ? 9 : 0;
  const { shapes, box } = sketchChassis({ drawing, L, H, params, width: width - dimSpace, height: height - dimSpace, pad: 2 });
  doc.save();
  doc.translate(x, y);
  for (const s of shapes) {
    if (s.dash) doc.dash(s.dash[0], { space: s.dash[1] }); else doc.undash();
    doc.lineWidth(Math.max(0.3, (s.sw || 1) * 0.7));
    if (s.t === "rect") {
      doc.rect(s.x, s.y, s.w, s.h);
      if (s.fill === "glass") doc.fillAndStroke("#dce9fb", "#4a4a4a");
      else if (s.fill === "solid") doc.fillAndStroke("#eeeeee", "#4a4a4a");
      else if (s.fill === "ink") doc.fill("#4a4a4a");
      else doc.stroke("#4a4a4a");
    } else if (s.t === "line") {
      doc.moveTo(s.x1, s.y1).lineTo(s.x2, s.y2).stroke("#4a4a4a");
    } else if (s.t === "dot") {
      doc.circle(s.x, s.y, s.r * 0.8).fill("#4a4a4a");
    }
  }
  doc.undash();
  if (dimensions) {
    const fmt = (v) => String(Math.round(Number(v) || 0));
    doc.lineWidth(0.3).strokeColor("#999");
    const by = box.y + box.h + 3;
    doc.moveTo(box.x, by).lineTo(box.x + box.w, by).stroke();
    const bx = box.x + box.w + 3;
    doc.moveTo(bx, box.y).lineTo(bx, box.y + box.h).stroke();
    doc.fontSize(5.5).font("Helvetica").fillColor("#555");
    doc.text(fmt(L), box.x, by + 1, { width: box.w, align: "center", lineBreak: false });
    doc.save();
    doc.rotate(-90, { origin: [bx + 1, box.y + box.h] });
    doc.text(fmt(H), bx + 1, box.y + box.h, { width: box.h, align: "center", lineBreak: false });
    doc.restore();
  }
  doc.restore();
  doc.fillColor("#000").strokeColor("#000").lineWidth(1);
}

module.exports = { sketchChassis, drawSketchPdf, DRAWING_TYPES, OPENINGS };
