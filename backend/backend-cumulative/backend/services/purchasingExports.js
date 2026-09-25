const ExcelJS = require("exceljs");

/**
 * Excel files for the purchasing reports. Content is complete and
 * correct; exact column layouts for specific targets (DGI SIMPL, a
 * given accounting software) can be adapted later without touching
 * the calculations (services/purchasingReports.js).
 */

const DATE_FMT = "dd/mm/yyyy";
const MONEY_FMT = "#,##0.00";

const PAYMENT_LABELS = { virement: "Virement", cheque: "Chèque", especes: "Espèces", effet: "Effet", carte: "Carte", autre: "Autre" };

/** One sheet: title rows, header, data, optional totals row. */
function addSheet(workbook, name, { title, subtitle, columns, rows, totals }) {
  const ws = workbook.addWorksheet(name.slice(0, 31));
  let r = 1;
  if (title) { ws.getCell(r, 1).value = title; ws.getCell(r, 1).font = { bold: true, size: 13 }; r += 1; }
  if (subtitle) { ws.getCell(r, 1).value = subtitle; ws.getCell(r, 1).font = { italic: true, color: { argb: "FF666666" } }; r += 1; }
  if (title || subtitle) r += 1;

  const headerRow = r;
  columns.forEach((c, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = { bottom: { style: "thin" } };
    ws.getColumn(i + 1).width = c.width || 16;
  });
  rows.forEach((row, k) => {
    columns.forEach((c, i) => {
      const cell = ws.getCell(headerRow + 1 + k, i + 1);
      const v = typeof c.value === "function" ? c.value(row) : row[c.key];
      cell.value = c.type === "date" ? (v ? new Date(v) : null) : v ?? "";
      if (c.type === "date") cell.numFmt = DATE_FMT;
      if (c.type === "money") cell.numFmt = MONEY_FMT;
    });
  });
  if (totals && rows.length) {
    const tr = headerRow + rows.length + 1;
    ws.getCell(tr, 1).value = "Total";
    ws.getCell(tr, 1).font = { bold: true };
    columns.forEach((c, i) => {
      if (!totals.includes(c.key)) return;
      const cell = ws.getCell(tr, i + 1);
      cell.value = Math.round(rows.reduce((s, x) => s + (Number(x[c.key]) || 0), 0) * 100) / 100;
      cell.numFmt = MONEY_FMT;
      cell.font = { bold: true };
      cell.border = { top: { style: "thin" } };
    });
  }
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  return ws;
}

const periodLabel = ({ from, to }) => (from || to
  ? `Période : ${from ? new Date(from).toLocaleDateString("fr-FR") : "…"} → ${to ? new Date(to).toLocaleDateString("fr-FR") : "…"}`
  : "Toutes périodes");

async function vatDeductionXlsx(rows, { company, from, to, withoutInvoice = [] }) {
  const wb = new ExcelJS.Workbook();
  addSheet(wb, "Relevé déductions TVA", {
    title: `Relevé des déductions de TVA — ${company?.name || ""}`,
    subtitle: `${periodLabel({ from, to })}${company?.taxId ? `   ·   IF : ${company.taxId}` : ""}${company?.ice ? `   ·   ICE : ${company.ice}` : ""}`,
    columns: [
      { header: "N° facture", key: "invoiceNumber", width: 16 },
      { header: "Date facture", key: "invoiceDate", type: "date", width: 13 },
      { header: "Fournisseur", key: "supplierName", width: 26 },
      { header: "IF fournisseur", key: "supplierIF", width: 15 },
      { header: "ICE fournisseur", key: "supplierICE", width: 19 },
      { header: "Désignation", key: "description", width: 34 },
      { header: "Montant HT", key: "amountHT", type: "money", width: 14 },
      { header: "Taux TVA (%)", key: "vatRate", width: 11 },
      { header: "TVA", key: "vatAmount", type: "money", width: 13 },
      { header: "Montant TTC", key: "amountTTC", type: "money", width: 14 },
      { header: "Mode de paiement", value: (r) => PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod, width: 15 },
      { header: "Date de paiement", key: "paymentDate", type: "date", width: 14 },
      { header: "Réf. paiement", key: "paymentReference", width: 15 },
    ],
    rows,
    totals: ["amountHT", "vatAmount", "amountTTC"],
  });
  if (withoutInvoice.length) {
    addSheet(wb, "Paiements sans facture", {
      title: "Paiements non repris dans le relevé",
      subtitle: "Aucune facture fournisseur enregistrée (ou payé au-delà du facturé) : la TVA ne peut être déduite qu'une fois la facture saisie.",
      columns: [
        { header: "Date de paiement", key: "paymentDate", type: "date", width: 15 },
        { header: "BC", key: "orderNumber", width: 15 },
        { header: "Fournisseur", key: "supplierName", width: 26 },
        { header: "Mode de paiement", value: (r) => PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod, width: 16 },
        { header: "Réf. paiement", key: "paymentReference", width: 16 },
        { header: "Montant non rapproché", key: "amount", type: "money", width: 18 },
        { header: "Motif", value: (r) => (r.reason === "no_invoice" ? "Facture manquante" : "Payé au-delà du facturé"), width: 24 },
      ],
      rows: withoutInvoice,
      totals: ["amount"],
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function accountingXlsx(entries, { company, from, to }) {
  const wb = new ExcelJS.Workbook();
  const columns = [
    { header: "Date", key: "date", type: "date", width: 12 },
    { header: "Journal", key: "journal", width: 9 },
    { header: "N° pièce", key: "piece", width: 16 },
    { header: "Compte", key: "account", width: 10 },
    { header: "Tiers", key: "supplier", width: 22 },
    { header: "Libellé", key: "label", width: 44 },
    { header: "Débit", key: "debit", type: "money", width: 14 },
    { header: "Crédit", key: "credit", type: "money", width: 14 },
  ];
  const subtitle = periodLabel({ from, to });
  addSheet(wb, "Journal des achats", { title: `Journal des achats — ${company?.name || ""}`, subtitle, columns, rows: entries.filter((e) => e.journal === "ACH"), totals: ["debit", "credit"] });
  addSheet(wb, "Règlements", { title: `Règlements fournisseurs — ${company?.name || ""}`, subtitle, columns, rows: entries.filter((e) => e.journal !== "ACH"), totals: ["debit", "credit"] });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function agedBalanceXlsx(rows, { company }) {
  const wb = new ExcelJS.Workbook();
  addSheet(wb, "Balance âgée", {
    title: `Balance âgée fournisseurs — ${company?.name || ""}`,
    subtitle: `Au ${new Date().toLocaleDateString("fr-FR")}`,
    columns: [
      { header: "Fournisseur", key: "supplierName", width: 28 },
      { header: "Non échu", key: "notDue", type: "money", width: 14 },
      { header: "1–30 j", key: "d1_30", type: "money", width: 14 },
      { header: "31–60 j", key: "d31_60", type: "money", width: 14 },
      { header: "61–90 j", key: "d61_90", type: "money", width: 14 },
      { header: "> 90 j", key: "d90plus", type: "money", width: 14 },
      { header: "Total dû", key: "total", type: "money", width: 15 },
    ],
    rows,
    totals: ["notDue", "d1_30", "d31_60", "d61_90", "d90plus", "total"],
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const TYPE_LABELS = { invoice: "Facture", credit_note: "Avoir", payment: "Règlement" };

async function statementXlsx(statement, { company, supplier, from, to }) {
  const wb = new ExcelJS.Workbook();
  const rows = [
    { date: from || null, typeLabel: "Solde d'ouverture", reference: "", orderNumber: "", debit: null, credit: null, balance: statement.openingBalance },
    ...statement.rows.map((r) => ({ ...r, typeLabel: TYPE_LABELS[r.type] + (r.method ? ` (${PAYMENT_LABELS[r.method] || r.method})` : "") })),
  ];
  addSheet(wb, "Relevé", {
    title: `Relevé fournisseur — ${supplier?.name || ""}`,
    subtitle: `${company?.name || ""}   ·   ${periodLabel({ from, to })}   ·   Solde : ${statement.closingBalance.toFixed(2)} MAD`,
    columns: [
      { header: "Date", key: "date", type: "date", width: 12 },
      { header: "Opération", key: "typeLabel", width: 22 },
      { header: "Référence", key: "reference", width: 16 },
      { header: "BC", key: "orderNumber", width: 14 },
      { header: "Débit (facturé)", key: "debit", type: "money", width: 15 },
      { header: "Crédit (réglé / avoir)", key: "credit", type: "money", width: 18 },
      { header: "Solde", key: "balance", type: "money", width: 15 },
    ],
    rows,
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { vatDeductionXlsx, accountingXlsx, agedBalanceXlsx, statementXlsx };
