import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Paperclip } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import { getSupplierInvoices, getSuppliers } from "../../services/purchasingService";
import { useCompanyPicker, formatMoney, formatDate, PILL } from "./shared";
import styles from "./Purchasing.module.css";
import d from "./PurchaseOrderDetail.module.css";

const FILTERS = ["unpaid", "overdue", "all"];
const COLUMNS = "110px 1.2fr 1fr 120px 1fr 1fr 1fr 1.3fr";

/**
 * Factures fournisseurs — the échéancier: every supplier invoice across
 * all purchase orders, sorted by due date, with what's left to pay,
 * what's overdue, and payment terms beyond the legal limits flagged
 * (Loi 69-21: 60 days by default, 120 max by written agreement).
 */
export default function SupplierInvoices() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();

  const [filter, setFilter] = useState("unpaid");
  const [supplier, setSupplier] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (companyId) getSuppliers(companyId).then(setSuppliers).catch(() => setSuppliers([]));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getSupplierInvoices({ companyId, filter, supplier });
      setRows(data.rows);
      setTotals(data.totals);
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, filter, supplier, t]);
  useEffect(() => { load(); }, [load]);

  const statusPill = (r) => (r.overdue
    ? <StatusPill status="rejected" label={t("purchasing.invoiceStatus.overdue").replace("{days}", r.daysOverdue)} />
    : <StatusPill status={PILL[r.status]} label={t(`purchasing.paymentStatus.${r.status}`)} />);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.supplierInvoices.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Receipt size={20} /><h1>{t("purchasing.supplierInvoices.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.supplierInvoices.subtitle")}</p>
        </div>
      </div>

      <div className={d.kpis}>
        <div className={d.kpi}>
          <span className={d.kpiLabel}>{t("purchasing.summary.remaining")}</span>
          <strong className={d.kpiValue}>{formatMoney(totals.remaining || 0)}</strong>
        </div>
        <div className={d.kpi}>
          <span className={d.kpiLabel}>{t("purchasing.supplierInvoices.overdue")}</span>
          <strong className={d.kpiValue} style={{ color: totals.overdue ? "#f87171" : undefined }}>{formatMoney(totals.overdue || 0)}</strong>
          <span className={d.kpiSub}>{t("purchasing.supplierInvoices.overdueCount").replace("{count}", totals.overdueCount || 0)}</span>
        </div>
        <div className={d.kpi}>
          <span className={d.kpiLabel}>{t("purchasing.supplierInvoices.dueIn30")}</span>
          <strong className={d.kpiValue}>{formatMoney(totals.dueIn30 || 0)}</strong>
        </div>
      </div>

      <div className={styles.toolbar} style={{ marginTop: 16 }}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <div className="filterGroup">
          <label>{t("purchasing.columns.supplier")}</label>
          <CustomSelect value={supplier} onSelect={setSupplier}
            options={[{ value: "", label: t("purchasing.filters.all") }, ...suppliers.map((s) => ({ value: s._id, label: s.name }))]} />
        </div>
        <div className={styles.tabs}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className={filter === f ? styles.tabActive : styles.tab} onClick={() => setFilter(f)}>
              {t(`purchasing.supplierInvoices.filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {loading && <p className={styles.muted}>{t("common.loading")}</p>}
      {!loading && rows.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><Receipt size={28} /></div><h2>{t("purchasing.supplierInvoices.empty")}</h2></div>
      )}

      {!loading && rows.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: COLUMNS }}>
            <span>{t("purchasing.detail.dueDate")}</span>
            <span>{t("purchasing.columns.supplier")}</span>
            <span>{t("purchasing.detail.invoiceNumber")}</span>
            <span>{t("purchasing.columns.number")}</span>
            <span>{t("purchasing.detail.amountTTC")}</span>
            <span>{t("purchasing.columns.paid")}</span>
            <span>{t("purchasing.summary.remaining")}</span>
            <span>{t("purchasing.columns.status")}</span>
          </div>
          {rows.map((r) => (
            <div key={r.invoiceId} className={`dataTableRow ${styles.clickableRow}`} style={{ gridTemplateColumns: COLUMNS }}
              role="button" tabIndex={0} onClick={() => navigate(`/purchasing/orders/${r.orderId}`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/purchasing/orders/${r.orderId}`)}>
              <span className={r.overdue ? styles.amountDue : ""}>
                {formatDate(r.dueDate)}
                {(r.legal === "needs_agreement" || r.legal === "over_max") && (
                  <span className={`${d.badge} ${r.legal === "over_max" ? d.badgeBad : d.badgeWarn}`} title={t(`purchasing.legal.${r.legal}Hint`)}>{r.termDays} j</span>
                )}
              </span>
              <span><strong>{r.supplier?.name || "—"}</strong></span>
              <span>
                {r.number}
                {r.file?.url && (
                  <a className={styles.fileLink} href={r.file.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <Paperclip size={12} />
                  </a>
                )}
                <small className={styles.muted}> {formatDate(r.date)}</small>
              </span>
              <span className={styles.orderLink}>{r.orderNumber}</span>
              <span>{formatMoney(r.amount)}</span>
              <span className="dataTableCellMuted">{formatMoney(r.paid)}</span>
              <span><strong className={r.remaining > 0 ? styles.amountDue : ""}>{formatMoney(r.remaining)}</strong></span>
              <span>{statusPill(r)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
