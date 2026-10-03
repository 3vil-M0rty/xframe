/**
 * Orientation of a section: quarter turns and mirrors, as 2×2 integer
 * matrices so successive clicks compose exactly like the server applies
 * them (rotate, then mirror X, then mirror Y — backend dxfSection.js).
 */
const ROT = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]]; // [a,b,c,d]: x' = a x + b y ; y' = c x + d y
const FX = [-1, 0, 0, 1];
const FY = [1, 0, 0, -1];
const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3]];
const eq = (m, n) => m.every((v, i) => v === n[i]);

export function toMatrix({ rot = 0, flipX = false, flipY = false } = {}) {
  let m = ROT[((Math.round(rot / 90) % 4) + 4) % 4];
  if (flipX) m = mul(FX, m);
  if (flipY) m = mul(FY, m);
  return m;
}

export function fromMatrix(m) {
  for (let q = 0; q < 4; q += 1) for (const f of [false, true]) {
    if (eq(toMatrix({ rot: q * 90, flipX: f }), m)) return { rot: q * 90, flipX: f, flipY: false };
  }
  return { rot: 0, flipX: false, flipY: false };
}

export const OPS = { rotL: ROT[1], rotR: ROT[3], flipX: FX, flipY: FY };
export const compose = (transform, op) => fromMatrix(mul(OPS[op], toMatrix(transform)));

/** Applies a matrix to normalised paths and re-normalises them (bbox min at 0,0). */
export function applyToSection(section, m) {
  if (!section) return section;
  const paths = section.paths.map((p) => {
    const d = [];
    for (let i = 0; i < p.d.length; i += 2) d.push(m[0] * p.d[i] + m[1] * p.d[i + 1], m[2] * p.d[i] + m[3] * p.d[i + 1]);
    return { ...p, d };
  });
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const p of paths) for (let i = 0; i < p.d.length; i += 2) { minX = Math.min(minX, p.d[i]); maxX = Math.max(maxX, p.d[i]); minY = Math.min(minY, p.d[i + 1]); maxY = Math.max(maxY, p.d[i + 1]); }
  for (const p of paths) for (let i = 0; i < p.d.length; i += 2) { p.d[i] = Math.round((p.d[i] - minX) * 100) / 100; p.d[i + 1] = Math.round((p.d[i + 1] - minY) * 100) / 100; }
  return { ...section, paths, metrics: { ...section.metrics, width: Math.round((maxX - minX) * 100) / 100, height: Math.round((maxY - minY) * 100) / 100 } };
}
/** Relative matrix from transform a to transform b (b = R · a). */
export function relative(a, b) {
  const A = toMatrix(a);
  const inv = [A[3], -A[1], -A[2], A[0]]; // orthogonal ±1 matrices: inverse = adjugate / det, det = ±1
  const det = A[0] * A[3] - A[1] * A[2];
  return mul(toMatrix(b), inv.map((v) => v * det));
}
