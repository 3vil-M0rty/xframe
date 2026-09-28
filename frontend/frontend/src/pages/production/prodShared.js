// Helpers shared by the aluminium production pages.
export { useCompanyPicker, formatMoney, formatDate, toInputDate } from "../purchasing/shared";

export const COMPONENT_KINDS = ["profile", "gasket", "glass", "panel", "accessory", "consumable", "model"];
export const MATERIAL_TYPES = ["profile", "powder", "glass", "accessory", "gasket", "panel", "consumable", "other"];
export const STOCK_MODES = ["unit", "bar", "meter", "m2", "sheet", "kg"];
export const FINISH_KINDS = ["raw", "lacquer", "anodized", "wood", "other"];
export const WORKSHOP_KINDS = ["laquage", "aluminium", "vitrage", "other"];
export const PARAM_TYPES = ["number", "boolean", "choice", "product", "model"];
export const FINISH_MODES = ["project", "raw", "none"];
export const ANGLES = ["", "90/90", "45/45", "45/90"];
export const PRICING_MODES = ["cost_plus", "per_m2", "per_ml", "per_unit"];

/** Which articles a component kind can use (materialType filter). */
export const KIND_MATERIALS = {
  profile: ["profile"],
  gasket: ["gasket", "consumable"],
  glass: ["glass"],
  panel: ["panel", "glass"],
  accessory: ["accessory", "consumable"],
  consumable: ["consumable", "accessory", "powder"],
};
export const DEFAULT_MEASURE = { profile: "length", gasket: "length", glass: "area", panel: "area", accessory: "count", consumable: "count", model: "count" };

/** Work-order status → StatusPill colour. */
export const ORDER_PILL = { draft: "neutral", planned: "neutral", in_progress: "manager_approved", done: "accepted", cancelled: "rejected" };

export const fmtQty = (n, d = 3) => {
  const v = Number(n) || 0;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: d });
};
export const fmtMm = (n) => (n === null || n === undefined || n === "" ? "—" : `${fmtQty(n, 1)}`);

/** Parameter values a model starts with (its defaults). */
export function defaultParams(model) {
  const out = {};
  for (const p of model?.parameters || []) out[p.key] = p.default ?? (p.type === "product" || p.type === "model" ? "" : 0);
  return out;
}

/** Label of a catalogue family (families come from GET /production/catalog). */
export const familyLabel = (families, key, language) => {
  const f = (families || []).find((x) => x.key === key);
  if (!f) return key;
  return language === "fr" || language === "ar" ? f.fr : f.en || f.fr;
};

export const articleLabel = (p) => (p ? `${p.name}${p.internalReference ? ` (${p.internalReference})` : ""}` : "");
