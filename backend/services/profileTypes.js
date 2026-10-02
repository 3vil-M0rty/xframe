/**
 * ============================================================
 * PROFILE TYPES — geometry shared by the profiles of a series
 * ============================================================
 * A series (AWS 60, Coulissant 67…) declares its profile types —
 * "Ouvrant": chambre 26, ailette ext. 8, ailette int. 6, largeur 60… —
 * and every article attached to that type gets those values. One number
 * typed once instead of once per ouvrant.
 *
 * The values are COPIED onto the articles (and their colour variants):
 * the BOM (ae, ch, ai, hp, lp in the formulas), the débit, the planning
 * and the printouts keep reading the article exactly as before. A field
 * the user sets on one article (Product.geometryOwn) is never
 * overwritten: that article is the exception, the type stays the rule.
 * ============================================================
 */
const Product = require("../models/Product");
const ProfileSeries = require("../models/ProfileSeries");
const InventoryCategory = require("../models/InventoryCategory");

// type field → article field
const FIELD_MAP = {
  ch: "profileChamber",
  ae: "profileOuterFin",
  ai: "profileInnerFin",
  lp: "profileWidth",
  barLength: "barLength",
  weightPerMeter: "weightPerMeter",
  perimeter: "perimeter",
};
const TYPE_FIELDS = Object.keys(FIELD_MAP);
const PRODUCT_FIELDS = Object.values(FIELD_MAP);
const HEIGHT_PARTS = ["profileChamber", "profileOuterFin", "profileInnerFin"];

/** "Ouvrant porte" → "ouvrant_porte" (stable key, usable in messages and URLs). */
function slug(text) {
  return String(text || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Accent-free, lower-case words — for matching names. */
function words(text) {
  return String(text || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
const compact = (text) => words(text).join("");

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error("Profile type: enter positive numbers"), { status: 400 });
  return n;
}

/** Validates the profile types sent by the series form. Keeps existing keys. */
function cleanTypes(list) {
  const out = [];
  const seen = new Set();
  for (const t of Array.isArray(list) ? list : []) {
    const label = String(t?.label || "").trim().slice(0, 80);
    if (!label) continue;
    let key = slug(t.key || label) || slug(label);
    if (!key) continue;
    if (seen.has(key)) throw Object.assign(new Error(`Profile type « ${label} » is listed twice`), { status: 400 });
    seen.add(key);
    const row = { key, label, keywords: (Array.isArray(t.keywords) ? t.keywords : String(t.keywords || "").split(","))
      .map((k) => String(k).trim()).filter(Boolean).slice(0, 10) };
    for (const f of TYPE_FIELDS) row[f] = numOrNull(t[f]);
    out.push(row);
  }
  return out;
}

/** The values a type gives, as article fields ({ profileChamber: 26, … }) — only the ones it sets. */
function typeValues(type) {
  const out = {};
  if (!type) return out;
  for (const [tf, pf] of Object.entries(FIELD_MAP)) if (type[tf] !== null && type[tf] !== undefined) out[pf] = Number(type[tf]);
  return out;
}

function withHeight(values, product) {
  const merged = { ...product, ...values };
  if (HEIGHT_PARTS.some((k) => merged[k] !== null && merged[k] !== undefined)) {
    values.profileHeight = HEIGHT_PARTS.reduce((s, k) => s + (Number(merged[k]) || 0), 0);
  }
  return values;
}

/** Writes a type's values onto one article (except its own fields) and onto its colour variants. */
async function applyToProduct(product, type) {
  const own = new Set(product.geometryOwn || []);
  const values = {};
  for (const [field, v] of Object.entries(typeValues(type))) if (!own.has(field)) values[field] = v;
  if (!Object.keys(values).length) return 0;
  withHeight(values, product);
  await Product.updateOne({ _id: product._id }, { $set: values });
  // colour variants carry the same geometry as their raw article
  const full = { ...product, ...values };
  const variantValues = {};
  for (const f of [...PRODUCT_FIELDS, "profileHeight"]) if (full[f] !== undefined) variantValues[f] = full[f];
  await Product.updateMany({ baseProduct: product._id }, { $set: variantValues });
  return 1;
}

/**
 * After a series is saved: every article of each type gets the new values;
 * articles of a type that no longer exists are detached (values kept).
 */
async function propagateSeries(series) {
  const types = new Map((series.profileTypes || []).map((t) => [t.key, t]));
  const attached = await Product.find({ profileSeries: series._id, baseProduct: null }).lean();
  let updated = 0;
  for (const p of attached) {
    const type = types.get(p.profileType);
    if (!type) {
      await Product.updateOne({ _id: p._id }, { $set: { profileSeries: null, profileType: null, geometryOwn: [] } });
      continue;
    }
    updated += await applyToProduct(p, type);
  }
  return updated;
}

/** Detaches every article of a series that is being deleted (their values stay). */
async function detachSeries(seriesId) {
  await Product.updateMany({ profileSeries: seriesId }, { $set: { profileSeries: null, profileType: null, geometryOwn: [] } });
}

/**
 * Attaches articles to "series › type". keepOwn: the values already typed
 * on an article that differ from the type stay as its own; otherwise the
 * type's values replace them.
 */
async function attach(company, productIds, seriesId, typeKey, { keepOwn = false } = {}) {
  const series = await ProfileSeries.findOne({ _id: seriesId, company });
  if (!series) throw Object.assign(new Error("Series not found"), { status: 404 });
  const type = (series.profileTypes || []).find((t) => t.key === typeKey);
  if (!type) throw Object.assign(new Error("This profile type does not exist in the series"), { status: 400 });
  const products = await Product.find({ _id: { $in: productIds }, company, baseProduct: null }).lean();
  const tv = typeValues(type);
  for (const p of products) {
    const own = keepOwn
      ? Object.keys(tv).filter((f) => p[f] !== null && p[f] !== undefined && Number(p[f]) !== tv[f])
      : [];
    await Product.updateOne({ _id: p._id }, { $set: { profileSeries: series._id, profileType: type.key, geometryOwn: own } });
    await applyToProduct({ ...p, geometryOwn: own }, type);
  }
  return products.length;
}

async function detach(company, productIds) {
  const r = await Product.updateMany({ _id: { $in: productIds }, company }, { $set: { profileSeries: null, profileType: null, geometryOwn: [] } });
  return r.modifiedCount ?? r.nModified ?? 0;
}

/**
 * An attached article is edited (Technique › Données techniques): a field
 * set to something other than the type's value becomes its own; set back
 * to the type's value (or emptied) it follows the type again.
 * Returns the fields to $set on the article.
 */
async function reconcileEdit(product, body) {
  if (!product.profileSeries || !product.profileType) return {};
  const series = await ProfileSeries.findById(product.profileSeries).lean();
  const type = (series?.profileTypes || []).find((t) => t.key === product.profileType);
  if (!type) return {};
  const tv = typeValues(type);
  if (body.resetToType) {
    return withHeight({ ...tv, geometryOwn: [] }, product);
  }
  const own = new Set(product.geometryOwn || []);
  const set = {};
  for (const f of Object.keys(tv)) {
    if (body[f] === undefined) continue;
    const v = body[f] === "" || body[f] === null ? null : Number(body[f]);
    if (v === null || v === tv[f]) { own.delete(f); set[f] = tv[f]; } else own.add(f);
  }
  set.geometryOwn = [...own];
  return withHeight(set, { ...product, ...set });
}

async function categoryPaths(company) {
  const cats = await InventoryCategory.find({ company }).select("name parent").lean();
  const byId = new Map(cats.map((c) => [String(c._id), c]));
  const path = (id, depth = 0) => {
    const c = byId.get(String(id));
    if (!c || depth > 8) return "";
    return `${c.parent ? `${path(c.parent, depth + 1)} ` : ""}${c.name}`;
  };
  return (id) => (id ? path(id) : "");
}

/**
 * Suggests "series › type" for the profiles of the company from their
 * name, reference and category: "Ouvrant AWS 60 renforcé" in
 * "Profilés › AWS 60" → AWS 60 › Ouvrant. The longest matching series
 * name and type word win ("Ouvrant porte" before "Ouvrant").
 */
async function suggest(company) {
  const seriesList = await ProfileSeries.find({ company, isActive: { $ne: false } }).lean();
  const usable = seriesList.filter((s) => (s.profileTypes || []).length);
  if (!usable.length) return { suggestions: [], seriesWithoutTypes: seriesList.map((s) => s.name) };
  const pathOf = await categoryPaths(company);
  const products = await Product.find({ company, materialType: "profile", baseProduct: null, isActive: { $ne: false } })
    .select(`name internalReference category profileSeries profileType ${PRODUCT_FIELDS.join(" ")}`).lean();

  // A series matches an article when every NUMBER of its name ("60" of
  // "AWS 60") is in the article's name / reference / category, scored by
  // how many of its words are there (a full "aws60" earns a bonus). A
  // series name without numbers must appear entirely. Two series with the
  // same best score = ambiguous → no suggestion.
  const seriesTokens = usable.map((s) => ({ s, tokens: words(s.name), key: compact(s.name) }));
  const scoreSeries = (wordSet, flat, entry) => {
    const digits = entry.tokens.filter((w) => /\d/.test(w));
    if (digits.length) {
      if (!digits.every((d) => wordSet.has(d) || flat.includes(d))) return 0;
    } else if (!entry.tokens.every((w) => wordSet.has(w))) return 0;
    return entry.tokens.filter((w) => wordSet.has(w)).length + (entry.key && flat.includes(entry.key) ? 2 : 0) + digits.length;
  };

  const suggestions = [];
  for (const p of products) {
    const text = `${p.name} ${p.internalReference || ""} ${pathOf(p.category)}`;
    const flat = compact(text);
    const wordSet = new Set(words(text));
    const nameWords = words(p.name);
    let series = null;
    let bestScore = 0;
    let tie = false;
    for (const entry of seriesTokens) {
      const sc = scoreSeries(wordSet, flat, entry);
      if (sc > bestScore) { series = entry.s; bestScore = sc; tie = false; } else if (sc && sc === bestScore) tie = true;
    }
    if (tie) series = null;
    if (!series && p.profileSeries) series = usable.find((s) => String(s._id) === String(p.profileSeries)) || null;
    if (!series) continue;

    // The type word that comes FIRST in the article's name wins ("Montant
    // dormant coulissant" is a montant); at the same place, the longest
    // ("Ouvrant porte" before "Ouvrant").
    let best = null;
    let bestPos = Infinity;
    let bestLen = 0;
    for (const t of series.profileTypes) {
      for (const kw of [t.label, ...(t.keywords || [])]) {
        const kwWords = words(kw);
        if (!kwWords.length) continue;
        const pos = nameWords.findIndex((_, i) => kwWords.every((w, j) => nameWords[i + j] === w || (j === kwWords.length - 1 && nameWords[i + j]?.startsWith(w))));
        if (pos < 0) continue;
        const len = kwWords.join(" ").length;
        if (pos < bestPos || (pos === bestPos && len > bestLen)) { best = t; bestPos = pos; bestLen = len; }
      }
    }
    if (!best) continue;
    if (String(p.profileSeries) === String(series._id) && p.profileType === best.key) continue;

    const tv = typeValues(best);
    const changes = {};
    for (const [f, v] of Object.entries(tv)) if ((p[f] ?? null) !== v) changes[f] = [p[f] ?? null, v];
    suggestions.push({
      product: { _id: p._id, name: p.name, internalReference: p.internalReference || "" },
      series: { _id: series._id, name: series.name },
      type: { key: best.key, label: best.label },
      current: p.profileSeries ? { series: String(p.profileSeries), type: p.profileType } : null,
      changes,
    });
  }
  suggestions.sort((a, b) => a.series.name.localeCompare(b.series.name) || a.type.label.localeCompare(b.type.label) || a.product.name.localeCompare(b.product.name));
  return { suggestions, seriesWithoutTypes: seriesList.filter((s) => !(s.profileTypes || []).length).map((s) => s.name) };
}

/** Number of attached articles per series and type: { seriesId: { typeKey: n } }. */
async function typeCounts(company, seriesIds) {
  const rows = await Product.find({ company, profileSeries: { $in: seriesIds }, baseProduct: null }).select("profileSeries profileType").lean();
  const out = {};
  for (const r of rows) {
    const s = String(r.profileSeries);
    out[s] = out[s] || {};
    out[s][r.profileType] = (out[s][r.profileType] || 0) + 1;
  }
  return out;
}

module.exports = {
  FIELD_MAP, TYPE_FIELDS, PRODUCT_FIELDS,
  slug, cleanTypes, typeValues, propagateSeries, detachSeries, attach, detach, reconcileEdit, suggest, typeCounts,
};
