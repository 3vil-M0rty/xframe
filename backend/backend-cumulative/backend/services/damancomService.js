const { LINE_LENGTH, RECORDS, SITUATIONS, MAX_DAYS } = require("../config/cnssBdsLayout");
const payrollConfig = require("../config/payrollConfig");

/**
 * ============================================================
 * DAMANCOM — CNSS salary declaration file
 * ============================================================
 * 1. HR downloads the month's PRÉÉTABLI from Damancom.
 * 2. parsePreetabli() reads it; buildDeclarationPlan() matches every
 *    insured employee of the préétabli with this month's payslips
 *    (by CNSS number), finds the new employees (entrants) and lists
 *    what blocks the file (missing CNSS number, préétabli of another
 *    month, an employee absent from payroll with no situation...).
 * 3. buildDeclarationFile() writes the fixed-width declaration
 *    (B00–B06) to upload on Damancom ("Échange de fichiers").
 * Layouts: config/cnssBdsLayout.js (validate them — see there).
 * ============================================================
 */

const CRLF = "\r\n";

function stripAccents(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function formatField(value, length, type) {
  if (type === "N") {
    const digits = String(value ?? 0).replace(/\D/g, "") || "0";
    if (digits.length > length) throw new Error(`Value ${digits} does not fit in ${length} digits`);
    return digits.padStart(length, "0");
  }
  if (type === "D") {
    return String(value ?? "").replace(/\D/g, "").padEnd(length, "0").slice(0, length);
  }
  return stripAccents(value).toUpperCase().replace(/[\r\n]/g, " ").padEnd(length, " ").slice(0, length);
}

function buildLine(recordType, values) {
  const fields = RECORDS[recordType];
  const line = recordType + fields.map(([name, len, type]) => formatField(values[name], len, type)).join("");
  if (line.length !== LINE_LENGTH) throw new Error(`${recordType} line is ${line.length} characters, expected ${LINE_LENGTH}`);
  return line;
}

function parseLine(line) {
  const recordType = line.slice(0, 3);
  const fields = RECORDS[recordType];
  if (!fields) return null;
  let pos = 3;
  const out = { recordType };
  for (const [name, len, type] of fields) {
    const raw = line.slice(pos, pos + len);
    pos += len;
    if (name === "L_filler") continue;
    out[name] = type === "N" ? Number(raw.trim() || 0) : raw.trim();
    if (type === "N") out[`${name}_raw`] = raw;
  }
  return out;
}

/** Reads the préétabli file CNSS provides (text, fixed-width). */
function parsePreetabli(text) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  const result = { transferId: "", header: null, employees: [], recap: null, unknownLines: 0 };
  for (const raw of lines) {
    const rec = parseLine(raw.padEnd(LINE_LENGTH, " "));
    if (!rec) {
      result.unknownLines += 1;
      continue;
    }
    if (rec.recordType === "A00") result.transferId = rec.N_Identif_Transfert_raw;
    else if (rec.recordType === "A01") result.header = rec;
    else if (rec.recordType === "A02") {
      result.employees.push({
        cnssNumber: rec.N_Num_Assure_raw,
        name: rec.L_Nom_Prenom,
        children: rec.N_Enfants,
        afToPay: rec.N_AF_A_Payer,
        afToDeduct: rec.N_AF_A_Deduire,
        afNet: rec.N_AF_Net_A_Payer,
      });
    } else if (rec.recordType === "A03") result.recap = rec;
  }
  if (!result.header) {
    throw Object.assign(new Error("This isn't a CNSS préétabli file (no A01 header line). Download the préétabli of the month from Damancom."), { status: 400 });
  }
  return result;
}

const toCentimes = (mad) => Math.round((Number(mad) || 0) * 100);
const normCnss = (v) => String(v || "").replace(/\D/g, "");

/**
 * Matches the préétabli with the payroll run.
 * @param {Object} p
 * @param {Object} p.preetabli - parsePreetabli() result
 * @param {Object} p.run - { month, year }
 * @param {Array}  p.payslips - with `employee` populated
 * @param {Object} p.company
 * @param {Object} [p.situations] - { [cnssNumber]: "SO" | "IL" | ... } chosen by HR
 */
function buildDeclarationPlan({ preetabli, run, payslips, company, situations = {} }) {
  const period = `${run.year}${String(run.month).padStart(2, "0")}`;
  const problems = [];
  const warnings = [];

  const headerPeriod = String(preetabli.header.L_Periode_raw || preetabli.header.L_Periode || "");
  if (headerPeriod && headerPeriod !== period) {
    problems.push({ code: "period_mismatch", message: `The préétabli is for ${headerPeriod.slice(4)}/${headerPeriod.slice(0, 4)}, the payroll for ${run.month}/${run.year}.` });
  }
  const affiliate = normCnss(preetabli.header.N_Num_Affilie_raw);
  if (company?.cnssNumber && normCnss(company.cnssNumber) && Number(normCnss(company.cnssNumber)) !== Number(affiliate)) {
    warnings.push({ code: "affiliate_mismatch", message: `The préétabli's affiliation number (${affiliate}) differs from the company's CNSS number (${company.cnssNumber}).` });
  }

  const byCnss = new Map();
  for (const p of payslips) {
    const n = normCnss(p.employee?.cnssNumber);
    if (n) byCnss.set(n.padStart(9, "0"), p);
  }
  const used = new Set();

  const insured = preetabli.employees.map((row) => {
    const key = row.cnssNumber.padStart(9, "0");
    const payslip = byCnss.get(key);
    if (payslip) used.add(payslip);
    const situation = (situations[key] || situations[row.cnssNumber] || "").toUpperCase();
    const gross = payslip ? payslip.grossSalary : 0;
    const days = payslip ? declaredDays(payslip) : 0;
    const needsSituation = !payslip && !situation;
    if (situation && !SITUATIONS[situation]) {
      problems.push({ code: "bad_situation", cnssNumber: key, message: `${row.name}: unknown situation "${situation}".` });
    }
    if (needsSituation) {
      problems.push({ code: "needs_situation", cnssNumber: key, message: `${row.name} (${key}) is in the préétabli but has no payslip this month: choose why (left, sick leave, maternity…).` });
    }
    return {
      cnssNumber: key,
      name: row.name,
      children: row.children,
      afToPay: row.afToPay,
      afToDeduct: row.afToDeduct,
      afNet: row.afNet,
      afToReturn: 0,
      employeeId: payslip?.employee?._id || null,
      days,
      gross,
      capped: Math.min(gross, payrollConfig.CNSS.MONTHLY_CEILING),
      situation,
      needsSituation,
    };
  });

  const entrants = [];
  for (const p of payslips) {
    if (used.has(p)) continue;
    const e = p.employee || {};
    const cnss = normCnss(e.cnssNumber);
    const name = `${e.lastName || ""} ${e.firstName || ""}`.trim();
    if (!cnss) {
      problems.push({ code: "missing_cnss", employeeId: e._id, message: `${name}: no CNSS number — register the employee with CNSS (immatriculation) and enter the number on their file.` });
      continue;
    }
    if (cnss.length > 9) {
      problems.push({ code: "bad_cnss", employeeId: e._id, message: `${name}: CNSS number "${e.cnssNumber}" is longer than 9 digits.` });
      continue;
    }
    if (!e.cin) warnings.push({ code: "missing_cin", employeeId: e._id, message: `${name}: no CIN on file — new employees are declared with their CIN.` });
    entrants.push({
      cnssNumber: cnss.padStart(9, "0"),
      name,
      cin: (e.cin || "").toUpperCase(),
      employeeId: e._id,
      days: declaredDays(p),
      gross: p.grossSalary,
      capped: Math.min(p.grossSalary, payrollConfig.CNSS.MONTHLY_CEILING),
    });
  }

  const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  return {
    period,
    affiliate,
    transferId: preetabli.transferId,
    header: preetabli.header,
    insured,
    entrants,
    totals: {
      employees: insured.length + entrants.length,
      days: sum(insured, "days") + sum(entrants, "days"),
      gross: Math.round((sum(insured, "gross") + sum(entrants, "gross")) * 100) / 100,
      capped: Math.round((sum(insured, "capped") + sum(entrants, "capped")) * 100) / 100,
    },
    problems,
    warnings,
    ready: problems.length === 0,
  };
}

function declaredDays(payslip) {
  if (Number.isFinite(payslip.declaredDays)) return Math.max(0, Math.min(MAX_DAYS, payslip.declaredDays));
  return MAX_DAYS;
}

/** The declaration file (text, CRLF lines). Throws if the plan has problems. */
function buildDeclarationFile(plan, { issuedOn = new Date() } = {}) {
  if (!plan.ready) {
    throw Object.assign(new Error("The declaration has unresolved problems"), { status: 400, problems: plan.problems });
  }
  const h = plan.header;
  const base = { N_Num_Affilie: plan.affiliate, L_Periode: plan.period };
  const lines = [];

  lines.push(buildLine("B00", { N_Identif_Transfert: plan.transferId, L_Cat: "B0" }));
  lines.push(buildLine("B01", {
    ...base,
    L_Raison_Sociale: h.L_Raison_Sociale,
    L_Activite: h.L_Activite,
    L_Adresse: h.L_Adresse,
    L_Ville: h.L_Ville,
    C_Code_Postal: h.C_Code_Postal,
    C_Code_Agence: h.C_Code_Agence,
    D_Date_Emission: h.D_Date_Emission_raw || h.D_Date_Emission || issuedOn.toISOString().slice(0, 10),
    D_Date_Exig: h.D_Date_Exig_raw || h.D_Date_Exig,
  }));

  const t = { n: 0, children: 0, afPay: 0, afDed: 0, afNet: 0, afRet: 0, imma: 0, days: 0, real: 0, plaf: 0, ctr: 0 };
  for (const r of plan.insured) {
    const real = toCentimes(r.gross);
    const plaf = toCentimes(r.capped);
    const sit = r.situation ? SITUATIONS[r.situation].code : 0;
    const ctr = Number(r.cnssNumber) + r.afToReturn + r.days + real + plaf + sit;
    lines.push(buildLine("B02", {
      ...base,
      N_Num_Assure: r.cnssNumber,
      L_Nom_Prenom: r.name,
      N_Enfants: r.children,
      N_AF_A_Payer: r.afToPay,
      N_AF_A_Deduire: r.afToDeduct,
      N_AF_Net_A_Payer: r.afNet,
      N_AF_A_Reverser: r.afToReturn,
      N_Jours_Declares: r.days,
      N_Salaire_Reel: real,
      N_Salaire_Plaf: plaf,
      L_Situation: r.situation,
      S_Ctr: ctr,
    }));
    t.n += 1;
    t.children += r.children || 0;
    t.afPay += r.afToPay || 0;
    t.afDed += r.afToDeduct || 0;
    t.afNet += r.afNet || 0;
    t.afRet += r.afToReturn || 0;
    t.imma += Number(r.cnssNumber);
    t.days += r.days;
    t.real += real;
    t.plaf += plaf;
    t.ctr += ctr;
  }
  lines.push(buildLine("B03", {
    ...base,
    N_Nbr_Salaries: t.n,
    N_T_Enfants: t.children,
    N_T_AF_A_Payer: t.afPay,
    N_T_AF_A_Deduire: t.afDed,
    N_T_AF_Net_A_Payer: t.afNet,
    N_T_AF_A_Reverser: t.afRet,
    N_T_Num_Imma: t.imma,
    N_T_Jours_Declares: t.days,
    N_T_Salaire_Reel: t.real,
    N_T_Salaire_Plaf: t.plaf,
    N_T_Ctr: t.ctr,
  }));

  const e = { n: 0, imma: 0, days: 0, real: 0, plaf: 0, ctr: 0 };
  for (const r of plan.entrants) {
    const real = toCentimes(r.gross);
    const plaf = toCentimes(r.capped);
    const ctr = Number(r.cnssNumber) + r.days + real + plaf;
    lines.push(buildLine("B04", {
      ...base,
      N_Num_Assure: r.cnssNumber,
      L_Nom_Prenom: r.name,
      L_Num_CIN: r.cin,
      N_Nbr_Jours: r.days,
      N_Sal_Reel: real,
      N_Sal_Plaf: plaf,
      S_Ctr: ctr,
    }));
    e.n += 1;
    e.imma += Number(r.cnssNumber);
    e.days += r.days;
    e.real += real;
    e.plaf += plaf;
    e.ctr += ctr;
  }
  lines.push(buildLine("B05", {
    ...base,
    N_Nbr_Salaries: e.n,
    N_T_Num_Imma: e.imma,
    N_T_Jours_Declares: e.days,
    N_T_Salaire_Reel: e.real,
    N_T_Salaire_Plaf: e.plaf,
    N_T_Ctr: e.ctr,
  }));
  lines.push(buildLine("B06", {
    ...base,
    N_Nbr_Salaries: t.n + e.n,
    N_T_Num_Imma: t.imma + e.imma,
    N_T_Jours_Declares: t.days + e.days,
    N_T_Salaire_Reel: t.real + e.real,
    N_T_Salaire_Plaf: t.plaf + e.plaf,
    N_T_Ctr: t.ctr + e.ctr,
  }));

  return lines.join(CRLF) + CRLF;
}

module.exports = { parsePreetabli, buildDeclarationPlan, buildDeclarationFile, buildLine, parseLine, formatField, SITUATIONS };
