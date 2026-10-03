/**
 * ============================================================
 * PROFILE SECTION (coupe DXF d'un profilé)
 * ============================================================
 * Each aluminium profile article carries the DXF of its cross-section,
 * as supplied by the system house (Schüco, Technal, Reynaers…). This
 * module turns the DXF into a clean, light geometry the CAD can draw,
 * snap on and measure:
 *
 *   parse()      DXF text → pieces (polylines, arcs tessellated) per layer:
 *                LINE, LWPOLYLINE / POLYLINE (with bulges), ARC, CIRCLE,
 *                ELLIPSE, SPLINE, INSERT (blocks exploded, nested);
 *                dimensions, texts and hatches are ignored
 *   build()      pieces + orientation (rotation ¼ turns, mirrors) + layer
 *                choice → normalised paths (bbox min at 0,0), the closed
 *                contours chained from loose segments, and the metrics:
 *                  width   in-plane size (X)  → profileHeight (hp)
 *                  height  depth (Y)          → profileWidth  (lp)
 *                  area    section (mm², even-odd over the contours)
 *                  kgm     area × 2.7 g/cm³ (aluminium)
 *                  outerPerimeter  perimeter of the outer contour(s) →
 *                          surface laquable per metre (perimeter field)
 *
 * Convention (as in LogiKal's profile sheets): X = in the plane of the
 * window, 0 = the edge towards the frame / wall; Y = depth, exterior up.
 * The import screen lets the user rotate / mirror until it reads so.
 * ============================================================
 */
const DxfParser = require("dxf-parser");

const TOL = 0.05; // mm — endpoints closer than this are the same point
const ARC_TOL = 0.02; // chord error when tessellating arcs (mm)
const DENSITY = 2.7; // g/cm³ aluminium
const UNITS = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 14: 100 };
const MAX_POINTS = 200000;

const r2 = (v) => Math.round(v * 100) / 100;
const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };

function arcPoints(cx, cy, r, a0, a1, ccw = true) {
  let sweep = ccw ? a1 - a0 : a0 - a1;
  while (sweep <= 0) sweep += 2 * Math.PI;
  if (sweep > 2 * Math.PI) sweep = 2 * Math.PI;
  const step = r > ARC_TOL ? Math.min(Math.PI / 36, 2 * Math.acos(Math.max(-1, 1 - ARC_TOL / r))) : Math.PI / 4;
  const n = Math.max(2, Math.min(360, Math.ceil(sweep / step)));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + (ccw ? 1 : -1) * (sweep * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Points of a polyline segment with a bulge (DXF arc between two vertices). */
function bulgePoints(p1, p2, bulge) {
  if (!bulge) return [p2];
  const theta = 4 * Math.atan(bulge);
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return [p2];
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const h = r * Math.cos(Math.abs(theta) / 2); // centre distance from the chord
  const nx = -dy / chord;
  const ny = dx / chord;
  const sgn = bulge > 0 ? 1 : -1;
  const cx = mid[0] + sgn * nx * h;
  const cy = mid[1] + sgn * ny * h;
  const a0 = Math.atan2(p1[1] - cy, p1[0] - cx);
  const a1 = Math.atan2(p2[1] - cy, p2[0] - cx);
  const pts = arcPoints(cx, cy, Math.abs(r), a0, a1, bulge > 0);
  return pts.slice(1);
}

/** Uniform B-spline / NURBS evaluation (de Boor), falling back on fit / control points. */
function splinePoints(e) {
  const cps = (e.controlPoints || []).map((p) => [p.x, p.y]);
  const deg = e.degreeOfSplineCurve || e.degree || 3;
  const knots = e.knotValues || e.knots || [];
  if (cps.length > deg && knots.length === cps.length + deg + 1) {
    const w = (e.weights && e.weights.length === cps.length) ? e.weights : cps.map(() => 1);
    const lo = knots[deg];
    const hi = knots[knots.length - deg - 1];
    const n = Math.min(400, Math.max(16, cps.length * 8));
    const pts = [];
    for (let s = 0; s <= n; s += 1) {
      const t = lo + ((hi - lo) * s) / n;
      let k = deg;
      while (k < knots.length - deg - 2 && t >= knots[k + 1]) k += 1;
      const d = [];
      for (let j = 0; j <= deg; j += 1) {
        const i = k - deg + j;
        d.push([cps[i][0] * w[i], cps[i][1] * w[i], w[i]]);
      }
      for (let r = 1; r <= deg; r += 1) {
        for (let j = deg; j >= r; j -= 1) {
          const i = k - deg + j;
          const den = knots[i + deg - r + 1] - knots[i];
          const a = den ? (t - knots[i]) / den : 0;
          d[j] = [0, 1, 2].map((c) => (1 - a) * d[j - 1][c] + a * d[j][c]);
        }
      }
      pts.push([d[deg][0] / d[deg][2], d[deg][1] / d[deg][2]]);
    }
    return pts;
  }
  const fit = (e.fitPoints || []).map((p) => [p.x, p.y]);
  return fit.length >= 2 ? fit : cps;
}

/**
 * DXF text → { pieces: [{ p: [[x,y]…], c: closed, l: layer }], layers: [{ name, count }], units, scale }
 */
function parse(text, { scale: forcedScale } = {}) {
  if (!text || typeof text !== "string") fail("Fichier DXF vide");
  if (text.startsWith("AutoCAD Binary DXF")) fail("DXF binaire non pris en charge : enregistrez le fichier en DXF ASCII");
  let dxf;
  try {
    dxf = new DxfParser().parseSync(text);
  } catch (error) {
    fail(`DXF illisible : ${String(error.message || error).slice(0, 160)}`);
  }
  if (!dxf) fail("DXF illisible");
  const insUnits = Number(dxf.header?.$INSUNITS ?? 4);
  const scale = Number(forcedScale) > 0 ? Number(forcedScale) : UNITS[insUnits] || 1;
  const pieces = [];
  const layerCount = new Map();
  let points = 0;
  const push = (pts, closed, layer) => {
    if (!pts || pts.length < 2) return;
    points += pts.length;
    if (points > MAX_POINTS) fail("DXF trop lourd (plus de 200 000 points) : n'importez que la coupe du profilé");
    pieces.push({ p: pts, c: !!closed, l: layer || "0" });
    layerCount.set(layer || "0", (layerCount.get(layer || "0") || 0) + 1);
  };

  const walk = (entities, tf, depth, inheritLayer) => {
    if (depth > 8) return;
    for (const e of entities || []) {
      const layer = e.layer && e.layer !== "0" ? e.layer : inheritLayer || e.layer || "0";
      const T = (pts) => pts.map(tf);
      switch (e.type) {
        case "LINE":
          if (e.vertices?.length >= 2) push(T([[e.vertices[0].x, e.vertices[0].y], [e.vertices[1].x, e.vertices[1].y]]), false, layer);
          break;
        case "LWPOLYLINE":
        case "POLYLINE": {
          const vs = (e.vertices || []).filter((v) => Number.isFinite(v.x) && Number.isFinite(v.y));
          if (vs.length < 2) break;
          const closed = !!(e.shape || e.closed);
          const pts = [[vs[0].x, vs[0].y]];
          for (let i = 0; i < vs.length - 1; i += 1) pts.push(...bulgePoints([vs[i].x, vs[i].y], [vs[i + 1].x, vs[i + 1].y], vs[i].bulge || 0));
          if (closed) pts.push(...bulgePoints([vs[vs.length - 1].x, vs[vs.length - 1].y], [vs[0].x, vs[0].y], vs[vs.length - 1].bulge || 0));
          push(T(pts), closed, layer);
          break;
        }
        case "ARC":
          push(T(arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle, true)), false, layer);
          break;
        case "CIRCLE":
          push(T(arcPoints(e.center.x, e.center.y, e.radius, 0, 2 * Math.PI, true)), true, layer);
          break;
        case "ELLIPSE": {
          const mx = e.majorAxisEndPoint.x;
          const my = e.majorAxisEndPoint.y;
          const a = Math.hypot(mx, my);
          const b = a * (e.axisRatio || 1);
          const rot = Math.atan2(my, mx);
          let t0 = e.startAngle ?? 0;
          let t1 = e.endAngle ?? 2 * Math.PI;
          if (t1 <= t0) t1 += 2 * Math.PI;
          const n = Math.max(24, Math.ceil(((t1 - t0) / (2 * Math.PI)) * 120));
          const pts = [];
          for (let i = 0; i <= n; i += 1) {
            const t = t0 + ((t1 - t0) * i) / n;
            const x = a * Math.cos(t);
            const y = b * Math.sin(t);
            pts.push([e.center.x + x * Math.cos(rot) - y * Math.sin(rot), e.center.y + x * Math.sin(rot) + y * Math.cos(rot)]);
          }
          push(T(pts), Math.abs(t1 - t0 - 2 * Math.PI) < 1e-6, layer);
          break;
        }
        case "SPLINE":
          push(T(splinePoints(e)), !!e.closed, layer);
          break;
        case "INSERT": {
          const block = dxf.blocks?.[e.name];
          if (!block) break;
          const sx = e.xScale ?? 1;
          const sy = e.yScale ?? 1;
          const rot = ((e.rotation || 0) * Math.PI) / 180;
          const bx = block.position?.x || 0;
          const by = block.position?.y || 0;
          const px = e.position?.x || 0;
          const py = e.position?.y || 0;
          const inner = ([x, y]) => {
            const lx = (x - bx) * sx;
            const ly = (y - by) * sy;
            return tf([px + lx * Math.cos(rot) - ly * Math.sin(rot), py + lx * Math.sin(rot) + ly * Math.cos(rot)]);
          };
          walk(block.entities, inner, depth + 1, layer);
          break;
        }
        default:
          break; // TEXT, MTEXT, DIMENSION, HATCH, POINT… are not geometry of the section
      }
    }
  };
  walk(dxf.entities, ([x, y]) => [x * scale, y * scale], 0, null);
  if (!pieces.length) fail("Aucune géométrie trouvée dans le DXF (lignes, arcs, polylignes)");
  return { pieces, layers: [...layerCount.entries()].map(([name, count]) => ({ name, count })), units: insUnits, scale };
}

// ------------------------------------------------------------------
// Geometry helpers
// ------------------------------------------------------------------
const key = ([x, y]) => `${Math.round(x / TOL)}|${Math.round(y / TOL)}`;
const same = (a, b) => Math.abs(a[0] - b[0]) <= TOL * 1.5 && Math.abs(a[1] - b[1]) <= TOL * 1.5;

/** Chains open pieces into closed contours where their ends meet. */
function chain(pieces) {
  const loops = [];
  const open = [];
  for (const pc of pieces) {
    const pts = pc.p;
    if (pc.c || (pts.length > 2 && same(pts[0], pts[pts.length - 1]))) loops.push(same(pts[0], pts[pts.length - 1]) ? pts.slice(0, -1) : pts);
    else open.push(pts);
  }
  const ends = new Map();
  const add = (k, i) => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); };
  open.forEach((pts, i) => { add(key(pts[0]), i); add(key(pts[pts.length - 1]), i); });
  const used = new Array(open.length).fill(false);
  const nearby = (pt) => {
    const out = [];
    const kx = Math.round(pt[0] / TOL);
    const ky = Math.round(pt[1] / TOL);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (const i of ends.get(`${kx + dx}|${ky + dy}`) || []) out.push(i);
    return out;
  };
  const chains = [];
  for (let i = 0; i < open.length; i += 1) {
    if (used[i]) continue;
    used[i] = true;
    let path = [...open[i]];
    let grown = true;
    while (grown) {
      grown = false;
      const tail = path[path.length - 1];
      for (const j of nearby(tail)) {
        if (used[j]) continue;
        const q = open[j];
        if (same(q[0], tail)) { path = path.concat(q.slice(1)); used[j] = true; grown = true; break; }
        if (same(q[q.length - 1], tail)) { path = path.concat([...q].reverse().slice(1)); used[j] = true; grown = true; break; }
      }
      if (same(path[0], path[path.length - 1]) && path.length > 3) break;
      if (!grown) {
        const head = path[0];
        for (const j of nearby(head)) {
          if (used[j]) continue;
          const q = open[j];
          if (same(q[q.length - 1], head)) { path = q.slice(0, -1).concat(path); used[j] = true; grown = true; break; }
          if (same(q[0], head)) { path = [...q].reverse().slice(0, -1).concat(path); used[j] = true; grown = true; break; }
        }
      }
    }
    if (path.length > 3 && same(path[0], path[path.length - 1])) loops.push(path.slice(0, -1));
    else chains.push(path);
  }
  return { loops, chains };
}

const signedArea = (pts) => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return a / 2; };
const perimeter = (pts, closed = true) => { let s = 0; for (let i = 1; i < pts.length; i += 1) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length > 2) s += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return s; };
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    if (((poly[i][1] > pt[1]) !== (poly[j][1] > pt[1])) && (pt[0] < ((poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c;
  }
  return c;
}

/** Douglas–Peucker simplification (keeps the drawing light, error ≤ eps). */
function simplify(pts, eps = 0.01) {
  if (pts.length < 4 || same(pts[0], pts[pts.length - 1])) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let idx = -1;
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i += 1) {
      const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > best) { best = d; idx = i; }
    }
    if (best > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function transformer({ rot = 0, flipX = false, flipY = false } = {}) {
  const q = ((Math.round(rot / 90) % 4) + 4) % 4;
  return ([x, y]) => {
    let p = [x, y];
    if (q === 1) p = [-y, x];
    else if (q === 2) p = [-x, -y];
    else if (q === 3) p = [y, -x];
    if (flipX) p = [-p[0], p[1]];
    if (flipY) p = [p[0], -p[1]];
    return p;
  };
}

/**
 * pieces (from parse) + { transform, hiddenLayers } →
 * { paths: [{ d: [x0,y0,x1,y1…], c, depth }], metrics }
 */
function build(pieces, { transform = {}, hiddenLayers = [] } = {}) {
  const tf = transformer(transform);
  const hidden = new Set(hiddenLayers || []);
  const visible = pieces.filter((p) => !hidden.has(p.l)).map((p) => ({ ...p, p: p.p.map(tf) }));
  if (!visible.length) fail("Toutes les couches sont masquées");
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const pc of visible) for (const [x, y] of pc.p) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  const norm = visible.map((pc) => ({ ...pc, p: pc.p.map(([x, y]) => [x - minX, y - minY]) }));
  const { loops, chains } = chain(norm);
  // even-odd: a contour inside an odd number of others is a hole (chamber)
  const info = loops.map((pts) => ({ pts, area: Math.abs(signedArea(pts)), depth: 0 }));
  for (const a of info) for (const b of info) if (a !== b && b.area > a.area && inside(a.pts[0], b.pts)) a.depth += 1;
  const area = info.reduce((s, l) => s + (l.depth % 2 === 0 ? l.area : -l.area), 0);
  const outer = info.filter((l) => l.depth === 0);
  const width = maxX - minX;
  const height = maxY - minY;
  const flat = (pts) => pts.flatMap(([x, y]) => [r2(x), r2(y)]);
  const paths = [
    // closed contours simplified as open polylines (their two ends are neighbours on the loop)
    ...info.map((l) => ({ d: flat(simplify(l.pts, 0.01)), c: true, depth: l.depth })),
    ...chains.map((pts) => ({ d: flat(simplify(pts)), c: false, depth: -1 })),
  ];
  return {
    paths,
    metrics: {
      width: r2(width), height: r2(height),
      area: r2(Math.max(0, area)),
      kgm: Math.round(Math.max(0, area) * DENSITY) / 1000,
      outerPerimeter: r2(outer.reduce((s, l) => s + perimeter(l.pts), 0)),
      perimeter: r2(info.reduce((s, l) => s + perimeter(l.pts), 0)),
      loops: info.length, holes: info.filter((l) => l.depth % 2 === 1).length, openChains: chains.length,
    },
  };
}

/** Compact storage of the parsed pieces (rounded, flat arrays). */
const packPieces = (pieces) => pieces.map((p) => ({ d: p.p.flatMap(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]), c: p.c, l: p.l }));
const unpackPieces = (packed) => (packed || []).map((p) => {
  const pts = [];
  for (let i = 0; i < p.d.length; i += 2) pts.push([p.d[i], p.d[i + 1]]);
  return { p: pts, c: p.c, l: p.l };
});

/** Product fields the section fills (single source of truth: the article). */
function productFieldsFrom(metrics) {
  return {
    profileHeight: metrics.width, // in-plane (hp)
    profileWidth: metrics.height, // depth (lp)
    ...(metrics.kgm > 0 ? { weightPerMeter: metrics.kgm } : {}),
    ...(metrics.outerPerimeter > 0 ? { perimeter: metrics.outerPerimeter } : {}),
  };
}

module.exports = { parse, build, packPieces, unpackPieces, productFieldsFrom, simplify, chain, DENSITY };
