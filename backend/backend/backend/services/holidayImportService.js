const ExcelJS = require("exceljs");
const { parse: parseCsv } = require("csv-parse/sync");

/**
 * ============================================================
 * HOLIDAY IMPORT (Excel .xlsx or .csv)
 * ============================================================
 * Turns an uploaded file into validated rows for the preview step —
 * nothing is saved here. Expected columns (first row = headers,
 * French or English, order doesn't matter):
 *
 *   Date                          required  20/03/2026, 2026-03-20, or a real Excel date
 *   Nom / Name                    required  e.g. "Aïd al-Fitr"
 *   Entreprise ouverte / Open     optional  oui/non, yes/no, 1/0   (default: non = closed)
 *   Paiement / Pay                optional  double/normal, 2/1, x2, 200%  (default: double)
 * ============================================================
 */

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const HEADER_ALIASES = {
  date: ["date", "jour", "day"],
  name: ["nom", "name", "libelle", "intitule", "fete", "holiday", "jour ferie", "jours feries"],
  open: ["entreprise ouverte", "ouvert", "ouverte", "travaille", "open", "working", "worked", "company open"],
  pay: ["paiement", "paiement si travaille", "payment", "pay", "remuneration", "taux", "rate"],
};

function mapHeaders(headers) {
  const mapping = {};
  headers.forEach((header, index) => {
    const h = normalize(header).replace(/\(.*\)/, "").trim();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapping[field] === undefined && aliases.some((a) => h === a || h.startsWith(`${a} `))) {
        mapping[field] = index;
      }
    }
  });
  return mapping;
}

const pad = (n) => String(n).padStart(2, "0");
const isRealDate = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Returns "YYYY-MM-DD" or null. Excel stores dates as UTC midnight,
 *  so Date objects are read with UTC getters. */
function toDayKey(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  // An unformatted Excel date cell: serial number of days since 1899-12-30.
  if (typeof value === "number" && value > 20000 && value < 80000) {
    return toDayKey(new Date(Math.round((value - 25569) * 86400000)));
  }

  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY (Moroccan / French order)
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  return null;
}

/** true / false, or undefined when empty, or "invalid". */
function toOpen(value) {
  const v = normalize(value);
  if (v === "") return undefined;
  if (["oui", "yes", "o", "y", "1", "true", "vrai", "ouvert", "ouverte"].includes(v)) return true;
  if (["non", "no", "n", "0", "false", "faux", "ferme", "fermee", "closed"].includes(v)) return false;
  return "invalid";
}

/** 2 / 1, or undefined when empty, or "invalid". */
function toPayRate(value) {
  const v = normalize(value).replace(/\s/g, "");
  if (v === "") return undefined;
  if (["double", "2", "x2", "2x", "200%", "200"].includes(v)) return 2;
  if (["normal", "normale", "1", "x1", "1x", "100%", "100", "simple"].includes(v)) return 1;
  return "invalid";
}

/** Plain value of an ExcelJS cell (formula results, rich text...). */
function cellValue(cell) {
  const v = cell?.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return v.result;
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
}

async function readRows(buffer, filename = "") {
  const isCsv = /\.csv$/i.test(filename);
  if (isCsv) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const delimiter = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    return parseCsv(text, { delimiter, skip_empty_lines: true, relax_column_count: true, trim: true });
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    for (let c = 1; c <= Math.max(row.cellCount, 4); c += 1) values.push(cellValue(row.getCell(c)));
    rows.push(values);
  });
  return rows;
}

/**
 * Parses and validates a holiday file. Returns
 *   { rows: [{ row, day, name, isWorkingDay, payRate, errors, warnings }], errorCount, missingColumns }
 */
async function parseHolidayFile(buffer, filename) {
  const raw = await readRows(buffer, filename);
  if (raw.length === 0) return { rows: [], errorCount: 0, missingColumns: ["date", "name"] };

  const mapping = mapHeaders(raw[0]);
  const missingColumns = ["date", "name"].filter((f) => mapping[f] === undefined);
  if (missingColumns.length) return { rows: [], errorCount: 0, missingColumns };

  const seen = new Map();
  const rows = [];
  raw.slice(1).forEach((values, i) => {
    const rowNumber = i + 2; // spreadsheet row number, header is row 1
    const get = (field) => (mapping[field] === undefined ? undefined : values[mapping[field]]);
    if (values.every((v) => v === null || v === undefined || String(v).trim() === "")) return;

    const errors = [];
    const warnings = [];
    const day = toDayKey(get("date"));
    const name = String(get("name") ?? "").trim();
    const open = toOpen(get("open"));
    const pay = toPayRate(get("pay"));

    if (!day) errors.push("Invalid or missing date (use DD/MM/YYYY)");
    if (!name) errors.push("Missing holiday name");
    if (open === "invalid") errors.push('"Company open" must be oui/non (yes/no)');
    if (pay === "invalid") errors.push('"Pay" must be double or normal');
    if (day && seen.has(day)) errors.push(`Same date as row ${seen.get(day)}`);
    if (day) seen.set(day, rowNumber);

    rows.push({
      row: rowNumber,
      day,
      name,
      isWorkingDay: open === true ? true : open === false ? false : undefined,
      payRate: typeof pay === "number" ? pay : undefined,
      errors,
      warnings,
    });
  });

  return { rows, errorCount: rows.filter((r) => r.errors.length).length, missingColumns: [] };
}

module.exports = { parseHolidayFile, toDayKey, toOpen, toPayRate };
