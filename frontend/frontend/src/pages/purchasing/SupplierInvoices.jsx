import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Wallet } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import { getSupplierInvoices, getSuppliers, createSupplierPayment } from "../../services/purchasingService";
import { useCompanyPicker, formatMoney, formatDate, todayInput, PILL, PAYMENT_METHODS } from "./shared";
import styles from "./Purchasing.module.css";
import d from "./PurchaseOrderDetail.module.css";
import FileLink from "../../components/useful/FileLink";

const FILTERS = ["unpaid", "overdue", "all"];
const COLUMNS = "32px 110px 1.2fr 1fr 120px 1fr 1fr 1fr 1.3fr";

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
  const [notice, setNotice] = useState("");
  // settling several invoices of one supplier with one payment
  const [selected, setSelected] = useState({}); // invoiceId -> row
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ date: todayInput(), method: "virement", reference: "", amounts: {} });
  const [saving, setSaving] = useState(false);

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
  useEffect(() => { setSelected({}); }, [companyId, supplier, filter]);

  const toggle = (row) => setSelected((prev) => {
    const next = { ...prev };
    if (next[row.invoiceId]) delete next[row.invoiceId]; else next[row.invoiceId] = row;
    return next;
  });
  const chosen = Object.values(selected);
  const openPay = () => {
    setPayForm({ date: todayInput(), method: "virement", reference: "", amounts: Object.fromEntries(chosen.map((r) => [r.invoiceId, r.remaining])) });
    setPayOpen(true);
  };
  const payTotal = Math.round(chosen.reduce((sum, r) => sum + (Number(payForm.amounts[r.invoiceId]) || 0), 0) * 100) / 100;
  const submitPay = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await createSupplierPayment({
        company: companyId, supplier, date: payForm.date, method: payForm.method, reference: payForm.reference,
        allocations: chosen.map((r) => ({ orderId: r.orderId, invoiceId: r.invoiceId, amount: Number(payForm.amounts[r.invoiceId]) })),
      });
      setPayOpen(false);
      setSelected({});
      setNotice(t("purchasing.supplierPayment.done").replace("{amount}", formatMoney(result.total)).replace("{count}", result.invoices).replace("{ref}", result.batchRef));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.save"));
    } finally {
      setSaving(false);
    }
  };

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
      {notice && <div className={styles.infoBanner}>{notice}</div>}
      {!supplier && rows.some((r) => r.status !== "paid") && <p className={styles.muted}>{t("purchasing.supplierPayment.pickSupplierHint")}</p>}
      {chosen.length > 0 && (
        <div className={styles.infoBanner} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span>{t("purchasing.supplierPayment.selection").replace("{count}", chosen.length).replace("{amount}", formatMoney(chosen.reduce((sum, r) => sum + r.remaining, 0)))}</span>
          <button type="button" className="btnPrimary" onClick={openPay}><Wallet size={14} /> {t("purchasing.supplierPayment.settle")}</button>
        </div>
      )}
      {loading && <p className={styles.muted}>{t("common.loading")}</p>}
      {!loading && rows.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><Receipt size={28} /></div><h2>{t("purchasing.supplierInvoices.empty")}</h2></div>
      )}

      {!loading && rows.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: COLUMNS }}>
            <span />
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
              <span>
                {/* one supplier at a time: pick the supplier filter first */}
                {supplier && r.status !== "paid" && (
                  <input type="checkbox" checked={!!selected[r.invoiceId]} aria-label={t("purchasing.requests.select")}
                    onClick={(e) => e.stopPropagation()} onChange={() => toggle(r)} />
                )}
              </span>
              <span className={r.overdue ? styles.amountDue : ""}>
                {formatDate(r.dueDate)}
                {(r.legal === "needs_agreement" || r.legal === "over_max") && (
                  <span className={`${d.badge} ${r.legal === "over_max" ? d.badgeBad : d.badgeWarn}`} title={t(`purchasing.legal.${r.legal}Hint`)}>{r.termDays} j</span>
                )}
              </span>
              <span><strong>{r.supplier?.name || "—"}</strong></span>
              <span>
                {r.number}
                <FileLink kind="order-invoice" id={r.orderId} sub={r.invoiceId} file={r.file} className={styles.fileLink} iconSize={12}>{" "}</FileLink>
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

      {payOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 620 }}>
            <h3><Wallet size={16} /> {t("purchasing.supplierPayment.title").replace("{supplier}", chosen[0]?.supplier?.name || "")}</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>{t("purchasing.columns.date")} *</span>
                <input type="date" className={styles.input} value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></label>
              <label className={styles.field}><span>{t("purchasing.detail.method")} *</span>
                <CustomSelect value={payForm.method} onSelect={(v) => setPayForm({ ...payForm, method: v })}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`purchasing.paymentMethods.${m}`) }))} /></label>
              <label className={styles.field}><span>{t("purchasing.detail.paymentReference")}</span>
                <input className={styles.input} value={payForm.reference} placeholder={t("purchasing.detail.paymentReferencePlaceholder")}
                  onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></label>
            </div>
            <div className="dataTable" style={{ margin: "8px 0" }}>
              {chosen.map((r) => (
                <div key={r.invoiceId} className="dataTableRow" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 130px" }}>
                  <span><strong>{r.number}</strong> <small className={styles.muted}>{r.orderNumber}</small></span>
                  <span className="dataTableCellMuted">{formatDate(r.dueDate)}</span>
                  <span className="dataTableCellMuted">{t("purchasing.summary.remaining")} : {formatMoney(r.remaining)}</span>
                  <input type="number" min="0" step="any" className={styles.input} value={payForm.amounts[r.invoiceId] ?? ""}
                    onChange={(e) => setPayForm({ ...payForm, amounts: { ...payForm.amounts, [r.invoiceId]: e.target.value } })} />
                </div>
              ))}
            </div>
            <p><strong>{t("purchasing.supplierPayment.total")} : {formatMoney(payTotal)}</strong></p>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setPayOpen(false)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={saving || payTotal <= 0} onClick={submitPay}>{t("purchasing.supplierPayment.confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
