/**
 * ============================================================
 * FABRICATION RULES (accessoires & usinages d'une série)
 * ============================================================
 * Like LogiKal: the series knows, once, which ARTICLES and which
 * MACHINING go with its profiles. A chassis drawn in the CAD then gets
 * them automatically, at every calculation (devis, projet, ateliers):
 *
 * The rules are carried by the PROFILE ARTICLES (Product.fabRules: what
 * goes with this profile) and by the NODES (ProfileNode.rules: what goes
 * with this combination of profiles).
 *
 *   accessory rules — "what to add":
 *     trigger  chassis   once per chassis          (vis de fixation…)
 *              piece     per profile piece         (joint de frappe = long)
 *              corner    per corner of a frame     (équerres de coin)
 *              joint     per meneau/traverse end   (connecteurs en T)
 *              leaf      per vantail               (ferrure, paumelles, poignée)
 *              pane      per vitrage / panneau     (cales, joint de vitrage)
 *     filters  profile codes, positions (haut, bas, côté paumelles…),
 *              opening (OF, OB, soufflet…), vantail principal / semi-fixe,
 *              size range (min/max L, H) and weight (kg) of the leaf,
 *              free condition formula
 *     quantity formula (number of articles), or length formula for an
 *              article sold by the metre (joints)
 *     group    rules of one group are alternatives ("Ferrure" S / M / L
 *              by leaf size): a leaf no rule of the group fits is flagged
 *
 *   machining rules (on the profile) — "what to machine":
 *     on the pieces of a profile code / position, an operation
 *     (drainage, perçage, fraisage serrure, entaille…), its face and
 *     its positions along the piece:
 *       ends    at `offset` from each end
 *       pitch   evenly spaced, at most `pitch` apart, `offset` from the ends
 *       center  middle of the piece (+ offset)
 *       at      list "100; long/2; -100" (negative = from the far end)
 *       joints  where a meneau / traverse meets the piece (computed from
 *               the drawing)
 *
 * Formula variables: those of the model (L, H, CODE.prop, series
 * variables, x_… of the design) plus, per element:
 *   long  length of the piece            lw, lh  vantail width / height
 *   gw, gh  glass / panel size           perim   perimeter of the element
 *   poids   weight of the vantail (kg)   nb      pieces of that position
 * ============================================================
 */
const { evaluate, check } = require("./formulaEngine");
const { generate, layoutOf } = require("./chassisDesign");
const library = require("./seriesLibrary");

const TRIGGERS = ["chassis", "piece", "corner", "joint", "leaf", "pane"];
const TAGS = ["frame", "sash", "div", "bead", "meeting", "top", "bottom", "left", "right", "vertical", "horizontal", "hinge", "lock", "mullion", "transom"];
const OPENINGS = ["left", "right", "tilt-left", "tilt-right", "top", "bottom", "slide"];
const KINDS = ["accessory", "gasket", "consumable"];
const MACHINING_KINDS = ["drain", "drill", "mill", "slot", "notch", "other"];
const PLACES = ["ends", "pitch", "center", "at", "joints"];
const FACES = ["", "ext", "int", "top", "bottom", "side"];
const LOCAL_VARS = ["long", "lw", "lh", "gw", "gh", "perim", "poids", "nb"];
const GLASS_DENSITY = 2.5; // kg per m² per mm of glass

const round = (x, d = 1) => { const f = 10 ** d; return Math.round((Number(x) || 0) * f) / f; };
const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
const str = (v, max = 300) => String(v ?? "").trim().slice(0, max);
const numOrNull = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const pickList = (v, allowed) => [...new Set((Array.isArray(v) ? v : []).filter((x) => allowed.includes(x)))];
const codeList = (v) => [...new Set((Array.isArray(v) ? v : String(v || "").split(/[\s,;]+/)).map((c) => library.normalizeCode(c)).filter(Boolean))];

// ------------------------------------------------------------------
// Cleaning (series page)
// ------------------------------------------------------------------
function checker(known) {
  const list = [...known];
  return (formula, where) => {
    if (!formula) return "";
    const r = check(formula, list);
    if (!r.ok) fail(`${where} : ${r.error}`);
    return formula;
  };
}

/** Names the rule formulas may use: L, H, the profile codes, the series variables and the element variables. */
function knownNames(codes, variables = []) {
  return new Set(["L", "H", "cj", ...LOCAL_VARS, ...library.profileVarNames(codes), ...variables.map((v) => v.key)]);
}

/** Accessory rules from the series page → { rules, productIds } (throws 400). */
function cleanAccessoryRules(input, known) {
  const ok = checker(known);
  const rules = [];
  const productIds = [];
  for (const [i, r] of (Array.isArray(input) ? input : []).entries()) {
    const where = `Règle ${i + 1}${r?.label ? ` (${r.label})` : ""}`;
    if (!r?.product) fail(`${where} : choisissez l'article`);
    if (!/^[a-f0-9]{24}$/i.test(String(r.product?._id || r.product))) fail(`${where} : article invalide`);
    const trigger = TRIGGERS.includes(r.trigger) ? r.trigger : "chassis";
    const measure = r.measure === "length" ? "length" : "count";
    const product = String(r.product?._id || r.product);
    productIds.push(product);
    rules.push({
      label: str(r.label, 150),
      product,
      kind: KINDS.includes(r.kind) ? r.kind : measure === "length" ? "gasket" : "accessory",
      trigger,
      codes: codeList(r.codes),
      tags: pickList(r.tags, TAGS),
      openings: pickList(r.openings, OPENINGS),
      leafRole: ["active", "passive"].includes(r.leafRole) ? r.leafRole : "any",
      infill: ["glass", "panel"].includes(r.infill) ? r.infill : "any",
      where: ["fixed", "sash"].includes(r.where) ? r.where : "any",
      minW: numOrNull(r.minW), maxW: numOrNull(r.maxW), minH: numOrNull(r.minH), maxH: numOrNull(r.maxH), maxKg: numOrNull(r.maxKg),
      condition: ok(str(r.condition, 500), `${where} — condition`),
      measure,
      qty: ok(str(r.qty, 500) || "1", `${where} — quantité`),
      length: measure === "length" ? ok(str(r.length, 500), `${where} — longueur`) : "",
      group: str(r.group, 60),
      finish: r.finish === "project" ? "project" : "none",
      workshop: str(r.workshop, 12).toUpperCase(),
      isActive: r.isActive !== false,
    });
  }
  return { rules, productIds };
}

/** Machining rules from the series page (throws 400). */
function cleanMachiningRules(input, known, { requireTarget = true } = {}) {
  const ok = checker(known);
  const out = [];
  for (const [i, m] of (Array.isArray(input) ? input : []).entries()) {
    const where = `Usinage ${i + 1}${m?.label ? ` (${m.label})` : ""}`;
    if (!str(m?.label)) fail(`${where} : donnez un nom (ex. « Drainage »)`);
    const codes = codeList(m.codes);
    const tags = pickList(m.tags, TAGS);
    if (requireTarget && !codes.length && !tags.length) fail(`${where} : choisissez le(s) profilé(s) ou la position concernés`);
    const place = PLACES.includes(m.place) ? m.place : "ends";
    if (place === "pitch" && !str(m.pitch)) fail(`${where} : indiquez l'entraxe maximum`);
    if (place === "at" && !str(m.at)) fail(`${where} : indiquez la ou les positions`);
    const at = place === "at" ? str(m.at, 500).split(";").map((x) => x.trim()).filter(Boolean) : [];
    at.forEach((f, j) => ok(f, `${where} — position ${j + 1}`));
    out.push({
      label: str(m.label, 100),
      kind: MACHINING_KINDS.includes(m.kind) ? m.kind : "other",
      codes, tags,
      openings: pickList(m.openings, OPENINGS),
      face: FACES.includes(m.face) ? m.face : "",
      place,
      offset: ok(str(m.offset, 300) || "0", `${where} — distance`),
      pitch: place === "pitch" ? ok(str(m.pitch, 300), `${where} — entraxe`) : "",
      at: at.join("; "),
      size: str(m.size, 60),
      tool: str(m.tool, 60),
      condition: ok(str(m.condition, 500), `${where} — condition`),
      isActive: m.isActive !== false,
    });
  }
  return out;
}

// ------------------------------------------------------------------
// Analysis of one chassis
// ------------------------------------------------------------------
function generated(model, series, ctx) {
  if (!model.design || typeof model.design !== "object") return null;
  try { return generate(model.design, require("./profileNodes").lookupFor(series, ctx)); } catch { return null; }
}

const ev = (formula, scope, fallback = 0) => {
  try { return evaluate(formula, scope, fallback); } catch { return fallback; }
};

/** Where each meneau / traverse end lands on the piece that receives it. */
function jointPositions(layout, pieces) {
  const at = {};
  const frame = layout.find((r) => r.type === "frame");
  const jour = layout.find((r) => r.type === "jour");
  if (!frame || !jour) return at;
  const len = Object.fromEntries(pieces.map((p) => [p.role, p.length]));
  const regionOf = Object.fromEntries(pieces.filter((p) => p.region).map((p) => [p.region, p]));
  const divs = layout.filter((r) => r.type === "mullion" || r.type === "transom");
  // start of each horizontal piece (x) / vertical piece (y) in drawing coordinates
  const startH = (role, cx, w) => cx - (len[role] || w) / 2;
  const fx = frame.x + frame.w / 2;
  const fy = frame.y + frame.h / 2;
  const push = (role, pos, code, side) => { if (role && Number.isFinite(pos)) (at[role] = at[role] || []).push({ pos: round(pos, 1), code, side }); };
  const near = (a, b) => Math.abs(a - b) < 1;
  for (const d of divs) {
    const piece = regionOf[d.id];
    if (!piece) continue;
    if (d.type === "mullion") {
      const cx = d.x + d.w / 2;
      for (const [y, side] of [[d.y, "top"], [d.y + d.h, "bottom"]]) {
        let role = null;
        let start = 0;
        if (side === "top" && near(y, jour.y)) { role = "dormant_top"; start = startH(role, fx, frame.w) + 0; }
        else if (side === "bottom" && near(y, jour.y + jour.h)) { role = "dormant_bottom"; start = startH(role, fx, frame.w); }
        else {
          const t = divs.find((x) => x.type === "transom" && (side === "top" ? near(x.y + x.h, y) : near(x.y, y)) && x.x - 1 <= cx && cx <= x.x + x.w + 1);
          if (t && regionOf[t.id]) { role = regionOf[t.id].role; start = startH(role, t.x + t.w / 2, t.w); }
        }
        if (role) push(role, cx - start, piece.code, side === "top" ? "bottom" : "top");
      }
    } else {
      const cy = d.y + d.h / 2;
      for (const [x, side] of [[d.x, "left"], [d.x + d.w, "right"]]) {
        let role = null;
        let start = 0;
        if (side === "left" && near(x, jour.x)) { role = "dormant_left"; start = fy - (len[role] || frame.h) / 2; }
        else if (side === "right" && near(x, jour.x + jour.w)) { role = "dormant_right"; start = fy - (len[role] || frame.h) / 2; }
        else {
          const m = divs.find((y) => y.type === "mullion" && (side === "left" ? near(y.x + y.w, x) : near(y.x, x)) && y.y - 1 <= cy && cy <= y.y + y.h + 1);
          if (m && regionOf[m.id]) { role = regionOf[m.id].role; start = (m.y + m.h / 2) - (len[role] || m.h) / 2; }
        }
        if (role) push(role, cy - start, piece.code, side === "left" ? "right" : "left");
      }
    }
  }
  for (const k of Object.keys(at)) at[k].sort((a, b) => a.pos - b.pos);
  return at;
}

/** Positions of one machining rule along a piece (mm from its left / bottom end). */
function positionsFor(rule, piece, scope, joints) {
  const long = piece.length;
  const off = ev(rule.offset || "0", scope, 0);
  let pos = [];
  if (rule.place === "ends") pos = off * 2 >= long ? [long / 2] : [off, long - off];
  else if (rule.place === "center") pos = [long / 2 + off];
  else if (rule.place === "pitch") {
    const p = ev(rule.pitch, scope, 0);
    const usable = long - 2 * off;
    if (p > 0 && usable > 0) {
      const n = Math.ceil(usable / p - 1e-9) + 1;
      pos = n <= 1 ? [long / 2] : Array.from({ length: n }, (_, i) => off + (i * usable) / (n - 1));
    } else if (usable <= 0) pos = [long / 2];
  } else if (rule.place === "at") {
    pos = String(rule.at || "").split(";").map((f) => f.trim()).filter(Boolean).map((f) => { const v = ev(f, scope, NaN); return v < 0 ? long + v : v; });
  } else if (rule.place === "joints") {
    pos = (joints[piece.role] || []).map((j) => j.pos + off);
  }
  return [...new Set(pos.filter((x) => Number.isFinite(x) && x >= 0 && x <= long + 0.01).map((x) => round(x, 1)))].sort((a, b) => a - b);
}

const sizeOk = (r, w, h) => !((r.minW !== null && r.minW !== undefined && w < r.minW - 1e-9) || (r.maxW !== null && r.maxW !== undefined && w > r.maxW + 1e-9)
  || (r.minH !== null && r.minH !== undefined && h < r.minH - 1e-9) || (r.maxH !== null && r.maxH !== undefined && h > r.maxH + 1e-9));
const tagsOk = (wanted, tags) => !wanted?.length || wanted.some((t) => tags.includes(t));
const codesOk = (wanted, code) => !wanted?.length || wanted.includes(code);
const openingOk = (wanted, leaf) => !wanted?.length || wanted.includes(leaf.opening) || (leaf.tilt && wanted.some((o) => o.startsWith("tilt") && leaf.opening.endsWith(o.replace("tilt-", ""))));

/**
 * Everything the fabrication needs for one chassis of a CAD model:
 *   pieces (with their machining), leaves (sizes, weight, rules that
 *   fit), panes, accessory lines (per chassis), checks.
 * Returns null for a model without a design.
 */
function analyze(model, series, vars, refs, ctx) {
  const gen = model._gen || generated(model, series, ctx);
  if (!gen) return null;
  const st = gen.structure;
  const lib = series ? ctx?.seriesProfiles?.get(String(series._id || series)) || new Map() : new Map();
  const propsOf = (code) => library.profileProps(lib.get(code));
  const layout = layoutOf(gen.regions, vars);
  const checks = [];

  // ---- pieces (lengths evaluated like the BOM does) ----
  const pieces = gen.components.filter((c) => c.kind === "profile" && st.pieces[c.role]).map((c) => {
    const meta = st.pieces[c.role];
    return {
      role: c.role, label: c.label, code: c.seriesCode, angle: c.angle,
      qty: ev(c.qty || "1", vars, 0), length: round(ev(c.length || "0", vars, 0), 1),
      tags: [...meta.tags, meta.group], group: meta.group, node: meta.node, leaf: meta.leaf || null, region: meta.region || null,
      product: lib.get(c.seriesCode) ? String(lib.get(c.seriesCode)._id) : null,
    };
  }).filter((p) => p.qty > 0);
  const joints = jointPositions(layout, pieces);

  // ---- glass thickness of the chosen composition (for the leaf weight) ----
  const gt = refs?.vitrage ? ctx?.glassTypes?.get(String(refs.vitrage)) : null;
  const glassMm = gt ? (gt.layers || []).reduce((s, l) => s + (Number(l.thickness) || 0) * Math.max(1, Number(l.count) || 1), 0) : 0;

  // ---- leaves ----
  const leaves = st.leaves.map((l) => {
    const lw = round(ev(l.lw, vars, 0), 1);
    const lh = round(ev(l.lh, vars, 0), 1);
    const gw = round(ev(l.gw, vars, 0), 1);
    const gh = round(ev(l.gh, vars, 0), 1);
    const S = propsOf(l.code);
    const bead = l.beadCode ? propsOf(l.beadCode) : null;
    const profileKg = (2 * (lw + lh) / 1000) * (S.kgm || 0) + (bead ? (2 * (gw + gh) / 1000) * (bead.kgm || 0) : 0);
    const glassKg = l.infill === "glass" ? (gw * gh / 1e6) * glassMm * GLASS_DENSITY : 0;
    return { ...l, lw, lh, gw, gh, poids: round(profileKg + glassKg, 1), profileKg: round(profileKg, 1), glassKg: round(glassKg, 1), fits: {} };
  });
  if (leaves.length && !glassMm && leaves.some((l) => l.infill === "glass")) checks.push({ level: "info", message: "Poids des vantaux sans le verre : choisissez une composition de vitrage (épaisseurs des verres)" });
  if (leaves.length && leaves.some((l) => !propsOf(l.code).kgm)) checks.push({ level: "info", message: "Poids des vantaux incomplet : renseignez le poids au mètre (kg/m) des profilés d'ouvrant" });

  // ---- panes ----
  const panes = st.panes.map((p) => {
    const gw = round(ev(p.w, vars, 0), 1);
    const gh = round(ev(p.h, vars, 0), 1);
    return { ...p, gw, gh };
  });

  // ---- machining ----
  const ops = {};
  // machining carried by the profile articles (LogiKal: usinages du profilé)
  const machiningRules = [...lib.entries()].flatMap(([code, prod]) => (prod.fabRules?.machining || []).map((m) => ({ ...m, codes: [code] })));
  for (const rule of machiningRules.filter((m) => m.isActive !== false)) {
    for (const piece of pieces) {
      if (!codesOk(rule.codes, piece.code) || !tagsOk(rule.tags, piece.tags)) continue;
      const leaf = piece.leaf ? leaves.find((l) => l.node === piece.leaf) : null;
      if (rule.openings?.length && !(leaf && openingOk(rule.openings, leaf))) continue;
      const scope = { ...vars, long: piece.length, nb: piece.qty, ...(leaf ? { lw: leaf.lw, lh: leaf.lh, gw: leaf.gw, gh: leaf.gh, poids: leaf.poids } : {}) };
      if (rule.condition && !ev(rule.condition, scope, 0)) continue;
      const positions = positionsFor(rule, piece, scope, joints);
      if (!positions.length) continue;
      (ops[piece.role] = ops[piece.role] || []).push({ label: rule.label, kind: rule.kind, face: rule.face || "", size: rule.size || "", tool: rule.tool || "", positions });
    }
  }
  for (const p of pieces) p.ops = ops[p.role] || [];

  // ---- accessory rules ----
  const items = []; // { rule, count, scope, element }
  // accessory rules carried by the profile articles (scoped to their code)
  // and by the nodes the design uses (scoped to their combination)
  const codeOf = new Map([...lib.entries()].map(([code, prod]) => [String(prod._id), code]));
  const usedNodes = new Set(st.nodes || []);
  const nodeRules = ((series && ctx?.nodes?.get(String(series._id || series))) || []).filter((n) => usedNodes.has(String(n._id))).flatMap((n) => {
    const main = codeOf.get(String(n.main)) || "";
    const second = n.second ? codeOf.get(String(n.second)) || "" : "";
    const scope = {
      frame: { codes: [main] }, frameSash: { codes: [second] }, sashGlazing: { codes: [main], where: "sash" },
      fixedGlazing: { codes: [], where: "fixed" }, mullion: { codes: [main] }, meeting: { codes: [main], twoLeaves: true },
    }[n.type] || {};
    return (n.rules || []).map((r) => ({ ...r, codes: scope.codes.filter(Boolean), where: scope.where || r.where, twoLeaves: scope.twoLeaves, fromNode: String(n._id) }));
  });
  const rules = [
    ...[...lib.entries()].flatMap(([code, prod]) => (prod.fabRules?.accessories || []).map((r) => ({ ...r, codes: [code], fromProfile: code }))),
    ...nodeRules,
  ].filter((r) => r.isActive !== false && r.product);
  const usedCodes = new Set(pieces.map((p) => p.code));
  const groupsOf = (trigger) => [...new Set(rules.filter((r) => r.trigger === trigger && r.group).map((r) => r.group))];
  const baseScope = { ...vars, perim: 2 * ((Number(vars.L) || 0) + (Number(vars.H) || 0)) };
  for (const r of rules) {
    if (r.trigger === "chassis") {
      if (r.codes?.length && !r.codes.some((c) => usedCodes.has(c))) continue;
      if (sizeOk(r, vars.L, vars.H) && (!r.condition || ev(r.condition, baseScope, 0))) items.push({ rule: r, count: 1, scope: baseScope, where: "châssis" });
    } else if (r.trigger === "piece") {
      for (const p of pieces) {
        if (!codesOk(r.codes, p.code) || !tagsOk(r.tags, p.tags) || !sizeOk(r, p.length, 0)) continue;
        const scope = { ...vars, long: p.length, nb: p.qty, perim: 2 * p.length };
        if (r.condition && !ev(r.condition, scope, 0)) continue;
        items.push({ rule: r, count: p.qty, scope, where: p.label });
      }
    } else if (r.trigger === "corner") {
      for (const c of st.corners) {
        if (!codesOk(r.codes, c.code) || !tagsOk(r.tags, [c.group]) || (r.condition && !ev(r.condition, baseScope, 0))) continue;
        items.push({ rule: r, count: c.count, scope: baseScope, where: `angles ${c.group === "frame" ? "dormant" : "ouvrant"} ${c.code}` });
      }
    } else if (r.trigger === "joint") {
      for (const j of st.joints) {
        if (!codesOk(r.codes, j.code) || !tagsOk(r.tags, [j.dir === "v" ? "mullion" : "transom"]) || (r.condition && !ev(r.condition, baseScope, 0))) continue;
        items.push({ rule: r, count: j.count, scope: baseScope, where: `assemblages en T ${j.code}` });
      }
    } else if (r.trigger === "leaf") {
      for (const l of leaves) {
        if (!codesOk(r.codes, l.code) || !openingOk(r.openings, l) || !sizeOk(r, l.lw, l.lh)) continue;
        if (r.twoLeaves && l.leaves !== 2) continue;
        if (r.leafRole === "active" && !l.active) continue;
        if (r.leafRole === "passive" && l.active) continue;
        if (r.maxKg !== null && r.maxKg !== undefined && l.poids > r.maxKg + 1e-9) continue;
        const scope = { ...vars, lw: l.lw, lh: l.lh, gw: l.gw, gh: l.gh, poids: l.poids, perim: 2 * (l.lw + l.lh) };
        if (r.condition && !ev(r.condition, scope, 0)) continue;
        items.push({ rule: r, count: 1, scope, where: `vantail case ${l.no}${l.leaves === 2 ? `.${l.index + 1}` : ""}` });
        if (r.group) l.fits[r.group] = [...(l.fits[r.group] || []), r.label || ""];
      }
    } else if (r.trigger === "pane") {
      for (const p of panes) {
        if (r.infill !== "any" && r.infill && r.infill !== p.type) continue;
        if (!codesOk(r.codes, p.code)) continue;
        if (r.where === "sash" && !p.inSash) continue;
        if (r.where === "fixed" && p.inSash) continue;
        if (!sizeOk(r, p.gw, p.gh)) continue;
        const scope = { ...vars, gw: p.gw, gh: p.gh, perim: 2 * (p.gw + p.gh) };
        if (r.condition && !ev(r.condition, scope, 0)) continue;
        items.push({ rule: r, count: p.qty, scope, where: `${p.type === "glass" ? "vitrage" : "panneau"} case ${p.no}` });
      }
    }
  }
  // A group of alternatives that fits no leaf: say it (LogiKal "contrôle de faisabilité")
  for (const g of groupsOf("leaf")) {
    const groupRules = rules.filter((r) => r.trigger === "leaf" && r.group === g);
    for (const l of leaves) {
      // only for the leaves the group is meant for (its profile codes and openings)
      if (!groupRules.some((r) => codesOk(r.codes, l.code) && openingOk(r.openings, l))) continue;
      if (!l.fits[g]) checks.push({ level: "warning", message: `Vantail case ${l.no}${l.leaves === 2 ? `.${l.index + 1}` : ""} (${round(l.lw, 0)} × ${round(l.lh, 0)} mm, ${l.poids} kg) : aucune « ${g} » de la série ne convient (dimensions, poids ou ouverture hors limites)` });
    }
  }

  const accessories = [];
  for (const it of items) {
    const r = it.rule;
    const q = ev(r.qty || "1", it.scope, 0) * it.count;
    if (!(q > 0)) continue;
    const length = r.measure === "length" ? round(ev(r.length || (it.scope.long !== undefined ? "long" : "perim"), it.scope, 0), 1) : null;
    if (r.measure === "length" && !(length > 0)) continue;
    accessories.push({ rule: r, pieces: q, length, where: it.where });
  }
  return { pieces, joints, leaves, panes, accessories, checks, layout };
}

/**
 * Lines for chassisBom.expandItem: the accessories of the rules (× the
 * chassis quantity) and the machining of each generated profile piece.
 */
function applyToItem(model, series, vars, refs, ctx, { qty, label, itemRef, itemKey, finish, workshop }) {
  const a = analyze(model, series, vars, refs, ctx);
  if (!a) return null;
  const lines = a.accessories.map((x, i) => {
    const r = x.rule;
    const productId = String(r.product?._id || r.product);
    const name = r.label || ctx?.products?.get(productId)?.name || "Accessoire";
    const line = {
      role: `regle_${i + 1}`, label: name, kind: r.kind || "accessory", measure: r.measure === "length" ? "length" : "count", product: productId,
      finishMode: r.finish || "none", finish: r.finish === "project" ? finish : null,
      workshop: (r.workshop || workshop || "ALU").toUpperCase(), pieces: Math.round(x.pieces * qty * 10000) / 10000, angle: "", waste: 0,
      path: label, itemRef, itemKey, modelName: model.name, rule: r.label || "", ruleWhere: x.where, fromRule: true,
    };
    if (line.measure === "length") line.length = x.length;
    return line;
  });
  const opsByRole = Object.fromEntries(a.pieces.filter((p) => p.ops.length).map((p) => [p.role, p.ops]));
  const warnings = a.checks.filter((c) => c.level === "warning").map((c) => ({ where: label, message: c.message }));
  return { lines, opsByRole, warnings, analysis: a };
}


module.exports = {
  TRIGGERS, TAGS, OPENINGS, KINDS, MACHINING_KINDS, PLACES, FACES, LOCAL_VARS,
  knownNames, cleanAccessoryRules, cleanMachiningRules, analyze, applyToItem, jointPositions, positionsFor,
};
