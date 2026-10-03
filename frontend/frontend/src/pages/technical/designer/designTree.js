/**
 * Pure helpers for the CAD design tree (see backend services/chassisDesign.js):
 *   { frame: { code, joint, clear }, beadCode, root: Node, preview: { L, H, quantity } }
 *   Node = { id, kind: "cell", fill: "fixed"|"sash", infill, beadCode, bite, sash? }
 *        | { id, kind: "split", dir: "v"|"h", code, clear, end, parts: [{ size, node }] }
 */

let counter = 0;
export const newId = () => {
  counter += 1;
  return `n${Date.now().toString(36).slice(-3)}${counter}`.slice(0, 8);
};

/** First code of the library matching one of the prefixes ("MEN", "TRA"…), else the first one. */
export function pickCode(codes, prefixes, fallback = "") {
  for (const p of prefixes) {
    const hit = codes.find((c) => c.startsWith(p));
    if (hit) return hit;
  }
  return fallback || codes[0] || "";
}

export const newCell = (over = {}) => ({ id: newId(), kind: "cell", fill: "fixed", infill: "glass", beadCode: "", bite: "", ...over });

/** A new drawing: a frame with one glazed opening; profiles are attributed later (step Profilés). */
export function defaultDesign(_codes = [], { L = 1200, H = 1400 } = {}) {
  return {
    frame: { code: "", joint: "45", clear: "", cover: "" },
    beadCode: "",
    profiles: { frame: "", sash: "", mullion: "", transom: "", bead: "", meeting: "" },
    root: newCell(),
    preview: { L, H, quantity: 1 },
  };
}

/** Finds a node by id (with its parent split and index). */
export function findNode(root, id, parent = null, index = -1) {
  if (!root) return null;
  if (root.id === id) return { node: root, parent, index };
  if (root.kind === "split") {
    for (let i = 0; i < root.parts.length; i += 1) {
      const hit = findNode(root.parts[i].node, id, root, i);
      if (hit) return hit;
    }
  }
  return null;
}

/** Returns a new tree where node `id` is replaced by fn(node). */
export function updateNode(root, id, fn) {
  if (root.id === id) return fn(root);
  if (root.kind !== "split") return root;
  return { ...root, parts: root.parts.map((p) => ({ ...p, node: updateNode(p.node, id, fn) })) };
}

/** A cell becomes a split of `n` cells (copies of it), with a meneau (v) or a traverse (h). */
export function splitCell(root, id, dir, n, code, splitId = newId()) {
  return updateNode(root, id, (cell) => ({
    id: splitId, kind: "split", dir, code, clear: "", end: "",
    parts: Array.from({ length: n }, () => ({ size: null, node: { ...JSON.parse(JSON.stringify(cell)), id: newId() } })),
  }));
}

/** A split is removed: its first part takes its place. */
export function unsplit(root, id) {
  return updateNode(root, id, (split) => split.parts[0].node);
}

export function allNodes(root, out = []) {
  out.push(root);
  if (root.kind === "split") root.parts.forEach((p) => allNodes(p.node, out));
  return out;
}

/** Codes used by the design (for "missing from the series" warnings). */
export function usedCodes(design) {
  const set = new Set([design.frame.code, design.beadCode, ...Object.values(design.profiles || {})].filter(Boolean));
  for (const n of allNodes(design.root)) {
    if (n.kind === "split") set.add(n.code);
    else {
      if (n.beadCode) set.add(n.beadCode);
      if (n.sash) { set.add(n.sash.code); if (n.sash.meetingCode) set.add(n.sash.meetingCode); }
    }
  }
  set.delete("");
  return [...set];
}

/** Where a liaison (link.kind) is stored in the design. */
export const LINK_FIELDS = {
  frameClear: () => ["frame", "clear"],
  frameCover: () => ["frame", "cover"],
  fixedBead: () => ["node", "beadExtra"],
  splitClear: () => ["node", "clear"],
  splitEnd: () => ["node", "end"],
  fixedBite: () => ["node", "bite"],
  sashOverlap: () => ["sash", "overlap"],
  sashGlass: () => ["sash", "glass"],
  sashClear: () => ["sash", "clear"],
  meeting: () => ["sash", "meeting"],
};

/** Sets (or clears with "") the override of a liaison. */
export function setLink(design, link, value) {
  if (!LINK_FIELDS[link.kind]) return design;
  const [where, field] = LINK_FIELDS[link.kind](design);
  const v = value === null || value === undefined ? "" : String(value);
  if (where === "frame") return { ...design, frame: { ...design.frame, [field]: v } };
  return {
    ...design,
    root: updateNode(design.root, link.node, (n) => (where === "sash" ? { ...n, sash: { ...n.sash, [field]: v } } : { ...n, [field]: v })),
  };
}

/** Current override of a liaison ("" = default formula). */
export function getLinkOverride(design, link) {
  if (!LINK_FIELDS[link.kind]) return "";
  const [where, field] = LINK_FIELDS[link.kind](design);
  if (where === "frame") return design.frame[field] || "";
  const hit = findNode(design.root, link.node);
  if (!hit) return "";
  return (where === "sash" ? hit.node.sash?.[field] : hit.node[field]) || "";
}

// ------------------------------------------------------------------
// Drag & drop editing (palette → drawing, dividers, deletion)
// ------------------------------------------------------------------
const clone = (x) => JSON.parse(JSON.stringify(x));
const freshCell = (cell) => ({ ...clone(cell), id: newId() });

/** Roles present in the drawing (what the Profilés step must attribute). */
export function rolesOf(design) {
  const roles = new Set(["frame"]);
  if (!design?.root) return [];
  for (const n of allNodes(design.root)) {
    if (n.kind === "split") roles.add(n.dir === "v" ? "mullion" : "transom");
    else {
      if (n.fill === "sash") { roles.add("sash"); if (n.sash?.leaves === 2) roles.add("meeting"); }
      if (n.infill !== "none") roles.add("bead");
    }
  }
  return [...roles];
}

/**
 * Splits a cell where a meneau (v) / traverse (h) was dropped. `offset` is
 * the distance (mm, in the opening) from the cell's left / top edge. When
 * the cell is already a part of a split in the same direction, a part is
 * added to that split instead of nesting a new one (one profile line).
 */
export function dropDivider(design, cellId, dir, offset, cellSize, dividerWidth = 60) {
  const hit = findNode(design.root, cellId);
  if (!hit) return design;
  const a = Math.max(100, Math.round(offset - dividerWidth / 2));
  if (cellSize - a - dividerWidth < 100) return design;
  const { node, parent, index } = hit;
  if (parent && parent.dir === dir) {
    const old = parent.parts[index];
    const second = old.size ? Math.round(old.size - a - dividerWidth) : null;
    const parts = [...parent.parts];
    parts.splice(index, 1, { size: a, node: freshCell(node) }, { size: second, node: freshCell(node) });
    if (parts.length > 8) return design;
    return { ...design, root: updateNode(design.root, parent.id, (sp) => ({ ...sp, parts })) };
  }
  const split = { id: newId(), kind: "split", dir, code: "", clear: "", end: "", parts: [{ size: a, node: freshCell(node) }, { size: null, node: freshCell(node) }] };
  return { ...design, root: updateNode(design.root, cellId, () => split) };
}

/** Applies a palette item dropped on a cell. */
export function dropOnCell(design, cellId, item) {
  return {
    ...design,
    root: updateNode(design.root, cellId, (cell) => {
      if (cell.kind !== "cell") return cell;
      if (item.t === "sash") return { ...cell, fill: "sash", sash: { code: cell.sash?.code || "", leaves: item.leaves === 2 ? 2 : 1, opening: item.opening || "left", meetingCode: cell.sash?.meetingCode || "", overlap: "", glass: "", clear: "", meeting: "" } };
      if (item.t === "fixed") return { ...cell, fill: "fixed", sash: undefined };
      if (item.t === "infill") return { ...cell, infill: item.infill };
      return cell;
    }),
  };
}

/**
 * Moves divider `index` of a split by `delta` mm. partSizes = current widths
 * (or heights) of its parts as drawn. The two neighbouring parts take the
 * change; the split keeps at least one automatic part so the frame can
 * still be resized.
 */
export function moveDivider(design, splitId, index, delta, partSizes) {
  const hit = findNode(design.root, splitId);
  if (!hit || hit.node.kind !== "split") return design;
  const sp = hit.node;
  const a = Math.round((partSizes[index] || 0) + delta);
  const b = Math.round((partSizes[index + 1] || 0) - delta);
  if (a < 100 || b < 100) return design;
  const parts = sp.parts.map((p) => ({ ...p }));
  parts[index].size = a;
  const otherAuto = parts.some((p, i) => i !== index && i !== index + 1 && !p.size);
  parts[index + 1].size = parts[index + 1].size || otherAuto ? b : null;
  if (!parts.some((p) => !p.size)) parts[parts.length - 1 === index ? index + 1 : parts.length - 1].size = null;
  return { ...design, root: updateNode(design.root, splitId, (n) => ({ ...n, parts })) };
}

/** Sets the width / height of one part (dimension typed on the drawing). */
export function setPartSize(design, splitId, index, size, partSizes) {
  const cur = partSizes[index] || 0;
  return moveDivider(design, splitId, index < partSizes.length - 1 ? index : index - 1, index < partSizes.length - 1 ? size - cur : cur - size, partSizes);
}

/** Deletes an element: a divider merges its parts, a part disappears, a sash becomes fixed. */
export function deleteElement(design, id) {
  if (!id || id === "frame") return design;
  const hit = findNode(design.root, id);
  if (!hit) return design;
  const { node, parent, index } = hit;
  if (node.kind === "split") return { ...design, root: updateNode(design.root, id, (sp) => freshCell(firstCell(sp))) };
  if (node.fill === "sash") return { ...design, root: updateNode(design.root, id, (c) => ({ ...c, fill: "fixed", sash: undefined })) };
  if (!parent) return design;
  if (parent.parts.length > 2) {
    const parts = parent.parts.filter((_, i) => i !== index).map((p, i, arr) => (i === arr.length - 1 && !arr.some((x) => !x.size) ? { ...p, size: null } : p));
    return { ...design, root: updateNode(design.root, parent.id, (sp) => ({ ...sp, parts })) };
  }
  const sibling = parent.parts[index === 0 ? 1 : 0].node;
  return { ...design, root: updateNode(design.root, parent.id, () => sibling) };
}
const firstCell = (n) => (n.kind === "split" ? firstCell(n.parts[0].node) : n);

/** Ready-made drawings (gabarits) — the frame size is kept. */
export function template(key, design) {
  const cell = (over = {}) => newCell(over);
  const sash = (opening, leaves = 1) => cell({ fill: "sash", sash: { code: "", leaves, opening, meetingCode: "", overlap: "", glass: "", clear: "", meeting: "" } });
  const split = (dir, parts) => ({ id: newId(), kind: "split", dir, code: "", clear: "", end: "", parts: parts.map((p) => (p.node ? p : { size: null, node: p })) });
  const roots = {
    fixed: () => cell(),
    ob: () => sash("tilt-right"),
    two: () => sash("left", 2),
    fixedOb: () => split("v", [cell(), sash("tilt-right")]),
    obFixedOb: () => split("v", [sash("tilt-left"), cell(), sash("tilt-right")]),
    imposte: () => split("h", [{ size: 400, node: sash("bottom") }, sash("left", 2)]),
    allege: () => split("h", [sash("tilt-right"), { size: 500, node: cell({ infill: "panel" }) }]),
    door: () => split("h", [{ size: 450, node: cell() }, sash("left")]),
  };
  return { ...design, root: (roots[key] || roots.fixed)() };
}

/** Extent (mm, as drawn) of every part of every split: Map splitId → [{ x0, x1, y0, y1 }]. */
export function partExtents(design, layout) {
  const cells = new Map((layout || []).filter((r) => r.type === "cell").map((r) => [r.node, r]));
  const out = new Map();
  const ext = (n) => {
    if (n.kind !== "split") {
      const r = cells.get(n.id);
      return r ? { x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h } : null;
    }
    const parts = n.parts.map((p) => ext(p.node));
    out.set(n.id, parts);
    const ok = parts.filter(Boolean);
    if (!ok.length) return null;
    return { x0: Math.min(...ok.map((e) => e.x0)), x1: Math.max(...ok.map((e) => e.x1)), y0: Math.min(...ok.map((e) => e.y0)), y1: Math.max(...ok.map((e) => e.y1)) };
  };
  if (design?.root) ext(design.root);
  return out;
}
