/**
 * ============================================================
 * NODES (nœuds entre profilés) — see models/ProfileNode.js
 * ============================================================
 * A node says how two profiles of a series meet, measured once in the
 * section editor on their real DXF. Its values are the deductions the
 * CAD uses for every chassis built with that combination:
 *
 *   frame         cover  (dormant au-delà de la cote, par côté)
 *                 clear  (de la cote au jour du dormant)
 *   frameSash     overlap   (recouvrement de l'ouvrant sur le jour)
 *   sashGlazing   glassEdge (du bord de l'ouvrant au bord du verre)
 *                 beadStart (du bord de l'ouvrant à la parclose)
 *   fixedGlazing  bite      (prise du verre sous le jour)
 *                 beadExtra (parclose au-delà du jour)
 *   mullion       half (de l'axe au jour)   end (allongement à chaque bout)
 *   meeting       meeting  (recouvrement entre les deux vantaux)
 *
 * lookupFor(series, ctx) gives chassisDesign.generate() the values of
 * the series' nodes by profile codes; without a node the CAD falls back
 * on an estimate from the profile geometry and says so.
 * ============================================================
 */
const TYPES = {
  frame: { label: "Dormant — cote et jour", main: ["frame"], values: ["cover", "clear"] },
  frameSash: { label: "Dormant / meneau ↔ ouvrant", main: ["frame", "mullion"], second: ["sash"], values: ["overlap"] },
  sashGlazing: { label: "Ouvrant ↔ vitrage et parclose", main: ["sash"], bead: true, glass: true, values: ["glassEdge", "beadStart"] },
  fixedGlazing: { label: "Dormant / meneau ↔ vitrage fixe", main: ["frame", "mullion"], bead: true, glass: true, values: ["bite", "beadExtra"] },
  mullion: { label: "Meneau / traverse", main: ["mullion"], values: ["half", "end"] },
  meeting: { label: "Ouvrant ↔ ouvrant (2 vantaux)", main: ["sash"], second: ["meeting"], optionalSecond: true, values: ["meeting"] },
};
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v || ""));
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const idOf = (v) => (v && typeof v === "object" && v._id ? String(v._id) : v ? String(v) : null);

function cleanPlacements(input) {
  const out = {};
  const p = input && typeof input === "object" ? input : {};
  for (const [k, v] of Object.entries(p).slice(0, 20)) {
    if (!/^[a-zA-Z]{1,20}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (v && typeof v === "object") {
      const o = {};
      for (const f of ["x", "y", "rot"]) if (Number.isFinite(Number(v[f]))) o[f] = Math.round(Number(v[f]) * 100) / 100;
      for (const f of ["flipX", "flipY"]) if (v[f] !== undefined) o[f] = !!v[f];
      out[k] = o;
    }
  }
  return out;
}

/** Validates a node sent by the editor (throws 400). */
async function cleanNode(body, series, { Product, fabrication, known, partial = false, existing = null }) {
  const type = body.type;
  const def = TYPES[type];
  if (!def) fail("Type de nœud inconnu");
  const pick = (k) => (body[k] !== undefined ? body[k] : existing?.[k]);
  const ids = { main: idOf(pick("main")), second: idOf(pick("second")), bead: idOf(pick("bead")) };
  if (!isId(ids.main)) fail("Choisissez le profilé principal du nœud");
  if (def.second && !def.optionalSecond && !isId(ids.second)) fail("Choisissez le second profilé du nœud");
  if (!def.second) ids.second = null;
  if (!def.bead) ids.bead = null;
  const wanted = Object.values(ids).filter(isId);
  const found = await Product.find({ _id: { $in: wanted }, profileSeries: series._id, baseProduct: null }).select("_id").lean();
  if (found.length !== new Set(wanted).size) fail("Les profilés du nœud doivent appartenir à la série");
  const values = {};
  const rawValues = pick("values") || {};
  for (const k of def.values) {
    const v = Number(rawValues[k]);
    if (!Number.isFinite(v) || Math.abs(v) > 1000) fail(`Valeur « ${k} » invalide : placez les profilés dans l'éditeur`);
    values[k] = Math.round(v * 100) / 100;
  }
  const out = {
    type,
    name: String(pick("name") || "").trim().slice(0, 120),
    main: ids.main, second: isId(ids.second) ? ids.second : null, bead: isId(ids.bead) ? ids.bead : null,
    glassThickness: def.glass && Number(pick("glassThickness")) > 0 ? Math.min(200, Number(pick("glassThickness"))) : null,
    placements: cleanPlacements(pick("placements")),
    values,
    notes: String(pick("notes") || "").slice(0, 500),
  };
  if (JSON.stringify(out.placements).length > 5000) fail("Placements trop volumineux");
  if (body.rules !== undefined || !partial) {
    const { rules, productIds } = fabrication.cleanAccessoryRules(body.rules || existing?.rules || [], known);
    const uniq = [...new Set(productIds)];
    if (uniq.length && (await Product.countDocuments({ _id: { $in: uniq }, company: series.company })) !== uniq.length) fail("Un article des règles n'appartient pas à cette société");
    out.rules = rules.map((r) => ({ ...r, codes: [] }));
  }
  return out;
}

/**
 * Node values by profile codes for one series:
 *   lookup(type, mainCode, secondCode?) → { values, node } | null
 * ctx.nodes: Map seriesId → nodes ; ctx.seriesProfiles: Map seriesId → Map code → article.
 */
function lookupFor(series, ctx) {
  const sid = series ? String(series._id || series) : null;
  const list = (sid && ctx?.nodes?.get(sid)) || [];
  if (!list.length) return () => null;
  const lib = ctx?.seriesProfiles?.get(sid) || new Map();
  const codeOf = new Map([...lib.entries()].map(([code, p]) => [String(p._id), code]));
  const index = new Map();
  for (const n of list) {
    const k = `${n.type}|${codeOf.get(idOf(n.main)) || "?"}|${n.second ? codeOf.get(idOf(n.second)) || "?" : ""}`;
    if (!index.has(k)) index.set(k, n);
  }
  return (type, mainCode, secondCode = "") => {
    let n = index.get(`${type}|${mainCode}|${secondCode || ""}`);
    // nodes without a second profile (or an optional one) match on the main profile alone
    if (!n && (!TYPES[type]?.second || TYPES[type]?.optionalSecond)) n = [...index.entries()].find(([k]) => k.startsWith(`${type}|${mainCode}|`))?.[1];
    return n ? { values: n.values || {}, node: String(n._id), stale: !!n.stale } : null;
  };
}

/** Accessory rules of the nodes used by a design (for chassisFabrication). */
function nodesById(series, ctx) {
  const sid = series ? String(series._id || series) : null;
  return new Map(((sid && ctx?.nodes?.get(sid)) || []).map((n) => [String(n._id), n]));
}

module.exports = { TYPES, cleanNode, lookupFor, nodesById };
