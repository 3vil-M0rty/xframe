import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Download } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { getReceivables, getVatCollected, downloadVatCollected } from "../../services/salesService";
import { useCompanyPicker, formatMoney, formatDate } from "./salesShared";
import styles from "../purchasing/Purchasing.module.css";
import s from "./Sales.module.css";

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const BUCKETS = ["notDue", "d1_30", "d31_60", "d61_90", "d90plus"];

/** Encaissements: what customers owe (by age), invoices to chase, VAT collected. */
export default function Receivables() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [data, setData] = useState(null);
  const [vat, setVat] = useState(null);
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId) return;
    getReceivables(companyId).then(setData).catch((err) => setError(err.response?.data?.message || t("sales.errors.load")));
  }, [companyId, t]);
  useEffect(() => {
    if (!companyId) return;
    getVatCollected(companyId, range.from, range.to).then(setVat).catch(() => setVat(null));
  }, [companyId, range]);

  const overdue = data ? data.totals.d1_30 + data.totals.d31_60 + data.totals.d61_90 + data.totals.d90plus : 0;
  const now = new Date();

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.sales"), href: "/sales/quotes" }, { label: t("sales.receivables.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Wallet size={20} /><h1>{t("sales.receivables.title")}</h1></div>
          <p className="pageSubtitle">{t("sales.receivables.subtitle")}</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}

      {data && (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><span>{t("sales.receivables.toCollect")}</span><strong>{formatMoney(data.totals.total)}</strong></div>
            <div className={styles.summaryCard}><span>{t("sales.receivables.overdue")}</span><strong className={overdue > 0 ? s.bad : ""}>{formatMoney(overdue)}</strong></div>
            <div className={styles.summaryCard}><span>{t("sales.receivables.invoicedMonth")}</span><strong>{formatMoney(data.invoicedThisMonth)}</strong></div>
            <div className={styles.summaryCard}><span>{t("sales.receivables.collectedMonth")}</span><strong className={s.good}>{formatMoney(data.collectedThisMonth)}</strong></div>
          </div>

          <section className={styles.section}>
            <h2>{t("sales.receivables.byCustomer")}</h2>
            {data.rows.length === 0 ? <p className={s.muted}>{t("sales.receivables.nothingDue")}</p> : (
              <div className="dataTable">
                <div className="dataTableHead" style={{ gridTemplateColumns: "1.6fr repeat(5, 1fr) 1fr 1fr" }}>
                  <span>{t("sales.customer")}</span>
                  {BUCKETS.map((b) => <span key={b}>{t(`sales.receivables.buckets.${b}`)}</span>)}
                  <span>{t("sales.receivables.credits")}</span><span>{t("sales.receivables.total")}</span>
                </div>
                {data.rows.map((r) => (
                  <div key={r.customer?._id || String(r.customer)} className="dataTableRow" style={{ gridTemplateColumns: "1.6fr repeat(5, 1fr) 1fr 1fr" }}>
                    <span><strong>{r.customer?.name}</strong></span>
                    {BUCKETS.map((b) => <span key={b} className={b !== "notDue" && r[b] ? s.bad : "dataTableCellMuted"}>{r[b] ? formatMoney(r[b], "") : "—"}</span>)}
                    <span className="dataTableCellMuted">{r.credits ? `− ${formatMoney(r.credits, "")}` : "—"}</span>
                    <span><strong>{formatMoney(r.total, "")}</strong></span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {data.openInvoices.length > 0 && (
            <section className={styles.section}>
              <h2>{t("sales.receivables.toChase")}</h2>
              <div className="dataTable">
                {data.openInvoices.map((i) => {
                  const late = i.dueDate && new Date(i.dueDate) < now;
                  const days = late ? Math.floor((now - new Date(i.dueDate)) / 86400000) : 0;
                  return (
                    <div key={i._id} className={`dataTableRow ${styles.clickableRow}`} style={{ gridTemplateColumns: "130px 1.4fr 110px 110px 1fr" }}
                      role="button" tabIndex={0} onClick={() => navigate(`/sales/invoices/${i._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/sales/invoices/${i._id}`)}>
                      <span><strong>{i.number}</strong></span>
                      <span>{i.customer?.name}</span>
                      <span className={late ? s.bad : "dataTableCellMuted"}>{formatDate(i.dueDate)}</span>
                      <span><strong>{formatMoney(i.due, "")}</strong></span>
                      <span>{late && <span className={`${s.tag} ${s.tagBad}`}>{t("sales.receivables.lateDays").replace("{days}", days)}</span>}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>{t("sales.vat.title")}</h2>
          <div className={s.statusBar} style={{ marginBottom: 0 }}>
            <input className={styles.input} style={{ width: 150 }} type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <input className={styles.input} style={{ width: 150 }} type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            <button type="button" className="btnEdit" onClick={() => downloadVatCollected(companyId, range.from, range.to).catch((err) => setError(err.response?.data?.message || t("sales.errors.load")))}>
              <Download size={15} /> Excel
            </button>
          </div>
        </div>
        <p className={s.muted}>{t("sales.vat.hint")}</p>
        {vat && (
          <div className={s.compare} style={{ marginTop: 10 }}>
            <div className={s.head}>{t("sales.vat.rate")}</div>
            <div className={`${s.head} ${s.num}`}>{t("sales.vat.onPayments")}</div>
            <div className={`${s.head} ${s.num}`}>{t("sales.vat.onInvoices")}</div>
            <div className={`${s.head} ${s.num}`}>{t("sales.vat.baseOnPayments")}</div>
            {[...new Set([...vat.onPayments.byRate.map((r) => r.rate), ...vat.onInvoices.byRate.map((r) => r.rate)])].sort((a, b) => b - a).map((rate) => {
              const p = vat.onPayments.byRate.find((r) => r.rate === rate) || { vat: 0, baseHT: 0 };
              const i = vat.onInvoices.byRate.find((r) => r.rate === rate) || { vat: 0 };
              return [
                <div key={`${rate}r`}>{rate}%</div>,
                <div key={`${rate}p`} className={s.num}>{formatMoney(p.vat, "")}</div>,
                <div key={`${rate}i`} className={s.num}>{formatMoney(i.vat, "")}</div>,
                <div key={`${rate}b`} className={s.num}>{formatMoney(p.baseHT, "")}</div>,
              ];
            })}
            <div><strong>{t("sales.receivables.total")}</strong></div>
            <div className={s.num}><strong>{formatMoney(vat.onPayments.totalVAT)}</strong></div>
            <div className={s.num}><strong>{formatMoney(vat.onInvoices.totalVAT)}</strong></div>
            <div />
          </div>
        )}
      </section>
    </div>
  );
}
