/**
 * NODE TYPES — how two profiles meet (backend services/profileNodes.js).
 * In the section editor: X = in the plane of the window (left = towards
 * the frame / wall), Y = depth (exterior up). The MAIN profile sits at
 * its bbox origin; the other elements are placed against it; reference
 * lines (cote, jour, axe) are vertical lines. The values the CAD uses are
 * measured from those positions.
 */
export const NODE_TYPES = {
  frame: {
    label: "Dormant — cote et jour", short: "Dormant",
    hint: "Placez la ligne de COTE (bord du tableau / de la cote de commande) et la ligne de JOUR (bord intérieur visible du dormant).",
    main: ["frame"], refs: ["cote", "jour"], values: ["cover", "clear"],
  },
  frameSash: {
    label: "Dormant / meneau ↔ ouvrant", short: "Dormant ↔ ouvrant",
    hint: "Glissez l'ouvrant contre le dormant (ou le meneau) dans sa position fermée ; la ligne de jour est le bord intérieur visible du dormant.",
    main: ["frame", "mullion"], second: ["sash"], refs: ["jour"], values: ["overlap"],
  },
  sashGlazing: {
    label: "Ouvrant ↔ vitrage et parclose", short: "Ouvrant ↔ vitrage",
    hint: "Placez le vitrage (épaisseur de la composition) en feuillure et la parclose qui le tient. Les cotes partent du bord extérieur de l'ouvrant (X = 0).",
    main: ["sash"], bead: true, glass: true, refs: [], values: ["glassEdge", "beadStart"],
  },
  fixedGlazing: {
    label: "Dormant / meneau ↔ vitrage fixe", short: "Vitrage fixe",
    hint: "Placez le vitrage et la parclose dans la feuillure du dormant (ou du meneau). La prise et la parclose se mesurent depuis la ligne de jour.",
    main: ["frame", "mullion"], bead: true, glass: true, refs: ["jour"], values: ["bite", "beadExtra"],
  },
  mullion: {
    label: "Meneau / traverse", short: "Meneau",
    hint: "Placez l'AXE du meneau et la ligne de JOUR (bord visible). L'allongement est la longueur ajoutée à chaque bout (pénétration dans le dormant, 0 en coupe droite).",
    main: ["mullion"], refs: ["axis", "jour"], values: ["half", "end"], numeric: ["end"],
  },
  meeting: {
    label: "Ouvrant ↔ ouvrant (2 vantaux)", short: "2 vantaux",
    hint: "Le vantail de gauche est retourné (son bord est à X = 0). Glissez le vantail de droite pour régler le recouvrement ; ajoutez le battement si la série en a un.",
    main: ["sash"], second: ["meeting"], optionalSecond: true, refs: [], values: ["meeting"],
  },
};

export const VALUE_LABELS = {
  cover: "Dormant au-delà de la cote", clear: "Cote → jour", overlap: "Recouvrement ouvrant",
  glassEdge: "Bord ouvrant → verre", beadStart: "Bord ouvrant → parclose", bite: "Prise du verre sous le jour",
  beadExtra: "Parclose au-delà du jour", half: "Axe → jour", end: "Allongement à chaque bout", meeting: "Recouvrement entre vantaux",
};
export const REF_LABELS = { cote: "COTE", jour: "JOUR", axis: "AXE" };

const W = (s) => s?.metrics?.width || 60;
const H = (s) => s?.metrics?.height || 60;

/** Starting positions for a new node (sensible guesses the user then adjusts). */
export function defaultPlacements(type, sec) {
  const m = sec.main;
  switch (type) {
    case "frame": return { cote: 0, jour: W(m) };
    case "frameSash": return { jour: W(m), second: { x: W(m) - 8, y: 0 } };
    case "sashGlazing": return { glass: { x: Math.round(W(m) * 0.45), y: H(m) * 0.35 }, bead: { x: Math.round(W(m) * 0.55), y: 2 } };
    case "fixedGlazing": return { jour: W(m), glass: { x: W(m) - 8, y: H(m) * 0.35 }, bead: { x: W(m) - 2, y: 2 } };
    case "mullion": return { axis: W(m) / 2, jour: W(m), end: 0 };
    case "meeting": return { second: { x: -8, y: 0 }, bat: { x: -20, y: H(m) * 0.6 } };
    default: return {};
  }
}

/** The values the CAD uses, measured from the placements. */
export function measure(type, pl) {
  const r = (v) => Math.round(Number(v || 0) * 100) / 100;
  switch (type) {
    case "frame": return { cover: r(pl.cote), clear: r(pl.jour - pl.cote) };
    case "frameSash": return { overlap: r(pl.jour - (pl.second?.x || 0)) };
    case "sashGlazing": return { glassEdge: r(pl.glass?.x), beadStart: r(pl.bead?.x) };
    case "fixedGlazing": return { bite: r(pl.jour - (pl.glass?.x || 0)), beadExtra: r(pl.jour - (pl.bead?.x || 0)) };
    case "mullion": return { half: r(pl.jour - pl.axis), end: r(pl.end) };
    case "meeting": return { meeting: r(-(pl.second?.x || 0)) };
    default: return {};
  }
}

/** Dimension lines to draw: [{ x1, x2, label, key }] (y chosen by the canvas). */
export function dimsOf(type, pl, sec) {
  const v = measure(type, pl);
  switch (type) {
    case "frame": return [{ x1: 0, x2: pl.cote, key: "cover" }, { x1: pl.cote, x2: pl.jour, key: "clear" }].map((d) => ({ ...d, value: v[d.key] }));
    case "frameSash": return [{ x1: pl.second?.x, x2: pl.jour, key: "overlap", value: v.overlap }];
    case "sashGlazing": return [{ x1: 0, x2: pl.glass?.x, key: "glassEdge", value: v.glassEdge }, { x1: 0, x2: pl.bead?.x, key: "beadStart", value: v.beadStart }];
    case "fixedGlazing": return [{ x1: pl.glass?.x, x2: pl.jour, key: "bite", value: v.bite }, { x1: pl.bead?.x, x2: pl.jour, key: "beadExtra", value: v.beadExtra }];
    case "mullion": return [{ x1: pl.axis, x2: pl.jour, key: "half", value: v.half }];
    case "meeting": return [{ x1: pl.second?.x, x2: 0, key: "meeting", value: v.meeting }];
    default: return [];
  }
}

/**
 * Elements of the scene: [{ key, section, pl: { x, y, flipX }, kind: fixed|moving|bead|glass, draggable }]
 * sec = { main, second, bead } sections ; t = glass thickness
 */
export function elementsOf(type, pl, sec, t = 24) {
  const out = [];
  if (type === "meeting") {
    out.push({ key: "main", section: sec.main, pl: { x: 0, y: 0, flipX: true }, kind: "fixed" });
    out.push({ key: "second", section: sec.main, pl: { x: pl.second?.x || 0, y: pl.second?.y || 0 }, kind: "moving", draggable: true });
    if (sec.second) out.push({ key: "bat", section: sec.second, pl: { x: pl.bat?.x || 0, y: pl.bat?.y || 0 }, kind: "bead", draggable: true });
    return out;
  }
  out.push({ key: "main", section: sec.main, pl: { x: 0, y: 0 }, kind: "fixed" });
  if (NODE_TYPES[type].second && sec.second) out.push({ key: "second", section: sec.second, pl: { x: pl.second?.x || 0, y: pl.second?.y || 0 }, kind: "moving", draggable: true });
  if (NODE_TYPES[type].glass) out.push({ key: "glass", glass: true, pl: { x: pl.glass?.x || 0, y: pl.glass?.y || 0 }, w: Math.max(120, W(sec.main) * 1.2), t, kind: "glass", draggable: true });
  if (NODE_TYPES[type].bead && sec.bead) out.push({ key: "bead", section: sec.bead, pl: { x: pl.bead?.x || 0, y: pl.bead?.y || 0 }, kind: "bead", draggable: true });
  return out;
}

/** Bounds of the scene (world mm). */
export function sceneBounds(elements, pl) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const e of elements) {
    const w = e.glass ? e.w : W(e.section);
    const h = e.glass ? e.t : H(e.section);
    const ex0 = e.pl.flipX ? e.pl.x - w : e.pl.x;
    x0 = Math.min(x0, ex0); x1 = Math.max(x1, ex0 + w); y0 = Math.min(y0, e.pl.y); y1 = Math.max(y1, e.pl.y + h);
  }
  for (const k of ["cote", "jour", "axis"]) if (Number.isFinite(pl[k])) { x0 = Math.min(x0, pl[k]); x1 = Math.max(x1, pl[k]); }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 100, y1: 60 };
}
