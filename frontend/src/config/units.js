// ======================================================
// PRODUCT UNIT CODES
// ======================================================
// A comprehensive, fixed list of measurement/packaging units for
// the Product.unit field. Unlike product names/descriptions (which
// go through the UGC translation system — see contentLanguages.js),
// this is a small, enumerable set of STATIC choices, so it's
// translated the normal way: each code below has a label in every
// language in src/config/i18n.config.js under the `units` namespace
// (e.g. t("units.kg")).
//
// The stored value in the database is always the short code (e.g.
// "kg", "m2", "unit") — never the translated label — so switching
// the UI language never changes what's saved, and a product created
// while browsing in Arabic displays correctly in French too.
// ======================================================

export const UNIT_CODES = [
  "unit", "piece", "pair", "dozen", "set",
  "kg", "g", "t", "lb", "oz", "quintal",
  "l", "ml", "m3", "gal",
  "m", "cm", "mm", "km", "ft", "in", "yd",
  "m2", "ft2", "ha",
  "box", "carton", "pallet", "bag", "sack", "bottle", "can",
  "roll", "sheet", "bundle", "case", "drum", "barrel", "container",
  "hour", "day", "month",
];

/**
 * Translated label for a stored unit code, for read-only display
 * (product cards, tables). Falls back to the raw code itself if it's
 * not one of the known units (legacy custom value) — never shows a
 * raw "units.xyz" dictionary key.
 */
export function getUnitLabel(t, code) {
  if (!code) return "";
  return t(`units.${code}`, code);
}

/**
 * Builds the { value, label } options CustomSelect expects, from the
 * current i18n `t` function. If `currentValue` is set and isn't one
 * of the known codes (legacy free-text data entered before this
 * dropdown existed, or anything not in the list above), it's
 * appended as its own option so the existing value keeps displaying
 * and isn't silently replaced with a blank placeholder — the select
 * still shows and preserves whatever was already saved.
 */
export function buildUnitOptions(t, currentValue) {
  const options = UNIT_CODES.map((code) => ({ value: code, label: t(`units.${code}`) }));
  if (currentValue && !UNIT_CODES.includes(currentValue)) {
    options.push({ value: currentValue, label: currentValue });
  }
  return options;
}
