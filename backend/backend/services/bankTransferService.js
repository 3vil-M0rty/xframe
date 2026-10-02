const ExcelJS = require("exceljs");

/**
 * ============================================================
 * SALARY BANK TRANSFER (virement de masse)
 * ============================================================
 * Checks every RIB before the file goes to the bank (a wrong digit
 * means a rejected — or misdirected — salary), then produces the
 * list of transfers as Excel and CSV: the formats every Moroccan
 * bank's corporate portal imports (column mapping is chosen on the
 * portal the first time).
 *
 * Moroccan RIB: 24 digits = bank (3) + city/branch (3) + account
 * (16) + key (2). Key = 97 − ((first 22 digits × 100) mod 97).
 * An IBAN (MA + 2 check digits + the 24-digit RIB) is accepted too.
 * ============================================================
 */

const BANKS = {
  "007": "Attijariwafa bank",
  "011": "Bank of Africa",
  "013": "BMCI",
  "021": "Crédit du Maroc",
  "022": "Société Générale Maroc",
  "225": "Crédit Agricole du Maroc",
  "230": "CIH Bank",
  "350": "Al Barid Bank",
};

function bankNameFor(code) {
  if (BANKS[code]) return BANKS[code];
  if (/^1\d\d$/.test(code)) return "Banque Populaire";
  return "";
}

function mod97(digits) {
  // Big number mod 97, chunk by chunk (no BigInt needed).
  let rest = 0;
  for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
  return rest;
}

/**
 * @returns {{ valid, rib, bankCode, bankName, reason }}
 *   reason: "missing" | "length" | "key" | null
 */
function validateRib(input) {
  let raw = String(input || "").replace(/[\s.-]/g, "").toUpperCase();
  if (!raw) return { valid: false, rib: "", bankCode: "", bankName: "", reason: "missing" };
  if (raw.startsWith("MA") && raw.length === 28) raw = raw.slice(4); // IBAN → RIB
  if (!/^\d{24}$/.test(raw)) return { valid: false, rib: raw, bankCode: "", bankName: "", reason: "length" };
  const expectedKey = 97 - mod97(`${raw.slice(0, 22)}00`);
  const bankCode = raw.slice(0, 3);
  if (Number(raw.slice(22)) !== expectedKey) {
    return { valid: false, rib: raw, bankCode, bankName: bankNameFor(bankCode), reason: "key" };
  }
  return { valid: true, rib: raw, bankCode, bankName: bankNameFor(bankCode), reason: null };
}

/** Makes a valid RIB from 22 digits (tests, demo data). */
function ribWithKey(first22) {
  const key = 97 - mod97(`${first22}00`);
  return `${first22}${String(key).padStart(2, "0")}`;
}

const REASONS = {
  missing: "no RIB on file",
  length: "the RIB must have 24 digits",
  key: "wrong RIB key (a digit is wrong)",
};

/**
 * @param {Object} p - { run, payslips (employee populated), company }
 */
function buildTransferPlan({ run, payslips, company }) {
  const transfers = [];
  const excluded = [];
  const problems = [];
  const otherPayments = [];

  const companyRib = validateRib(company?.bank?.iban || company?.bank?.rib);
  if (!companyRib.valid) {
    problems.push({ code: "company_rib", message: `Company RIB: ${REASONS[companyRib.reason]} (Organisation → Company → Bank).` });
  }

  for (const p of payslips) {
    const e = p.employee || {};
    const name = `${e.lastName || ""} ${e.firstName || ""}`.trim();
    const method = e.paymentMethod || "bank_transfer";
    if (method !== "bank_transfer") {
      otherPayments.push({ employeeId: e._id, name, method, amount: p.netSalary });
      continue;
    }
    if (!(p.netSalary > 0)) {
      excluded.push({ employeeId: e._id, name, reason: "net salary is zero" });
      continue;
    }
    const check = validateRib(e.bank?.iban && !e.bank?.rib ? e.bank.iban : e.bank?.rib || e.bank?.iban);
    if (!check.valid) {
      problems.push({ code: `rib_${check.reason}`, employeeId: e._id, message: `${name}: ${REASONS[check.reason]}.` });
      continue;
    }
    transfers.push({
      employeeId: e._id,
      employeeNumber: e.employeeNumber || "",
      name,
      rib: check.rib,
      bankName: check.bankName || e.bank?.bankName || "",
      amount: Math.round(p.netSalary * 100) / 100,
      reference: `SALAIRE ${String(run.month).padStart(2, "0")}/${run.year}`,
    });
  }

  const total = Math.round(transfers.reduce((s, t) => s + t.amount, 0) * 100) / 100;
  return {
    period: `${String(run.month).padStart(2, "0")}/${run.year}`,
    orderingParty: { name: company?.name || "", rib: companyRib.rib, ribValid: companyRib.valid, bankName: companyRib.bankName },
    transfers,
    otherPayments,
    excluded,
    problems,
    total,
    count: transfers.length,
    ready: problems.length === 0 && transfers.length > 0,
  };
}

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildTransferCsv(plan) {
  const header = ["N°", "Beneficiaire", "RIB", "Banque", "Montant", "Motif", "Matricule"];
  const rows = plan.transfers.map((t, i) => [i + 1, t.name, t.rib, t.bankName, t.amount.toFixed(2), t.reference, t.employeeNumber]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

async function buildTransferXlsx(plan, { executionDate } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Virements");
  ws.addRow(["Ordre de virement de masse — salaires " + plan.period]).font = { bold: true, size: 13 };
  ws.addRow(["Donneur d'ordre", plan.orderingParty.name]);
  ws.addRow(["RIB à débiter", plan.orderingParty.rib]);
  ws.addRow(["Date d'exécution", executionDate ? new Date(executionDate) : ""]);
  ws.addRow(["Nombre de virements", plan.count]);
  ws.addRow(["Montant total (MAD)", plan.total]);
  ws.addRow([]);
  const header = ws.addRow(["N°", "Bénéficiaire", "RIB (24 chiffres)", "Banque", "Montant (MAD)", "Motif", "Matricule"]);
  header.font = { bold: true };
  plan.transfers.forEach((t, i) => ws.addRow([i + 1, t.name, t.rib, t.bankName, t.amount, t.reference, t.employeeNumber]));
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 24;
  ws.getColumn(5).width = 14;
  ws.getColumn(5).numFmt = "#,##0.00";
  ws.getColumn(6).width = 18;
  ws.getCell("B4").numFmt = "dd/mm/yyyy";
  ws.getCell("B6").numFmt = "#,##0.00";
  // RIBs as text so Excel never turns them into 1.23E+23.
  ws.getColumn(3).eachCell((c) => { c.numFmt = "@"; });

  if (plan.otherPayments.length) {
    const other = wb.addWorksheet("Autres paiements");
    other.addRow(["Salariés payés hors virement (espèces / chèque)"]).font = { bold: true };
    other.addRow(["Nom", "Mode", "Montant (MAD)"]).font = { bold: true };
    plan.otherPayments.forEach((o) => other.addRow([o.name, o.method === "cash" ? "Espèces" : "Chèque", o.amount]));
    other.getColumn(1).width = 30;
    other.getColumn(3).numFmt = "#,##0.00";
  }
  return wb.xlsx.writeBuffer();
}

module.exports = { validateRib, ribWithKey, bankNameFor, buildTransferPlan, buildTransferCsv, buildTransferXlsx, BANKS };
