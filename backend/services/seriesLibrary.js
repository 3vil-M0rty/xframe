/**
 * ============================================================
 * SERIES PROFILE LIBRARY (bibliothèque de profilés d'une série)
 * ============================================================
 * Like the profile library of a series in FPPRO / LogiKal:
 *
 *   series "AWS 60"
 *     ├─ profiles = inventory articles with Product.profileSeries = the
 *     │  series and a short CODE: DOR (dormant), OUV (ouvrant), PAR…
 *     │  Their geometry lives ON THE ARTICLE only (single source of truth).
 *     └─ variables = numbers or formulas over those profiles:
 *          rec = OUV.ae - 2        jd = DOR.ch + DOR.ai        jeu = 5
 *
 * In every formula of the series' models:  CODE.prop
 *   ch  épaisseur de chambre     ae  ailette externe     ai  ailette interne
 *   hp  hauteur totale (ch+ae+ai) lp  largeur            bar longueur de barre
 *   kgm poids au mètre           per périmètre laquable
 * and a model component can be "the profile OUV of the series" instead
 * of a fixed article. Everything is read at calculation time: change
 * the dormant article and every débit of the series follows.
 * ============================================================
 */
const Product = require("../models/Product");
const { evaluate, check } = require("./formulaEngine");

const PROFILE_PROPS = ["ch", "ae", "ai", "hp", "lp", "bar", "kgm", "per"];
const PROP_FIELDS = {
  ch: "profileChamber", ae: "profileOuterFin", ai: "profileInnerFin", lp: "profileWidth",
  bar: "barLength", kgm: "weightPerMeter", per: "perimeter",
};
const GEOMETRY_FIELDS = ["barLength", "profileChamber", "profileOuterFin", "profileInnerFin", "profileHeight", "profileWidth", "profileDepth", "weightPerMeter", "perimeter", "paintSurface", "powderPerUnit"];
const CODE_RX = /^[A-Z][A-Z0-9_]{0,11}$/;

/** "ouv 2" → "OUV2"; null when it can't be a code. */
function normalizeCode(code) {
  const c = String(code || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return CODE_RX.test(c) ? c : null;
}

/** Values of a profile article as CODE.prop sees them. */
function profileProps(p) {
  const v = (f) => Number(p?.[f]) || 0;
  const ch = v("profileChamber");
  const ae = v("profileOuterFin");
  const ai = v("profileInnerFin");
  return {
    ch, ae, ai,
    hp: v("profileHeight") || (ch + ae + ai) || v("profileDepth"),
    lp: v("profileWidth"), bar: v("barLength"), kgm: v("weightPerMeter"), per: v("perimeter"),
  };
}

/** "DOR.ae", "DOR.ch"… for the given codes (formula checker). */
const profileVarNames = (codes) => [...new Set(codes)].flatMap((c) => PROFILE_PROPS.map((p) => `${c}.${p}`));

/** { "DOR.ae": 25, … } from a Map code → article. */
function profileVars(profilesByCode) {
  const out = {};
  for (const [code, p] of profilesByCode || []) {
    const props = profileProps(p);
    for (const k of PROFILE_PROPS) out[`${code}.${k}`] = props[k];
  }
  return out;
}

/**
 * Series variables in order: a number, or a formula over the profiles
 * (CODE.prop) and the variables above it. Mutates and returns `vars`.
 */
function resolveSeriesVariables(series, vars, errors = []) {
  for (const v of series?.variables || []) {
    if (v.formula && String(v.formula).trim()) {
      try {
        vars[v.key] = evaluate(v.formula, vars);
      } catch (error) {
        vars[v.key] = 0;
        errors.push({ where: `${series.name} › ${v.label || v.key}`, field: "variable", message: error.message });
      }
    } else {
      vars[v.key] = Number(v.value) || 0;
    }
  }
  return vars;
}

/**
 * Cleans the variables sent by the series page. "5" → a number;
 * anything else is a formula checked against the series' profile codes
 * and the variables above it. Throws a 400 with a clear message.
 */
function cleanSeriesVariables(input, codes, isValidVariableName) {
  const out = [];
  const known = new Set(["cj", ...profileVarNames(codes)]);
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  for (const v of Array.isArray(input) ? input : []) {
    const key = String(v?.key || "").trim();
    if (!key) continue;
    if (!isValidVariableName(key)) fail(`Invalid variable name "${key}" (letters, digits, _ ; not L, H or a function name)`);
    if (out.some((x) => x.key === key)) fail(`Variable "${key}" is defined twice`);
    const raw = String(v.formula ?? v.value ?? "").trim().replace(",", ".");
    const label = String(v.label || "").slice(0, 150);
    if (raw === "" || Number.isFinite(Number(raw))) {
      out.push({ key, label, formula: "", value: Number(raw) || 0 });
    } else {
      const r = check(raw, [...known]);
      if (!r.ok) fail(`Variable "${key}": ${r.error}`);
      out.push({ key, label, formula: raw, value: 0 });
    }
    known.add(key);
  }
  return out;
}

/** Map seriesId → Map code → article (raw articles of every series of the company). */
async function loadSeriesProfiles(company, seriesIds = null) {
  const filter = { company, profileSeries: seriesIds ? { $in: seriesIds } : { $ne: null }, seriesCode: { $nin: [null, ""] }, baseProduct: null };
  const rows = await Product.find(filter).lean();
  const out = new Map();
  for (const p of rows) {
    const sid = String(p.profileSeries);
    if (!out.has(sid)) out.set(sid, new Map());
    out.get(sid).set(p.seriesCode, p);
  }
  return out;
}

// Usual profile names → codes (the user can change them).
const CODE_WORDS = [
  ["ouvrant porte", "OUVP"], ["dormant porte", "DORP"], ["parclose", "PAR"], ["battement", "BAT"], ["chicane", "CHI"],
  ["traverse", "TRA"], ["meneau", "MEN"], ["montant", "MON"], ["dormant", "DOR"], ["ouvrant", "OUV"], ["vantail", "OUV"],
  ["seuil", "SEU"], ["rail", "RAIL"], ["renfort", "REN"], ["couvre joint", "CJ"], ["elargisseur", "ELA"], ["adaptateur", "ADA"],
  ["jet d eau", "JET"], ["poteau", "POT"], ["angle", "ANG"], ["tapee", "TAP"], ["cadre", "CAD"], ["profil", "PRO"],
];
const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A free code for an article, from its name: "Ouvrant renforcé AWS 60" → OUV (or OUV2 if taken). */
function suggestCode(name, used = new Set()) {
  const text = ` ${plain(name)} `;
  let base = null;
  let at = Infinity;
  for (const [words, code] of CODE_WORDS) {
    const pos = text.indexOf(` ${words} `);
    if (pos >= 0 && pos < at) { base = code; at = pos; }
  }
  if (!base) base = normalizeCode(plain(name).split(" ")[0].slice(0, 3)) || "P";
  let code = base;
  for (let n = 2; used.has(code); n += 1) code = `${base}${n}`;
  return code;
}

// Role of a profile from its code / name (the user can change it).
const ROLE_WORDS = [
  [/^(DORP?|CAD|DOR\d*)/, "frame"], [/^(OUVP?|OUV\d*|VAN)/, "sash"], [/^(MEN|TRA|POT|MON)/, "mullion"],
  [/^PAR/, "bead"], [/^(BAT|CHI)/, "meeting"],
];
function suggestRole(code, name = "") {
  const c = String(code || "").toUpperCase();
  for (const [rx, role] of ROLE_WORDS) if (rx.test(c)) return role;
  const n = plain(name);
  if (/\bdormant\b|\bcadre\b/.test(n)) return "frame";
  if (/\bouvrant\b|\bvantail\b/.test(n)) return "sash";
  if (/\bmeneau\b|\btraverse\b|\bpoteau\b/.test(n)) return "mullion";
  if (/\bparclose\b/.test(n)) return "bead";
  if (/\bbattement\b|\bchicane\b/.test(n)) return "meeting";
  return "other";
}

/** Colour variants carry the geometry of their raw article. */
async function syncVariants(productId, source) {
  const set = {};
  for (const f of GEOMETRY_FIELDS) if (source[f] !== undefined) set[f] = source[f];
  if (Object.keys(set).length) await Product.updateMany({ baseProduct: productId }, { $set: set });
}

module.exports = {
  PROFILE_PROPS, PROP_FIELDS, GEOMETRY_FIELDS,
  normalizeCode, profileProps, profileVarNames, profileVars, resolveSeriesVariables, cleanSeriesVariables,
  loadSeriesProfiles, suggestCode, suggestRole, syncVariants,
};
