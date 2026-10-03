/**
 * Sample profile sections (DXF) for the demo series and the tests —
 * simplified but realistic shapes, in mm, drawn in the CAD convention:
 * X = in the plane of the window (0 = side towards the frame / wall),
 * Y = depth (0 = interior, up = exterior).
 *
 *   DOR  dormant: body 48 + couvre-joint 20, exterior stop lip, 2 chambers,
 *        screw port (block INSERT + CIRCLE)
 *   OUV  ouvrant: outline as LINE + ARC entities (tests chaining), 2 chambers
 *   MEN  meneau: symmetric T, lips on both sides
 *   PAR  parclose: rounded face (polyline bulge)
 *   BAT  battement: chamfered bar
 *
 * node scripts/sampleProfileDxf.js <dir>   writes the five .dxf files
 */
const fs = require("fs");
const path = require("path");

const head = (blocks = "") => ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "BLOCKS", blocks, "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"].filter((x) => x !== "").join("\n");
const tail = ["0", "ENDSEC", "0", "EOF"].join("\n");
const lw = (pts, layer = "PROFIL", closed = true) => ["0", "LWPOLYLINE", "8", layer, "90", String(pts.length), "70", closed ? "1" : "0",
  ...pts.flatMap(([x, y, b]) => ["10", String(x), "20", String(y), ...(b ? ["42", String(b)] : [])])].join("\n");
const line = (a, b, layer = "PROFIL") => ["0", "LINE", "8", layer, "10", String(a[0]), "20", String(a[1]), "11", String(b[0]), "21", String(b[1])].join("\n");
const arc = (c, r, a0, a1, layer = "PROFIL") => ["0", "ARC", "8", layer, "10", String(c[0]), "20", String(c[1]), "40", String(r), "50", String(a0), "51", String(a1)].join("\n");
const circle = (c, r, layer = "PROFIL") => ["0", "CIRCLE", "8", layer, "10", String(c[0]), "20", String(c[1]), "40", String(r)].join("\n");
const rect = (x0, y0, x1, y1, layer) => lw([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], layer);
const text = (s, x, y) => ["0", "TEXT", "8", "COTES", "10", String(x), "20", String(y), "40", "3", "1", s].join("\n");

function dor() {
  // couvre-joint (x 0..20 at the exterior), body 20..68, exterior lip to 86
  const outline = [[20, 0], [68, 0], [68, 6], [72, 6], [72, 30], [68, 30], [68, 46], [86, 46], [86, 60], [0, 60], [0, 56], [20, 56]];
  const block = ["0", "BLOCK", "8", "0", "2", "VIS", "70", "0", "10", "0", "20", "0", circle([0, 0], 2.2), "0", "ENDBLK"].join("\n");
  return [head(block), lw(outline), rect(25, 5, 63, 26, "PROFIL"), rect(25, 33, 63, 54, "PROFIL"),
    ["0", "INSERT", "8", "PROFIL", "2", "VIS", "10", "44", "20", "29.5"].join("\n"), text("DOR", 30, 70), tail].join("\n");
}

function ouv() {
  // sash: body under the frame's exterior stop, glazing rebate on the opening side;
  // outline as LINE + one ARC fillet (r 4 at the interior corner) — tests chaining
  const p = [[0, 4], [0, 40], [52, 40], [52, 48], [74, 48], [74, 30], [66, 30], [66, 0], [4, 0]];
  const parts = [];
  for (let i = 0; i < p.length - 1; i += 1) parts.push(line(p[i], p[i + 1]));
  parts.push(arc([4, 4], 4, 180, 270)); // closes (4,0) → (0,4)
  return [head(), ...parts, rect(6, 4, 46, 20), rect(6, 24, 46, 36), tail].join("\n");
}

function men() {
  const outline = [[18, 0], [74, 0], [74, 46], [92, 46], [92, 60], [0, 60], [0, 46], [18, 46]];
  return [head(), lw(outline), rect(23, 5, 69, 24), rect(23, 30, 69, 55), tail].join("\n");
}

function par() {
  return [head(), lw([[0, 0], [18, 0], [18, 22], [5, 22, 0.25], [0, 17]]), tail].join("\n");
}

function bat() {
  return [head(), lw([[0, 0], [30, 0], [30, 40], [4, 44], [0, 40]]), rect(5, 5, 25, 35), tail].join("\n");
}

const SAMPLES = { DOR: dor, OUV: ouv, MEN: men, PAR: par, BAT: bat };

if (require.main === module) {
  const dir = process.argv[2] || ".";
  fs.mkdirSync(dir, { recursive: true });
  for (const [code, fn] of Object.entries(SAMPLES)) fs.writeFileSync(path.join(dir, `AWS60-${code}.dxf`), fn());
  console.log(`5 DXF written to ${dir}`);
}

module.exports = { SAMPLES };
