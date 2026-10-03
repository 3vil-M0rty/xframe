/**
 * ============================================================
 * CHASSIS DESIGN (CAD) → MODEL
 * ============================================================
 * The CAD page (Technique › Conception) draws a chassis parametrically:
 *
 *   frame (dormant, profile code DOR)
 *     └─ opening (jour), divided by splits (meneaux "v" / traverses "h")
 *          └─ cells: fixed glazing / panel, or a sash (1 or 2 leaves,
 *             profile OUV, meeting profile BAT) with beads (PAR)
 *
 * Every dimension depends on the ordered size L × H and on LIAISONS —
 * formulas over the profiles of the series (DOR.ch + DOR.ai…) that the
 * user can adjust in the section view ("coupes"). generate() turns the
 * design into ordinary model parts (derived values + components with
 * their cut lengths and angles), so the usual engine prices it, cuts
 * the bars, plans the glass, everywhere (devis, projets, ateliers).
 *
 * Generated derived values are prefixed "x_", generated components
 * carry `generated: true`: saving a design replaces them and keeps what
 * the user added by hand (accessories, hardware, labour…).
 * ============================================================
 */
const { evaluate } = require("./formulaEngine");
const { normalizeCode } = require("./seriesLibrary");

const MAX_DEPTH = 6;
const MAX_NODES = 60;
const OPENINGS = ["left", "right", "tilt-left", "tilt-right", "top", "bottom", "slide"];

// Default liaisons (shown and editable in the coupes)
const DEFAULTS = {
  frameClear: (F) => `${F}.ch + ${F}.ai`, // de la cote au jour du dormant, par côté
  splitClear: (M) => `${M}.hp / 2`, // de l'axe du meneau au jour, par côté
  splitEnd: () => "0", // allongement du meneau à chaque bout (assemblage)
  fixedBite: (F) => `${F}.ai - 3`, // prise du verre fixe dans la feuillure, par côté
  sashOverlap: (S) => `${S}.ae`, // recouvrement de l'ouvrant sur le jour, par côté
  sashGlass: (S) => `${S}.ae + ${S}.ch + 3`, // du bord extérieur de l'ouvrant au bord du verre
  sashClear: (S) => `${S}.ae + ${S}.ch + ${S}.ai`, // du bord extérieur de l'ouvrant à son jour (parcloses)
  meeting: (B) => (B ? `${B}.hp / 2` : "0"), // recouvrement entre deux vantaux
};

const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
const formulaOr = (v, def) => (v === undefined || v === null || String(v).trim() === "" ? def : String(v).trim().slice(0, 300));
const safeId = (id, i) => String(id || `n${i}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || `n${i}`;

/** Cleans the design sent by the CAD page (structure, codes, sizes). */
function cleanDesign(input) {
  const d = input && typeof input === "object" ? input : {};
  const frameCode = normalizeCode(d.frame?.code);
  if (!frameCode) fail("Choisissez le profilé du dormant (code de la série, ex. DOR)");
  let count = 0;
  const seen = new Set();
  const node = (n, depth) => {
    count += 1;
    if (count > MAX_NODES) fail("Dessin trop complexe (60 éléments au plus)");
    if (depth > MAX_DEPTH) fail("Trop de divisions imbriquées (6 niveaux au plus)");
    let id = safeId(n?.id, count);
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    if (n?.kind === "split") {
      const parts = (Array.isArray(n.parts) ? n.parts : []).slice(0, 8);
      if (parts.length < 2) fail("Une division a au moins deux parties");
      const code = normalizeCode(n.code);
      if (!code) fail("Choisissez le profilé de chaque meneau / traverse");
      return {
        id, kind: "split", dir: n.dir === "h" ? "h" : "v", code,
        clear: formulaOr(n.clear, ""), end: formulaOr(n.end, ""),
        parts: parts.map((p) => {
          const size = p?.size === "" || p?.size === null || p?.size === undefined ? null : Number(p.size);
          if (size !== null && !(Number.isFinite(size) && size > 0)) fail("La largeur d'une partie doit être un nombre positif (ou vide = automatique)");
          return { size, node: node(p?.node || { kind: "cell" }, depth + 1) };
        }),
      };
    }
    const fill = n?.fill === "sash" ? "sash" : "fixed";
    const out = {
      id, kind: "cell", fill,
      infill: ["glass", "panel", "none"].includes(n?.infill) ? n.infill : "glass",
      beadCode: normalizeCode(n?.beadCode) || "",
      bite: formulaOr(n?.bite, ""),
      beadExtra: formulaOr(n?.beadExtra, ""),
    };
    if (fill === "sash") {
      const s = n.sash || {};
      const code = normalizeCode(s.code);
      if (!code) fail("Choisissez le profilé de chaque ouvrant (ex. OUV)");
      out.sash = {
        code, leaves: Number(s.leaves) === 2 ? 2 : 1,
        opening: OPENINGS.includes(s.opening) ? s.opening : "left",
        meetingCode: normalizeCode(s.meetingCode) || "",
        overlap: formulaOr(s.overlap, ""), glass: formulaOr(s.glass, ""), clear: formulaOr(s.clear, ""), meeting: formulaOr(s.meeting, ""),
      };
    }
    return out;
  };
  const root = node(d.root || { kind: "cell" }, 0);
  const num = (v, def) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : def);
  return {
    version: 1,
    frame: { code: frameCode, joint: d.frame?.joint === "90" ? "90" : "45", clear: formulaOr(d.frame?.clear, ""), cover: formulaOr(d.frame?.cover, "") },
    beadCode: normalizeCode(d.beadCode) || "",
    root,
    preview: { L: num(d.preview?.L, 1200), H: num(d.preview?.H, 1400), quantity: num(d.preview?.quantity, 1) },
  };
}

/**
 * design → { derived, components, parameters, regions, links, structure }
 *   regions:   what the CAD draws, with x/y/w/h FORMULAS (evaluated by layoutOf)
 *   links:     the liaisons, for the coupes ({ key, label, formula, kind, codes })
 *   structure: what the fabrication rules work on (services/chassisFabrication.js)
 *     pieces   role → { tags, node, code, group, leaf } — every profile piece
 *              is generated per POSITION (dormant haut / bas / gauche / droit,
 *              montant côté paumelles / serrure, meneau 1…) like LogiKal's
 *              position lists, so accessories and machining can target it
 *     leaves   one per vantail: code, opening, active (vantail principal),
 *              lw/lh/gw/gh = the derived keys of its sizes
 *     panes    infills: type glass|panel, w/h keys, qty per chassis
 *     corners  [{ code, joint 45|90, count, group frame|sash }]
 *     joints   T-joints of meneaux / traverses: [{ code, count }]
 */
function generate(design, lookup = null) {
  const d = design;
  const F = d.frame.code;
  // Deductions: from the series' NODES when defined (measured on the DXF),
  // else estimated from the profile geometry (DEFAULTS).
  const node = (type, a, b = "") => (lookup ? lookup(type, a, b) : null);
  const fromNode = (n, k, fallback) => (n && Number.isFinite(Number(n.values?.[k])) ? String(n.values[k]) : fallback);
  const derived = [];
  const components = [];
  const regions = [];
  const links = [];
  const structure = { pieces: {}, leaves: [], panes: [], corners: [], joints: [] };
  let hasGlass = false;
  let hasPanel = false;
  const add = (key, label, formula) => { derived.push({ key, label: label.slice(0, 120), formula: String(formula) }); return key; };
  const link = (key, label, formula, kind, codes, nodeId, src = null) => {
    links.push({ key, label, formula: String(formula), kind, codes, node: nodeId, profileNode: src?.node || null, nodeStale: !!src?.stale, source: src ? "node" : "estimate" });
    return add(key, label, formula);
  };
  const comp = (c, meta = null) => {
    components.push({ finish: "project", workshop: "", condition: "", waste: 0, measure: "length", generated: true, ...c });
    if (meta) structure.pieces[c.role] = { code: c.seriesCode, ...meta };
  };

  // ---------- frame (one piece per side) ----------
  const nf = node("frame", F);
  const jd = link("x_jd", "Dormant : de la cote au jour (par côté)", formulaOr(d.frame.clear, fromNode(nf, "clear", DEFAULTS.frameClear(F))), "frameClear", [F], "frame", nf);
  const cov = link("x_cov", "Dormant : au-delà de la cote (par côté)", formulaOr(d.frame.cover, fromNode(nf, "cover", `${F}.ae`)), "frameCover", [F], "frame", nf);
  const j45 = d.frame.joint === "45";
  const frameAngle = j45 ? "45/45" : "90/90";
  const frameV = j45 ? `H + 2*${cov}` : `H + 2*${cov} - 2*${F}.hp`;
  const framePiece = (pos, label, length, tags) => comp(
    { role: `dormant_${pos}`, label: `Dormant — ${label}`, kind: "profile", seriesCode: F, qty: "1", length, angle: frameAngle },
    { tags, node: "frame", group: "frame" },
  );
  framePiece("top", "traverse haute", `L + 2*${cov}`, ["top", "horizontal"]);
  framePiece("bottom", "traverse basse", `L + 2*${cov}`, ["bottom", "horizontal"]);
  framePiece("left", j45 ? "montant gauche" : "montant gauche (entre traverses)", frameV, ["left", "vertical"]);
  framePiece("right", j45 ? "montant droit" : "montant droit (entre traverses)", frameV, ["right", "vertical"]);
  structure.corners.push({ code: F, joint: d.frame.joint, count: 4, group: "frame" });
  regions.push({ id: "frame", node: "frame", type: "frame", x: `0 - ${cov}`, y: `0 - ${cov}`, w: `L + 2*${cov}`, h: `H + 2*${cov}`, code: F });
  regions.push({ id: "frameJour", node: "frame", type: "jour", x: jd, y: jd, w: `L - 2*${jd}`, h: `H - 2*${jd}` });

  // ---------- opening tree ----------
  // cells numbered in reading order (Fixe 1, Ouvrant 2…) for the labels
  const cellNo = new Map();
  const number = (n) => { if (n.kind === "split") n.parts.forEach((x) => number(x.node)); else cellNo.set(n.id, cellNo.size + 1); };
  number(d.root);
  const divCount = { v: 0, h: 0 };
  const walk = (n, r) => {
    const p = `x_${n.id}`;
    const no = cellNo.get(n.id);
    if (n.kind === "split") {
      const v = n.dir === "v";
      const nm = node("mullion", n.code);
      const c = link(`${p}_c`, `${v ? "Meneau" : "Traverse"} ${n.code} : de l'axe au jour (par côté)`, formulaOr(n.clear, fromNode(nm, "half", DEFAULTS.splitClear(n.code))), "splitClear", [n.code], n.id, nm);
      const e = link(`${p}_e`, `${v ? "Meneau" : "Traverse"} ${n.code} : allongement à chaque bout`, formulaOr(n.end, fromNode(nm, "end", DEFAULTS.splitEnd())), "splitEnd", [n.code, F], n.id, nm);
      const span = v ? r.w : r.h;
      const fixed = n.parts.filter((x) => x.size).reduce((s, x) => s + x.size, 0);
      const autoCount = n.parts.filter((x) => !x.size).length;
      const a = autoCount ? add(`${p}_a`, "Partie automatique", `(${span} - ${n.parts.length - 1}*2*${c} - ${fixed}) / ${autoCount}`) : null;
      let offset = "0";
      n.parts.forEach((part, i) => {
        const size = part.size ? String(part.size) : a;
        const childPos = add(`${p}_p${i}`, `Position partie ${i + 1}`, `${v ? r.x : r.y} + ${offset}`);
        const child = v ? { x: childPos, y: r.y, w: size, h: r.h } : { x: r.x, y: childPos, w: r.w, h: size };
        walk(part.node, child);
        if (i < n.parts.length - 1) {
          const regionId = `${n.id}_m${i}`;
          regions.push(v
            ? { id: regionId, node: n.id, type: "mullion", x: `${childPos} + ${size}`, y: r.y, w: `2*${c}`, h: r.h, code: n.code }
            : { id: regionId, node: n.id, type: "transom", x: r.x, y: `${childPos} + ${size}`, w: r.w, h: `2*${c}`, code: n.code });
          divCount[n.dir] += 1;
          comp(
            { role: `div_${regionId}`, label: `${v ? "Meneau" : "Traverse"} ${divCount[n.dir]} (${n.code})`, kind: "profile", seriesCode: n.code, qty: "1", length: `${v ? r.h : r.w} + 2*${e}`, angle: "90/90" },
            { tags: [v ? "mullion" : "transom", v ? "vertical" : "horizontal"], node: n.id, group: "div", region: regionId },
          );
        }
        offset = `${offset} + ${size} + 2*${c}`;
      });
      structure.joints.push({ code: n.code, count: 2 * (n.parts.length - 1), dir: n.dir });
      return;
    }

    // ---------- cell ----------
    regions.push({ id: n.id, node: n.id, type: "cell", x: r.x, y: r.y, w: r.w, h: r.h, no });
    const bead = n.beadCode || d.beadCode;
    const infill = (gx, gy, gw, gh, qty, tag, regionId, inSash) => {
      if (n.infill === "none") return;
      const isGlass = n.infill === "glass";
      if (isGlass) hasGlass = true; else hasPanel = true;
      if (qty > 0) {
        comp({
          role: `${isGlass ? "verre" : "panneau"}_${n.id}${tag}`, label: `${isGlass ? "Vitrage" : "Panneau"} case ${no}${tag ? ` vantail ${tag.slice(1)}` : ""}`,
          kind: "model", modelParam: isGlass ? "vitrage" : "panneau", measure: "count", qty: String(qty), width: gw, height: gh,
          workshop: isGlass ? "VIT" : "", finish: "none",
        });
        structure.panes.push({ node: n.id, no, type: n.infill, w: gw, h: gh, qty, inSash, code: inSash ? n.sash.code : F });
      }
      regions.push({ id: `${regionId}_g`, node: n.id, type: isGlass ? "glass" : "panel", x: gx, y: gy, w: gw, h: gh, no });
    };
    const beads = (lenH, lenV, qty, label) => {
      if (!bead || n.infill === "none") return;
      comp({ role: `par_${n.id}_h`, label: `Parcloses horizontales ${label}`, kind: "profile", seriesCode: bead, qty: String(qty), length: lenH, angle: "90/90" },
        { tags: ["bead", "horizontal"], node: n.id, group: "bead" });
      comp({ role: `par_${n.id}_v`, label: `Parcloses verticales ${label}`, kind: "profile", seriesCode: bead, qty: String(qty), length: lenV, angle: "90/90" },
        { tags: ["bead", "vertical"], node: n.id, group: "bead" });
    };

    if (n.fill === "fixed") {
      const ng = node("fixedGlazing", F);
      const b = link(`${p}_b`, `Case ${no} (fixe) : prise du remplissage dans la feuillure (par côté)`, formulaOr(n.bite, fromNode(ng, "bite", DEFAULTS.fixedBite(F))), "fixedBite", [F], n.id, ng);
      const gw = add(`${p}_gw`, `Case ${no} : largeur remplissage`, `${r.w} + 2*${b}`);
      const gh = add(`${p}_gh`, `Case ${no} : hauteur remplissage`, `${r.h} + 2*${b}`);
      infill(`${r.x} - ${b}`, `${r.y} - ${b}`, gw, gh, 1, "", n.id, false);
      if (bead && n.infill !== "none") {
        const be = link(`${p}_be`, `Case ${no} (fixe) : parclose au-delà du jour (par côté)`, formulaOr(n.beadExtra, fromNode(ng, "beadExtra", "0")), "fixedBead", [F, bead], n.id, ng);
        beads(`${r.w} + 2*${be}`, `${r.h} + 2*${be}`, 2, `case ${no}`);
      }
      return;
    }

    // sash
    const s = n.sash;
    const S = s.code;
    const leaves = s.leaves;
    const nfs = node("frameSash", F, S);
    const nmt = leaves === 2 ? node("meeting", S, s.meetingCode || "") : null;
    const nsg = node("sashGlazing", S);
    const o = link(`${p}_o`, `Case ${no} (ouvrant) : recouvrement sur le jour (par côté)`, formulaOr(s.overlap, fromNode(nfs, "overlap", DEFAULTS.sashOverlap(S))), "sashOverlap", [S, F], n.id, nfs);
    const m = leaves === 2
      ? link(`${p}_m`, `Case ${no} (ouvrant) : recouvrement entre vantaux`, formulaOr(s.meeting, fromNode(nmt, "meeting", DEFAULTS.meeting(s.meetingCode))), "meeting", [S, s.meetingCode].filter(Boolean), n.id, nmt)
      : null;
    const g = link(`${p}_g`, `Case ${no} (ouvrant) : du bord de l'ouvrant au verre`, formulaOr(s.glass, fromNode(nsg, "glassEdge", DEFAULTS.sashGlass(S))), "sashGlass", [S], n.id, nsg);
    const sc = link(`${p}_sc`, `Case ${no} (ouvrant) : du bord de l'ouvrant à la parclose`, formulaOr(s.clear, fromNode(nsg, "beadStart", DEFAULTS.sashClear(S))), "sashClear", [S], n.id, nsg);
    const lw = add(`${p}_lw`, `Case ${no} : largeur vantail`, leaves === 2 ? `(${r.w} + 2*${o} + ${m}) / 2` : `${r.w} + 2*${o}`);
    const lh = add(`${p}_lh`, `Case ${no} : hauteur vantail`, `${r.h} + 2*${o}`);
    const gw = add(`${p}_gw`, `Case ${no} : largeur vitrage`, `${lw} - 2*${g}`);
    const gh = add(`${p}_gh`, `Case ${no} : hauteur vitrage`, `${lh} - 2*${g}`);
    const op = s.opening;
    const slide = op === "slide";
    const sideHung = !slide && (leaves === 2 || /left|right/.test(op));
    const hingeSide = op.endsWith("right") ? "right" : "left";
    const lockSide = hingeSide === "left" ? "right" : "left";
    const sashMeta = (tags) => ({ tags, node: n.id, group: "sash", leaf: n.id });
    const sashPiece = (pos, label, qty, length, tags) => comp(
      { role: `ouv_${n.id}_${pos}`, label: `Ouvrant case ${no} — ${label}`, kind: "profile", seriesCode: S, qty: String(qty), length, angle: "45/45" },
      sashMeta(tags),
    );
    sashPiece("top", "traverse haute", leaves, lw, ["top", "horizontal", ...(op === "top" ? ["hinge"] : op === "bottom" ? ["lock"] : [])]);
    sashPiece("bottom", "traverse basse", leaves, lw, ["bottom", "horizontal", ...(op === "bottom" ? ["hinge"] : op === "top" ? ["lock"] : [])]);
    if (sideHung && leaves === 1) {
      sashPiece("hinge", "montant côté paumelles", 1, lh, ["vertical", "hinge", hingeSide]);
      sashPiece("lock", "montant côté poignée", 1, lh, ["vertical", "lock", lockSide]);
    } else if (sideHung) {
      sashPiece("hinge", "montants côté paumelles", 2, lh, ["vertical", "hinge"]);
      sashPiece("lock", "montants côté battement", 2, lh, ["vertical", "lock"]);
    } else {
      sashPiece("left", "montant gauche", leaves, lh, ["vertical", "left"]);
      sashPiece("right", "montant droit", leaves, lh, ["vertical", "right"]);
    }
    structure.corners.push({ code: S, joint: "45", count: 4 * leaves, group: "sash" });
    if (leaves === 2 && s.meetingCode) {
      comp({ role: `bat_${n.id}`, label: `Battement case ${no}`, kind: "profile", seriesCode: s.meetingCode, qty: "1", length: lh, angle: "90/90" },
        { tags: ["meeting", "vertical"], node: n.id, group: "meeting", leaf: n.id });
    }
    beads(`${lw} - 2*${sc}`, `${lh} - 2*${sc}`, 2 * leaves, `ouvrant case ${no}`);
    for (let i = 0; i < leaves; i += 1) {
      const lx = i === 0 ? `${r.x} - ${o}` : `${r.x} + ${r.w} + ${o} - ${lw}`;
      const ly = `${r.y} - ${o}`;
      const hinge = leaves === 2 ? (i === 0 ? "left" : "right") : op;
      const opening = op.startsWith("tilt") ? `tilt-${hinge.replace("tilt-", "")}` : hinge;
      regions.push({ id: `${n.id}_l${i}`, node: n.id, type: "leaf", x: lx, y: ly, w: lw, h: lh, code: S, opening, slide });
      structure.leaves.push({
        node: n.id, no, index: i, leaves, code: S, opening: slide ? "slide" : opening, tilt: op.startsWith("tilt"),
        // 2 vantaux: the main leaf (with the handle) is on the side of the chosen opening
        active: leaves === 1 || i === (hingeSide === "left" ? 0 : 1),
        lw, lh, gw, gh, infill: n.infill, meetingCode: s.meetingCode || "", beadCode: bead || "",
      });
      if (n.infill !== "none") {
        const gx = `${lx} + ${g}`;
        const gy = `${ly} + ${g}`;
        infill(gx, gy, gw, gh, i === 0 ? leaves : 0, leaves === 2 ? `_${i + 1}` : "", `${n.id}_l${i}`, true);
      }
    }
  };
  walk(d.root, { x: "x_jd", y: "x_jd", w: "(L - 2*x_jd)", h: "(H - 2*x_jd)" });

  const parameters = [];
  if (hasGlass) parameters.push({ key: "vitrage", label: "Vitrage", type: "model", family: "vitrage" });
  if (hasPanel) parameters.push({ key: "panneau", label: "Panneau de remplissage", type: "model", family: "remplissage" });
  structure.nodes = [...new Set(links.map((l) => l.profileNode).filter(Boolean))];
  return { derived, components, parameters, regions, links, structure };
}

/** Evaluates the drawing regions with the calculation variables (mm). */
function layoutOf(regions, vars) {
  const out = [];
  for (const r of regions) {
    try {
      const n = (f) => Math.round(evaluate(f, vars) * 10) / 10;
      out.push({ ...r, x: n(r.x), y: n(r.y), w: n(r.w), h: n(r.h) });
    } catch {
      // a region whose profile is missing from the series: not drawn
    }
  }
  return out;
}

/**
 * Merges a generated design into a model body: generated parts are
 * replaced, the parts added by hand are kept.
 */
function mergeIntoModel(existing, gen) {
  const keepDerived = (existing?.derived || []).filter((x) => !String(x.key).startsWith("x_"));
  const keepComponents = (existing?.components || []).filter((c) => !c.generated);
  const genKeys = new Set(gen.parameters.map((x) => x.key));
  const keepParams = (existing?.parameters || []).filter((x) => !genKeys.has(x.key));
  return {
    parameters: [...gen.parameters, ...keepParams],
    derived: [...gen.derived, ...keepDerived],
    components: [...gen.components, ...keepComponents],
  };
}

module.exports = { DEFAULTS, cleanDesign, generate, layoutOf, mergeIntoModel };
