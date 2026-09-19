// ======================================================
// PRODUCT UNIT CODES
// ======================================================
// Comprehensive fixed list of measurement, production,
// packaging, logistics, and technical units.
//
// IMPORTANT:
// - Database stores ONLY the code.
// - Never store translated labels.
// - Labels are translated through the `units` i18n namespace.
// - This allows the same product to display correctly when
//   the application language changes.
//
// Example:
//   DB value: "kg"
//   English: "Kilogram (kg)"
//   French:  "Kilogramme (kg)"
//   Arabic:  "كيلوغرام (kg)"
// ======================================================

export const UNIT_CODES = [
  // ======================================================
  // COUNT / QUANTITY
  // ======================================================
  "unit",
  "piece",
  "item",
  "each",
  "pair",
  "triplet",
  "quadruplet",
  "dozen",
  "gross",
  "score",
  "set",
  "kit",
  "lot",
  "batch",

  // ======================================================
  // MASS / WEIGHT
  // ======================================================
  "mcg",
  "mg",
  "g",
  "dag",
  "hg",
  "kg",
  "t",
  "kt",
  "lb",
  "oz",
  "stone",
  "quintal",

  // ======================================================
  // LENGTH / DISTANCE
  // ======================================================
  "mm",
  "cm",
  "dm",
  "m",
  "dam",
  "hm",
  "km",
  "mil",
  "in",
  "ft",
  "yd",
  "mi",
  "nmi",

  // ======================================================
  // AREA
  // ======================================================
  "mm2",
  "cm2",
  "dm2",
  "m2",
  "km2",
  "in2",
  "ft2",
  "yd2",
  "mi2",
  "are",
  "ha",
  "acre",

  // ======================================================
  // VOLUME
  // ======================================================
  "mm3",
  "cm3",
  "dm3",
  "m3",
  "in3",
  "ft3",
  "yd3",
  "ml",
  "cl",
  "dl",
  "l",
  "dal",
  "hl",
  "kl",
  "fl_oz",
  "pt",
  "qt",
  "gal",
  "bbl",

  // ======================================================
  // TEMPERATURE
  // ======================================================
  "celsius",
  "fahrenheit",
  "kelvin",

  // ======================================================
  // TIME
  // ======================================================
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",

  // ======================================================
  // PACKAGING
  // ======================================================
  "box",
  "carton",
  "case",
  "crate",
  "pallet",
  "half_pallet",
  "bag",
  "sack",
  "packet",
  "pack",
  "bundle",
  "bale",
  "roll",
  "coil",
  "reel",
  "spool",
  "sheet",
  "plate",
  "strip",
  "bar",
  "rod",
  "tube",
  "pipe",
  "bottle",
  "can",
  "jar",
  "bucket",
  "drum",
  "barrel",
  "tank",
  "container",
  "silo",
  "bin",
  "tray",
  "basket",
  "envelope",
  "bag_small",
  "bag_large",

  // ======================================================
  // PRODUCTION / MANUFACTURING
  // ======================================================
  "batch",
  "production_order",
  "work_order",
  "job",
  "operation",
  "assembly",
  "subassembly",
  "component",
  "part",
  "assembly_unit",
  "finished_unit",
  "raw_material",
  "semi_finished",
  "finished_product",
  "scrap",
  "waste",

  // ======================================================
  // MATERIAL-SPECIFIC
  // ======================================================
  "linear_meter",
  "square_meter",
  "cubic_meter",
  "linear_foot",
  "square_foot",
  "cubic_foot",
  "running_meter",
  "running_foot",

  // ======================================================
  // PAPER / SHEET / FILM
  // ======================================================
  "ream",
  "roll_length",
  "sheet_count",
  "sheet_length",
  "sheet_area",

  // ======================================================
  // ELECTRICAL / ENERGY
  // ======================================================
  "w",
  "kw",
  "mw",
  "wh",
  "kwh",
  "mwh",
  "v",
  "kv",
  "a",
  "ka",
  "ma",
  "ohm",
  "kohm",
  "mohm",
  "hz",
  "khz",
  "mhz",

  // ======================================================
  // PRESSURE
  // ======================================================
  "pa",
  "kpa",
  "mpa",
  "bar",
  "mbar",
  "psi",
  "atm",

  // ======================================================
  // FORCE
  // ======================================================
  "n",
  "kn",
  "mn",
  "kgf",
  "lbf",

  // ======================================================
  // TORQUE
  // ======================================================
  "nm",
  "knm",
  "lbft",

  // ======================================================
  // SPEED / FLOW
  // ======================================================
  "m_per_s",
  "m_per_min",
  "m_per_h",
  "km_per_h",
  "ft_per_min",
  "l_per_min",
  "l_per_h",
  "m3_per_h",

  // ======================================================
  // CONCENTRATION / CHEMICAL
  // ======================================================
  "ppm",
  "ppb",
  "percent",
  "mol",
  "mmol",
  "mol_per_l",
  "g_per_l",
  "kg_per_m3",

  // ======================================================
  // DENSITY
  // ======================================================
  "g_per_cm3",
  "kg_per_m3",
  "kg_per_l",

  // ======================================================
  // DIMENSIONLESS / RATIOS
  // ======================================================
  "ratio",
  "percent",
  "ppm",

  // ======================================================
  // CUSTOM / LEGACY
  // ======================================================
  "custom",
];

/**
 * Translated label for a stored unit code.
 *
 * Falls back to the raw code when:
 * - the code is empty
 * - the code is a legacy/custom value
 * - the translation does not exist
 */
export function getUnitLabel(t, code) {
  if (!code) return "";

  return t(`units.${code}`, code);
}

/**
 * Builds the { value, label } options expected by CustomSelect.
 *
 * Existing legacy values that are not part of UNIT_CODES are
 * automatically appended so old products are never broken.
 */
export function buildUnitOptions(t, currentValue) {
  const options = UNIT_CODES.map((code) => ({
    value: code,
    label: t(`units.${code}`, code),
  }));

  if (currentValue && !UNIT_CODES.includes(currentValue)) {
    options.push({
      value: currentValue,
      label: currentValue,
    });
  }

  return options;
}