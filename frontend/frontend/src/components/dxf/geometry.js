/**
 * Geometry helpers for profile sections (DXF) — see backend services/dxfSection.js.
 *   section.paths = [{ d: [x0,y0,x1,y1…], c: closed, depth }]  (mm, bbox min at 0,0)
 * World coordinates: X = in the plane of the window, Y = depth, exterior UP.
 * SVG coordinates: (x, -y) — so a <g transform="scale(1,-1)"> draws the world.
 */

/** SVG path data of a section (world coordinates), closed contours + open lines. */
export function sectionPathData(section) {
  const closed = [];
  const open = [];
  for (const p of section?.paths || []) {
    const d = p.d || [];
    if (d.length < 4) continue;
    let s = `M${d[0]} ${d[1]}`;
    for (let i = 2; i < d.length; i += 2) s += `L${d[i]} ${d[i + 1]}`;
    if (p.c) closed.push(`${s}Z`); else open.push(s);
  }
  return { closed: closed.join(""), open: open.join("") };
}

/** All vertices of a section, optionally decimated (snapping). */
export function sectionVertices(section, max = 4000) {
  const pts = [];
  for (const p of section?.paths || []) for (let i = 0; i < (p.d || []).length; i += 2) pts.push([p.d[i], p.d[i + 1]]);
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[Math.floor(i)]);
  return out;
}

/** Applies a placement { x, y, flipX } to a point of a section of width w. */
export const place = ([x, y], pl = {}, w = 0) => [(pl.flipX ? -x : x) + (pl.x || 0), y + (pl.y || 0)];
// a mirrored section keeps its x = 0 edge at the placement point (it extends to the left)
export const placedBox = (metrics, pl = {}) => {
  const w = metrics?.width || 0;
  const h = metrics?.height || 0;
  const x0 = pl.flipX ? (pl.x || 0) - w : pl.x || 0;
  return { x0, x1: x0 + w, y0: pl.y || 0, y1: (pl.y || 0) + h };
};

/** Grid hash of points for fast nearest-point queries. */
export function pointIndex(points, cell = 2) {
  const map = new Map();
  for (const p of points) {
    const k = `${Math.floor(p[0] / cell)}|${Math.floor(p[1] / cell)}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  return {
    nearest(x, y, tol) {
      const r = Math.ceil(tol / cell);
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      let best = null;
      let bd = tol;
      for (let i = -r; i <= r; i += 1) for (let j = -r; j <= r; j += 1) {
        for (const p of map.get(`${cx + i}|${cy + j}`) || []) {
          const d = Math.hypot(p[0] - x, p[1] - y);
          if (d <= bd) { bd = d; best = p; }
        }
      }
      return best ? { p: best, d: bd } : null;
    },
  };
}

/** Sorted unique coordinates (axis snapping). */
export function axisValues(points, axis) {
  const v = [...new Set(points.map((p) => Math.round(p[axis] * 100) / 100))].sort((a, b) => a - b);
  return {
    nearest(x, tol) {
      let lo = 0;
      let hi = v.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x) lo = m + 1; else hi = m; }
      let best = null;
      for (const i of [lo - 1, lo, lo + 1]) if (i >= 0 && i < v.length && Math.abs(v[i] - x) <= tol && (best === null || Math.abs(v[i] - x) < Math.abs(best - x))) best = v[i];
      return best;
    },
  };
}

export const fmtMm = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : (Math.round(Number(v) * 10 ** d) / 10 ** d).toLocaleString("fr-FR"));
