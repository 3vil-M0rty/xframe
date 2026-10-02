/**
 * ============================================================
 * CUTTING OPTIMISATION (débit) — pure functions, no database
 * ============================================================
 *   optimizeBars(cuts, opts)        1D: profile bars
 *       opts = { barLength, kerf (épaisseur de lame), trim (début de
 *                barre), endTrim (fin de barre), spacing (espace
 *                ajouté entre chaque coupe), minReusableOffcut }
 *       Best-fit decreasing. Every bar loses `trim` at its start and
 *       `endTrim` at its end; between two pieces the saw removes
 *       `kerf` + `spacing`. Each pattern gives the cut positions so a
 *       screen / PDF can draw the bar.
 *
 *   packSheets(pieces, sheet, opts) 2D: glass / panels on a plateau
 *       opts = { edgeTrim (bord du plateau, mm per side), gap (trait
 *                de coupe entre deux pièces), allowRotation }
 *       Guillotine packing (every cut runs edge to edge, like a glass
 *       cutting table), best-area-fit, shorter-leftover-axis split.
 *
 *   allocateSheets(pieces, candidates, opts)
 *       Chooses AUTOMATICALLY which plateau(x) to cut from, among the
 *       allowed formats (e.g. 4 mm in 3000×1000 or 2400×1000), using
 *       what is in stock: formats are ranked by material used for the
 *       whole job; the best one is used as far as its stock allows,
 *       then the next… and what is still missing is planned on the best
 *       format (to buy). `candidates[i].stock` is decremented.
 * ============================================================
 */
const round = (x, d = 1) => { const f = 10 ** d; return Math.round((Number(x) || 0) * f) / f; };
const num = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);

// ------------------------------------------------------------------
// 1D — bars
// ------------------------------------------------------------------
/** "45/45" → [45, 45] ; "45/90" → [45, 90] ; "" → [90, 90]. Angles are between the cut and the bar axis. */
function parseAngles(angle) {
  const parts = String(angle || "").split(/[\/\-x×]/).map((x) => Number(String(x).replace(",", ".").trim()));
  const ok = (v) => Number.isFinite(v) && v > 0 && v <= 90;
  const a = ok(parts[0]) ? parts[0] : 90;
  const b = ok(parts[1]) ? parts[1] : ok(parts[0]) ? parts[0] : 90;
  return [a, b];
}
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Lengths are measured POINTE À POINTE (long points), the way they come
 * out of the formulas (e.g. dormant with couvre-joint: 1000 + 2 × 25 = 1050, 45/45).
 *
 * opts.depth  profile width in the mitre plane (mm). With `nest` on and a
 *             depth known, two neighbouring mitres of the same angle are cut
 *             TÊTE-BÊCHE: one saw cut frees both pieces, the second piece is
 *             turned over and starts `depth / tan(angle)` earlier (that much
 *             profile saved per joint; the blade then takes kerf / sin(angle)).
 */
function optimizeBars(cuts, opts = {}) {
  const barLength = Math.max(1, num(opts.barLength, 6500));
  const kerf = Math.max(0, num(opts.kerf, 4));
  const trim = Math.max(0, num(opts.trim, 10));
  const endTrim = Math.max(0, num(opts.endTrim, 0));
  const spacing = Math.max(0, num(opts.spacing, 0));
  const minReusableOffcut = Math.max(0, num(opts.minReusableOffcut, 600));
  const depth = Math.max(0, num(opts.depth, 0));
  const nest = opts.nest !== false && depth > 0;
  const gap = kerf + spacing;
  const usable = Math.max(1, barLength - trim - endTrim);

  const pieces = [];
  const oversize = [];
  for (const c of cuts || []) {
    const n = Math.round(num(c.qty));
    const length = num(c.length);
    if (!(length > 0)) continue;
    const angles = parseAngles(c.angle);
    for (let i = 0; i < n; i += 1) {
      const p = { length, label: c.label || "", ref: c.ref || "", angle: c.angle || "", angles };
      if (length > usable) oversize.push(p); else pieces.push(p);
    }
  }
  // Longest first; same length → mitred pieces together so they can nest.
  pieces.sort((a, b) => b.length - a.length || (a.angles[0] + a.angles[1]) - (b.angles[0] + b.angles[1]) || String(a.ref).localeCompare(String(b.ref)));

  /** How a piece would go on a bar: orientation, nesting, length consumed. */
  const placement = (bar, p) => {
    const orients = p.angles[0] === p.angles[1] ? [[p.angles[0], p.angles[1], false]] : [[p.angles[0], p.angles[1], false], [p.angles[1], p.angles[0], true]];
    let best = null;
    for (const [lead, trail, flipped] of orients) {
      let need;
      let nested = false;
      let shift = 0;
      if (!bar.cuts.length) {
        need = p.length;
      } else if (nest && lead !== 90 && lead === bar.trail) {
        shift = depth / Math.tan(rad(lead)) - kerf / Math.sin(rad(lead)) - spacing;
        need = p.length - shift;
        nested = true;
      } else {
        need = gap + p.length;
      }
      // Prefer: nesting, then a square start on a fresh bar, then a mitre left at the end (to nest the next one).
      const score = need - (nested ? 0.5 : 0) - (!bar.cuts.length && lead === 90 ? 0.2 : 0) - (trail !== 90 ? 0.1 : 0);
      if (!best || score < best.score) best = { lead, trail, flipped, need, nested, shift, score };
    }
    return best;
  };

  // Best fit: the bar where the piece leaves the smallest remainder.
  const bars = [];
  for (const p of pieces) {
    let target = null;
    let how = null;
    let bestLeft = Infinity;
    for (const bar of bars) {
      const h = placement(bar, p);
      const left = usable - bar.used - h.need;
      if (left >= -1e-6 && left < bestLeft) { target = bar; how = h; bestLeft = left; }
    }
    if (!target) {
      target = { cuts: [], used: 0, trail: 90, longTop: false, end: trim };
      bars.push(target);
      how = placement(target, p);
    }
    const longTop = how.nested ? !target.longTop : false; // a nested piece is turned over
    const start = !target.cuts.length ? trim : how.nested ? target.end - how.shift : target.end + gap;
    target.cuts.push({ ...p, angleL: how.lead, angleR: how.trail, flipped: how.flipped, nested: how.nested, longTop, pos: start });
    target.end = start + p.length;
    target.used = target.end - trim;
    target.trail = how.trail;
    target.longTop = longTop;
  }

  const oversizeBars = oversize.reduce((s, p) => s + Math.ceil(p.length / usable), 0);
  const cutLength = pieces.reduce((s, p) => s + p.length, 0) + oversize.reduce((s, p) => s + p.length, 0);
  const totalBars = bars.length + oversizeBars;
  const savedByNesting = bars.reduce((s, b) => s + b.cuts.filter((c) => c.nested).length, 0) * (nest ? depth : 0);

  // Identical bars → one pattern ("× 3") so a work order stays readable.
  const patterns = new Map();
  for (const bar of bars) {
    const key = bar.cuts.map((c) => `${c.length}|${c.ref}|${c.label}|${c.angleL}|${c.angleR}|${c.nested}`).join(";");
    // What is left after the last cut (the saw takes one more kerf to free it).
    const left = usable - bar.used;
    const offcut = round(Math.max(0, left - (left > kerf ? kerf : left)), 1);
    if (!patterns.has(key)) {
      const placed = bar.cuts.map((c, i) => ({
        n: i + 1, length: c.length, ref: c.ref, label: c.label, angle: c.angle,
        angleL: c.angleL, angleR: c.angleR, nested: c.nested, longTop: c.longTop, pos: round(c.pos, 1),
      }));
      patterns.set(key, { cuts: placed, offcut, used: round(bar.used, 1), count: 0, reusable: offcut >= minReusableOffcut && offcut > 0 });
    }
    patterns.get(key).count += 1;
  }
  const list = [...patterns.values()].sort((a, b) => b.count - a.count || a.offcut - b.offcut);
  // Bar numbers: pattern 1 = bars 1..count, pattern 2 follows…
  let next = 1;
  for (const p of list) { p.firstBar = next; p.lastBar = next + p.count - 1; next += p.count; }

  // Saw-stop list: each length / angle pair once, longest first (one stop setting each).
  const stops = new Map();
  for (const p of [...pieces, ...oversize]) {
    const key = `${p.length}|${p.angles.join("/")}`;
    if (!stops.has(key)) stops.set(key, { length: p.length, angle: p.angles.join("/"), qty: 0, refs: new Set() });
    const st = stops.get(key);
    st.qty += 1;
    if (p.ref) st.refs.add(p.ref);
  }
  const sawList = [...stops.values()].map((x) => ({ ...x, refs: [...x.refs].sort() })).sort((a, b) => b.length - a.length);

  return {
    barLength,
    settings: { kerf, trim, endTrim, spacing, minReusableOffcut, depth, nest },
    bars: totalBars,
    patterns: list,
    oversize,
    sawList,
    pieces: pieces.length + oversize.length,
    cutLength: round(cutLength, 1),
    savedByNesting: round(savedByNesting, 1),
    efficiency: totalBars ? round((cutLength / (totalBars * barLength)) * 100, 1) : 0,
    reusableOffcuts: list.filter((p) => p.reusable).reduce((s, p) => s + p.count, 0),
    waste: round(totalBars * barLength - cutLength, 1),
  };
}

/** Length at the short points (talons) of a piece measured at the long points. */
function heelLength(length, angle, depth) {
  if (!(depth > 0)) return null;
  const [a, b] = parseAngles(angle);
  const off = (x) => (x === 90 ? 0 : depth / Math.tan(rad(x)));
  return round(length - off(a) - off(b), 1);
}

// ------------------------------------------------------------------
// 2D — sheets (guillotine)
// ------------------------------------------------------------------
function expandPieces(pieces) {
  const out = [];
  let id = 0;
  for (const p of pieces || []) {
    const n = Math.round(num(p.qty, 1));
    const w = num(p.width);
    const h = num(p.height);
    if (!(w > 0 && h > 0)) continue;
    for (let i = 0; i < n; i += 1) out.push({ id: id++, width: w, height: h, label: p.label || "", ref: p.ref || "" });
  }
  // Biggest first (by longest side, then area) — standard for guillotine.
  return out.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height);
}

function newSheet(W, H) {
  return { free: [{ x: 0, y: 0, w: W, h: H }], placed: [], area: 0 };
}

/** Best free rectangle (smallest leftover area) for a w × h piece on one sheet. */
function findSpot(sheet, w, h, allowRotation) {
  let best = null;
  for (let i = 0; i < sheet.free.length; i += 1) {
    const r = sheet.free[i];
    const tries = allowRotation && w !== h ? [[w, h, false], [h, w, true]] : [[w, h, false]];
    for (const [pw, ph, rot] of tries) {
      if (pw <= r.w + 1e-6 && ph <= r.h + 1e-6) {
        const score = r.w * r.h - pw * ph;
        const short = Math.min(r.w - pw, r.h - ph);
        if (!best || score < best.score - 1e-6 || (Math.abs(score - best.score) < 1e-6 && short < best.short)) best = { i, pw, ph, rot, score, short };
      }
    }
  }
  return best;
}

function place(sheet, spot, piece, gap) {
  const r = sheet.free[spot.i];
  sheet.free.splice(spot.i, 1);
  // The piece occupies pw × ph; the saw/cutter line `gap` is consumed on its right / bottom.
  const pw = spot.pw;
  const ph = spot.ph;
  const rw = r.w - pw; // leftover width (includes the gap)
  const rh = r.h - ph;
  // Shorter leftover axis split: keep the bigger leftover in one piece.
  let right;
  let bottom;
  if (rw < rh) {
    right = { x: r.x + pw, y: r.y, w: rw, h: ph };
    bottom = { x: r.x, y: r.y + ph, w: r.w, h: rh };
  } else {
    right = { x: r.x + pw, y: r.y, w: rw, h: r.h };
    bottom = { x: r.x, y: r.y + ph, w: pw, h: rh };
  }
  for (const f of [right, bottom]) if (f.w > gap + 1 && f.h > gap + 1) sheet.free.push(f);
  sheet.placed.push({ ...piece, x: r.x, y: r.y, w: pw - gap, h: ph - gap, rotated: spot.rot });
  sheet.area += (pw - gap) * (ph - gap);
}

/**
 * Packs pieces on sheets of one format.
 * pieces = [{ width, height, qty, label, ref }] ; sheet = { width, height }
 * maxSheets: stop after that many sheets (rest returned in `left`).
 */
const ORDERS = [
  (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height,
  (a, b) => b.width * b.height - a.width * a.height,
  (a, b) => b.height - a.height || b.width - a.width,
  (a, b) => b.width - a.width || b.height - a.height,
];

/** Tries a few piece orders and keeps the layout with the fewest sheets (or, capped, the most area placed). */
function packSheets(pieces, sheet, opts = {}) {
  const base = Array.isArray(opts.expanded) ? opts.expanded : expandPieces(pieces);
  let best = null;
  for (const order of ORDERS) {
    const r = packOnce([...base].sort(order), sheet, opts);
    const better = !best
      || r.unfit.length < best.unfit.length
      || (r.unfit.length === best.unfit.length && r.left.length < best.left.length)
      || (r.unfit.length === best.unfit.length && r.left.length === best.left.length && (r.count < best.count || (r.count === best.count && r.usedArea > best.usedArea + 1e-6)));
    if (better) best = r;
  }
  return best;
}

function packOnce(list, sheet, opts = {}) {
  const W = num(sheet.width);
  const H = num(sheet.height);
  const edge = Math.max(0, num(opts.edgeTrim, 0));
  const gap = Math.max(0, num(opts.gap, 0));
  const allowRotation = opts.allowRotation !== false;
  const maxSheets = opts.maxSheets === undefined || opts.maxSheets === null ? Infinity : Math.max(0, Math.floor(opts.maxSheets));
  // Usable area, inflated by one gap so the last piece of a row needs none.
  const UW = W - 2 * edge + gap;
  const UH = H - 2 * edge + gap;
  const sheets = [];
  const left = [];
  const unfit = [];
  for (const piece of list) {
    const w = piece.width + gap;
    const h = piece.height + gap;
    const fitsAtAll = (w <= UW + 1e-6 && h <= UH + 1e-6) || (allowRotation && h <= UW + 1e-6 && w <= UH + 1e-6);
    if (!fitsAtAll) { unfit.push(piece); continue; }
    let best = null;
    for (const s of sheets) {
      const spot = findSpot(s, w, h, allowRotation);
      if (spot && (!best || spot.score < best.spot.score)) best = { s, spot };
    }
    if (!best) {
      if (sheets.length >= maxSheets) { left.push(piece); continue; }
      const s = newSheet(UW, UH);
      sheets.push(s);
      best = { s, spot: findSpot(s, w, h, allowRotation) };
    }
    place(best.s, best.spot, piece, gap);
  }
  const sheetArea = W * H;
  const out = sheets.map((s) => ({
    pieces: s.placed.map((p) => ({ x: round(p.x + edge), y: round(p.y + edge), w: round(p.w), h: round(p.h), rotated: p.rotated, ref: p.ref, label: p.label, id: p.id })),
    usedArea: s.area,
    efficiency: sheetArea ? round((s.area / sheetArea) * 100, 1) : 0,
  }));
  const usedArea = out.reduce((a, s) => a + s.usedArea, 0);
  return {
    sheetWidth: W,
    sheetHeight: H,
    sheets: out,
    count: out.length,
    left,
    unfit,
    usedArea,
    efficiency: out.length && sheetArea ? round((usedArea / (out.length * sheetArea)) * 100, 1) : 0,
    settings: { edgeTrim: edge, gap, allowRotation },
  };
}

/** Identical sheet layouts → patterns { count, pieces } (smaller to store and print). */
function compactSheets(sheets) {
  const map = new Map();
  for (const s of sheets) {
    const key = s.pieces.map((p) => `${p.x},${p.y},${p.w},${p.h},${p.ref},${p.label}`).join(";");
    if (!map.has(key)) map.set(key, { count: 0, efficiency: s.efficiency, pieces: s.pieces.map(({ id, ...p }) => p) });
    map.get(key).count += 1;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.efficiency - a.efficiency);
}

/** Groups placed pieces back into a piece list [{ width, height, qty, label, ref }]. */
function piecesToList(pieces) {
  const map = new Map();
  for (const p of pieces) {
    const key = `${p.width}|${p.height}|${p.ref}|${p.label}`;
    if (!map.has(key)) map.set(key, { width: p.width, height: p.height, qty: 0, label: p.label, ref: p.ref });
    map.get(key).qty += 1;
  }
  return [...map.values()];
}

/**
 * candidates = [{ id, width, height, stock, name }] — the plateaux this
 * glass may be cut from. Returns { allocations: [{ candidate, plan,
 * fromStock, toBuy, pieceList }], unfit: [...] }.
 */
function allocateSheets(pieces, candidates, opts = {}) {
  const all = expandPieces(pieces);
  const valid = (candidates || []).filter((c) => num(c.width) > 0 && num(c.height) > 0);
  if (!valid.length || !all.length) return { allocations: [], unfit: valid.length ? [] : all };

  // Rank formats on the whole job: material used (sheets × area), then fewer sheets.
  const ranked = valid.map((c) => {
    const p = packSheets(null, c, { ...opts, expanded: all });
    return { c, fitsAll: p.unfit.length === 0, material: p.count * num(c.width) * num(c.height), count: p.count, unfitCount: p.unfit.length };
  }).sort((a, b) => (a.unfitCount - b.unfitCount) || (a.material - b.material) || (a.count - b.count) || (num(b.c.stock) - num(a.c.stock)));

  let remaining = all;
  const allocations = [];
  for (const r of ranked) {
    if (!remaining.length) break;
    const stock = Math.max(0, Math.floor(num(r.c.stock)));
    if (stock <= 0) continue;
    const p = packSheets(null, r.c, { ...opts, expanded: remaining, maxSheets: stock });
    if (!p.count) continue;
    const placedIds = new Set(p.sheets.flatMap((s) => s.pieces.map((x) => x.id)));
    remaining = remaining.filter((x) => !placedIds.has(x.id));
    r.c.stock = num(r.c.stock) - p.count;
    allocations.push({ candidate: r.c, plan: p, fromStock: p.count, toBuy: 0 });
  }
  // What stock could not cover: on the best format that can take them (to buy).
  let unfit = [];
  if (remaining.length) {
    for (const r of ranked) {
      if (!remaining.length) break;
      const p = packSheets(null, r.c, { ...opts, expanded: remaining });
      if (!p.count) continue;
      const placedIds = new Set(p.sheets.flatMap((s) => s.pieces.map((x) => x.id)));
      remaining = remaining.filter((x) => !placedIds.has(x.id));
      const existing = allocations.find((a) => a.candidate === r.c);
      if (existing) {
        // Same format: re-pack everything together (fewer sheets than two separate runs).
        const ids = new Set([...existing.plan.sheets, ...p.sheets].flatMap((sh) => sh.pieces.map((x) => x.id)));
        const merged = packSheets(null, r.c, { ...opts, expanded: all.filter((x) => ids.has(x.id)) });
        const avail = existing.fromStock;
        existing.plan = merged;
        existing.fromStock = Math.min(avail, merged.count);
        existing.toBuy = merged.count - existing.fromStock;
      } else {
        allocations.push({ candidate: r.c, plan: p, fromStock: 0, toBuy: p.count });
      }
    }
    unfit = remaining;
  }
  const byId = new Map(all.map((x) => [x.id, x]));
  for (const a of allocations) {
    const placed = a.plan.sheets.flatMap((s) => s.pieces.map((x) => ({ width: byId.get(x.id)?.width ?? x.w, height: byId.get(x.id)?.height ?? x.h, label: x.label, ref: x.ref })));
    a.pieceList = piecesToList(placed);
    a.area = placed.reduce((s, x) => s + (x.width * x.height) / 1e6, 0);
  }
  return { allocations, unfit };
}

module.exports = { optimizeBars, parseAngles, heelLength, packSheets, allocateSheets, compactSheets, expandPieces, piecesToList, round };
