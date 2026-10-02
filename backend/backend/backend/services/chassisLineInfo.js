const ChassisModel = require("../models/ChassisModel");
const ProfileSeries = require("../models/ProfileSeries");
const Finish = require("../models/Finish");
const Product = require("../models/Product");
const GlassType = require("../models/GlassType");
const { describeChassisParts, paramValue, idOf } = require("./chassisBom");

/**
 * ============================================================
 * CHASSIS LINES OF A DEVIS / FACTURE — display details
 * ============================================================
 * For each sales line that carries a chassis ({ model, ref, L, H,
 * finish, params }), returns what a screen or a PDF needs to lay it
 * out readably instead of one long "—"-joined sentence:
 *   { ref, name, series, size, finish, finishColor, options[],
 *     drawing, L, H, params, image, autoDescription }
 * (null for ordinary lines). `autoDescription` is the designation the
 * platform would generate — when the line's text differs, the user
 * wrote their own and it is shown as a note.
 * ============================================================
 */
async function chassisLinesInfo(companyId, lines = []) {
  const chassisLines = (lines || []).filter((l) => l?.chassis?.model);
  if (!chassisLines.length) return (lines || []).map(() => null);
  const modelIds = [...new Set(chassisLines.map((l) => String(idOf(l.chassis.model))))];
  const models = await ChassisModel.find({ _id: { $in: modelIds }, company: companyId }).lean();
  // Sub-models chosen through "model" parameters (glass unit, panel…) are named too.
  const subIds = new Set();
  const productIds = new Set();
  for (const l of chassisLines) {
    const m = models.find((x) => String(x._id) === String(idOf(l.chassis.model)));
    for (const p of m?.parameters || []) {
      const v = paramValue(p, l.chassis.params?.[p.key]);
      if (p.type === "model" && v) subIds.add(v);
      if (p.type === "product" && v) productIds.add(v);
    }
  }
  const [subModels, glassTypes, series, finishes, products] = await Promise.all([
    subIds.size ? ChassisModel.find({ _id: { $in: [...subIds] }, company: companyId }).select("name").lean() : [],
    subIds.size ? GlassType.find({ _id: { $in: [...subIds] }, company: companyId }).select("name").lean() : [],
    ProfileSeries.find({ company: companyId }).select("name").lean(),
    Finish.find({ company: companyId }).select("code name color").lean(),
    productIds.size ? Product.find({ _id: { $in: [...productIds] }, company: companyId }).select("name").lean() : [],
  ]);
  const ctx = {
    models: new Map([...models, ...subModels].map((m) => [String(m._id), m])),
    glassTypes: new Map(glassTypes.map((g) => [String(g._id), g])),
    series: new Map(series.map((s) => [String(s._id), s])),
    finishes: new Map(finishes.map((f) => [String(f._id), f])),
    products: new Map(products.map((p) => [String(p._id), p])),
  };
  return lines.map((l) => {
    if (!l?.chassis?.model) return null;
    const c = l.chassis;
    const model = ctx.models.get(String(idOf(c.model)));
    const parts = describeChassisParts(c, ctx);
    if (!model || !parts) return null;
    const params = {};
    for (const p of model.parameters || []) params[p.key] = paramValue(p, c.params?.[p.key]);
    return {
      ref: c.ref || "",
      ...parts,
      drawing: model.drawing || {},
      L: c.L,
      H: c.H,
      params,
      image: model.image?.url || null,
      autoDescription: [parts.name, parts.series, parts.size, parts.finish, ...parts.options].filter(Boolean).join(" — "),
    };
  });
}

/** Downloads the models' pictures once (PNG, via Cloudinary's f_png) for a PDF. */
async function fetchChassisImages(infos) {
  const urls = [...new Set((infos || []).filter((i) => i?.image).map((i) => i.image))];
  const out = new Map();
  await Promise.all(urls.map(async (url) => {
    try {
      const pngUrl = url.includes("/upload/") ? url.replace("/upload/", "/upload/f_png,w_300/") : url;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(pngUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) out.set(url, Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.warn("[chassisLineInfo] image not fetched, the schematic is drawn instead:", error.message);
    }
  }));
  return out;
}

module.exports = { chassisLinesInfo, fetchChassisImages };
