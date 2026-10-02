/**
 * Turning a catalogue TEMPLATE (config/chassisCatalog.js) into a
 * company's ChassisModel — shared by the import route and the seed.
 */
const { DEFAULT_MEASURE } = require("../config/chassisCatalog");

/** Adds the template's variables missing from the series (keeps existing values). */
function mergeTemplateVariables(series, template) {
  for (const v of template.variables) {
    if (!series.variables.some((x) => x.key === v.key)) series.variables.push({ key: v.key, label: v.label, value: v.value });
  }
  if (!series.families.includes(template.family)) series.families.push(template.family);
}

/**
 * Plain object ready for ChassisModel.create(). `articles` optionally
 * maps a component role → product id (e.g. from the seed).
 */
function modelFromTemplate(template, { company, series = null, name, code = "", articles = {}, actorId = null } = {}) {
  return {
    company,
    series: series?._id || null,
    name: String(name || (series ? `${template.name} — ${series.name}` : template.name)).slice(0, 150),
    code: String(code || "").toUpperCase(),
    family: template.family,
    templateKey: template.key,
    description: template.description,
    drawing: template.drawing,
    defaultWorkshop: template.defaultWorkshop,
    limits: template.limits,
    variables: series ? [] : template.variables.map((v) => ({ key: v.key, label: v.label, value: v.value })),
    parameters: template.parameters.map((p) => ({ ...p, default: p.default ?? (p.type === "product" || p.type === "model" ? null : 0), options: p.options || [] })),
    derived: template.derived.map((d) => ({ key: d.key, label: d.label || d.key, formula: d.formula })),
    components: template.components.map((c) => ({
      role: c.role, label: c.label, kind: c.kind, measure: c.kind === "model" ? "count" : c.measure || DEFAULT_MEASURE[c.kind],
      product: c.kind === "model" || c.productParam ? null : articles[c.role] || null, subModel: null,
      productParam: c.productParam || "", modelParam: c.modelParam || "",
      qty: c.qty || "1", length: c.length || "", width: c.width || "", height: c.height || "", angle: c.angle || "",
      finish: c.finish || "none", workshop: c.workshop || "", condition: c.condition || "", waste: c.waste || 0,
    })),
    deliveryParts: (template.deliveryParts || []).map((d) => ({ ...d })),
    labour: template.labour,
    pricing: template.pricing,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

module.exports = { mergeTemplateVariables, modelFromTemplate };
