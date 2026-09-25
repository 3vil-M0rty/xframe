import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, FileSpreadsheet, Download, AlertTriangle } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import {
  getVatDeductions, downloadVatDeductions, downloadAccountingExport, getAgedBalance, downloadAgedBalance,
} from "../../services/purchasingService";
import { useCompanyPicker, formatMoney, formatDate } from "./shared";
import styles from "./Purchasing.module.css";
import d from "./PurchaseOrderDetail.module.css";

const monthStart = () => { const x = new Date(); return new Date(x.getFullYear(), x.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const sum = (rows, key) => Math.round(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) * 100) / 100;

/**
 * Rapports achats — the files the accountant and the tax return need:
 * TVA deduction listing (by payment date), accounting journal, and the
 * aged supplier balance.
 */
export default function PurchasingReports() {
  const { t } = useI18n();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [vatRows, setVatRows] = useState([]);
  const [withoutInvoice, setWithoutInvoice] = useState([]);
  const [aged, setAged] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setError("");
    try {
      const [v, a] = await Promise.all([getVatDeductions({ companyId, from, to }), getAgedBalance(companyId)]);
      setVatRows(v.rows);
      setWithoutInvoice(v.withoutInvoice);
      setAged(a);
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    }
  }, [companyId, from, to, t]);
  useEffect(() => { load(); }, [load]);

  const download = async (key, fn) => {
    setBusy(key);
    setError("");
    try { await fn(); } catch (err) { setError(err.response?.data?.message || err.message || t("purchasing.errors.load")); } finally { setBusy(""); }
  };

  const agedCols = "1.6fr repeat(6, 1fr)";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.reports.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><BarChart3 size={20} /><h1>{t("purchasing.reports.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.reports.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <div className="filterGroup">
          <label>{t("common.dateFrom")}</label>
          <input type="date" className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="filterGroup">
          <label>{t("common.dateTo")}</label>
          <input type="date" className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}

      {/* ---------- TVA deductions ---------- */}
      <section className={d.card}>
        <header className={d.cardHeader}>
          <h2><FileSpreadsheet size={16} />{t("purchasing.reports.vatTitle")}<span className={d.count}>{vatRows.length}</span></h2>
          <button type="button" className="btnPrimary" disabled={!companyId || busy === "vat"} onClick={() => download("vat", () => downloadVatDeductions({ companyId, from, to }))}>
            <Download size={14} /> {t("purchasing.reports.downloadXlsx")}
          </button>
        </header>
        <div className={d.cardBody}>
          <p className={d.muted}>{t("purchasing.reports.vatHint")}</p>
          <div className={d.kpis} style={{ margin: "10px 0" }}>
            <div className={d.kpi}><span className={d.kpiLabel}>{t("purchasing.totals.ht")}</span><strong className={d.kpiValue}>{formatMoney(sum(vatRows, "amountHT"))}</strong></div>
            <div className={d.kpi}><span className={d.kpiLabel}>{t("purchasing.reports.vatDeductible")}</span><strong className={d.kpiValue}>{formatMoney(sum(vatRows, "vatAmount"))}</strong></div>
            <div className={d.kpi}><span className={d.kpiLabel}>{t("purchasing.totals.ttc")}</span><strong className={d.kpiValue}>{formatMoney(sum(vatRows, "amountTTC"))}</strong></div>
          </div>
          {vatRows.length > 0 && (
            <div className="dataTable">
              <div className="dataTableHead" style={{ gridTemplateColumns: "1fr 1.3fr 1fr 1fr 0.8fr 1fr 1fr" }}>
                <span>{t("purchasing.detail.invoiceNumber")}</span><span>{t("purchasing.columns.supplier")}</span>
                <span>{t("purchasing.reports.supplierIds")}</span><span>{t("purchasing.totals.ht")}</span>
                <span>{t("purchasing.totals.vat")}</span><span>{t("purchasing.reports.paymentDate")}</span><span>{t("purchasing.detail.method")}</span>
              </div>
              {vatRows.slice(0, 50).map((r, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="dataTableRow" style={{ gridTemplateColumns: "1fr 1.3fr 1fr 1fr 0.8fr 1fr 1fr" }}>
                  <span>{r.invoiceNumber}<small className={d.muted}> {formatDate(r.invoiceDate)}</small></span>
                  <span>{r.supplierName}</span>
                  <span className={d.muted}>{[r.supplierIF && `IF ${r.supplierIF}`, r.supplierICE && `ICE ${r.supplierICE}`].filter(Boolean).join(" · ") || <span className={styles.amountDue}>{t("purchasing.reports.missingIds")}</span>}</span>
                  <span>{formatMoney(r.amountHT)}</span>
                  <span>{formatMoney(r.vatAmount)} <small className={d.muted}>{r.vatRate}%</small></span>
                  <span>{formatDate(r.paymentDate)}</span>
                  <span>{t(`purchasing.paymentMethods.${r.paymentMethod}`)}</span>
                </div>
              ))}
            </div>
          )}
          {vatRows.length === 0 && <p className={d.muted}>{t("purchasing.reports.vatEmpty")}</p>}

          {/* Payments the listing can't include: no supplier invoice yet
              (VAT is deducted on an invoice). Without this, the report
              looked empty for no visible reason. */}
          {withoutInvoice.length > 0 && (
            <div className={d.alertWarn} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={15} />
                {t("purchasing.reports.withoutInvoiceTitle").replace("{count}", withoutInvoice.length)}
              </strong>
              <span>{t("purchasing.reports.withoutInvoiceHint")}</span>
              <ul className={styles.plainList} style={{ margin: "6px 0 0" }}>
                {withoutInvoice.map((p, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={i}>
                    <Link to={`/purchasing/orders/${p.orderId}`} className={styles.orderLink} style={{ marginLeft: 0 }}>{p.orderNumber}</Link>
                    {" — "}{p.supplierName} · {formatDate(p.paymentDate)} · {t(`purchasing.paymentMethods.${p.paymentMethod}`)} · <strong>{formatMoney(p.amount)}</strong>
                    {" — "}{t(`purchasing.reports.withoutInvoiceReason.${p.reason}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ---------- accounting export ---------- */}
      <section className={d.card}>
        <header className={d.cardHeader}>
          <h2><FileSpreadsheet size={16} />{t("purchasing.reports.accountingTitle")}</h2>
          <button type="button" className="btnPrimary" disabled={!companyId || busy === "acc"} onClick={() => download("acc", () => downloadAccountingExport({ companyId, from, to }))}>
            <Download size={14} /> {t("purchasing.reports.downloadXlsx")}
          </button>
        </header>
        <div className={d.cardBody}>
          <p className={d.muted}>{t("purchasing.reports.accountingHint")}</p>
          <div className={d.chips}>
            {["6111", "34552", "4411", "5141", "5161"].map((acc) => (
              <span key={acc} className={d.chip}><strong>{acc}</strong> {t(`purchasing.reports.accounts.a${acc}`)}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- aged balance ---------- */}
      <section className={d.card}>
        <header className={d.cardHeader}>
          <h2><FileSpreadsheet size={16} />{t("purchasing.reports.agedTitle")}<span className={d.count}>{aged.length}</span></h2>
          <button type="button" className="btnPrimary" disabled={!companyId || busy === "aged"} onClick={() => download("aged", () => downloadAgedBalance(companyId))}>
            <Download size={14} /> {t("purchasing.reports.downloadXlsx")}
          </button>
        </header>
        <div className={d.cardBody}>
          <p className={d.muted}>{t("purchasing.reports.agedHint")}</p>
          {aged.length === 0 ? <p className={d.muted}>{t("purchasing.reports.agedEmpty")}</p> : (
            <div className="dataTable">
              <div className="dataTableHead" style={{ gridTemplateColumns: agedCols }}>
                <span>{t("purchasing.columns.supplier")}</span>
                {["notDue", "d1_30", "d31_60", "d61_90", "d90plus", "total"].map((k) => <span key={k}>{t(`purchasing.reports.aged.${k}`)}</span>)}
              </div>
              {aged.map((r) => (
                <div key={r.supplierId} className="dataTableRow" style={{ gridTemplateColumns: agedCols }}>
                  <span><strong>{r.supplierName}</strong></span>
                  <span>{formatMoney(r.notDue)}</span>
                  {["d1_30", "d31_60", "d61_90", "d90plus"].map((k) => <span key={k} className={r[k] > 0 ? styles.amountDue : d.muted}>{formatMoney(r[k])}</span>)}
                  <span><strong>{formatMoney(r.total)}</strong></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
