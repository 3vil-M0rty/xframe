import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import Pagination from "../../components/useful/Pagination";
import { getOrders, getOrderSummary, getSuppliers } from "../../services/purchasingService";
import { useCompanyPicker, formatMoney, formatDate, PILL } from "./shared";
import styles from "./Purchasing.module.css";

const STATUSES = ["draft", "pending_approval", "sent", "partially_received", "received", "cancelled"];
const PAYMENT = ["unpaid", "partially_paid", "paid"];

/** Bons de commande: the recap (figures) and the filterable list. */
export default function PurchaseOrders() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();

  const [suppliers, setSuppliers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", paymentStatus: "", supplier: "", search: "", from: "", to: "" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!companyId) return;
    getSuppliers(companyId).then(setSuppliers).catch(() => setSuppliers([]));
    getOrderSummary(companyId).then(setSummary).catch(() => setSummary(null));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      // "late" isn't a stored status: ordered, not delivered, expected date passed
      const params = filters.status === "late" ? { ...filters, status: "", late: "true" } : filters;
      const { orders: list, pagination: p } = await getOrders({ companyId, ...params, page, limit: 20 });
      setOrders(list);
      setPagination(p);
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, filters, page, t]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };

  const progress = (o) => {
    const ordered = o.lines.reduce((s, l) => s + (l.quantity || 0), 0);
    const kept = o.lines.reduce((s, l) => s + (l.receivedQuantity || 0) - (l.returnedQuantity || 0), 0);
    return ordered ? Math.min(Math.round((kept / ordered) * 100), 100) : 0;
  };

  const columns = "120px 90px 1.4fr 1fr 110px 110px 1fr 110px";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.orders.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><FileText size={20} /><h1>{t("purchasing.orders.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.orders.subtitle")}</p>
        </div>
        {companyId && (
          <button type="button" className="btnPrimary" onClick={() => navigate("/purchasing/orders/new", { state: { companyId } })}>
            <Plus size={15} /> {t("purchasing.orders.new")}
          </button>
        )}
      </div>

      {summary && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span>{t("purchasing.summary.totalOrdered")}</span><strong>{formatMoney(summary.totalOrdered)}</strong></div>
          <div className={styles.summaryCard}><span>{t("purchasing.summary.totalPaid")}</span><strong>{formatMoney(summary.totalPaid)}</strong></div>
          <div className={styles.summaryCard}><span>{t("purchasing.summary.remaining")}</span><strong className={summary.remainingToPay > 0 ? styles.amountDue : ""}>{formatMoney(summary.remainingToPay)}</strong></div>
          <div className={styles.summaryCard}><span>{t("purchasing.summary.overdue")}</span><strong className={summary.overdueOrders ? styles.amountDue : ""}>{summary.overdueOrders}</strong></div>
          <div className={styles.summaryCard}>
            <span>{t("purchasing.summary.byStatus")}</span>
            <div className={styles.statusCounts}>
              {STATUSES.filter((s) => summary.byStatus?.[s]).map((s) => (
                <span key={s}>{t(`purchasing.orderStatus.${s}`)}: <strong>{summary.byStatus[s]}</strong></span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <div className="filterGroup">
          <label>{t("purchasing.columns.status")}</label>
          <CustomSelect value={filters.status} onSelect={(v) => setFilter("status", v)}
            options={[{ value: "", label: t("purchasing.filters.all") }, ...STATUSES.map((s) => ({ value: s, label: t(`purchasing.orderStatus.${s}`) })),
              { value: "late", label: t("purchasing.filters.late") }]} />
        </div>
        <div className="filterGroup">
          <label>{t("purchasing.columns.payment")}</label>
          <CustomSelect value={filters.paymentStatus} onSelect={(v) => setFilter("paymentStatus", v)}
            options={[{ value: "", label: t("purchasing.filters.all") }, ...PAYMENT.map((s) => ({ value: s, label: t(`purchasing.paymentStatus.${s}`) }))]} />
        </div>
        <div className="filterGroup">
          <label>{t("purchasing.columns.supplier")}</label>
          <CustomSelect value={filters.supplier} onSelect={(v) => setFilter("supplier", v)}
            options={[{ value: "", label: t("purchasing.filters.all") }, ...suppliers.map((s) => ({ value: s._id, label: s.name }))]} />
        </div>
        <div className="filterGroup">
          <label>{t("purchasing.filters.number")}</label>
          <input className={styles.input} value={filters.search} placeholder="BC-2026-…" onChange={(e) => setFilter("search", e.target.value)} />
        </div>
        <div className="filterGroup">
          <label>{t("common.dateFrom")}</label>
          <input type="date" className={styles.input} value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
        </div>
        <div className="filterGroup">
          <label>{t("common.dateTo")}</label>
          <input type="date" className={styles.input} value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {loading && <p className={styles.muted}>{t("common.loading")}</p>}
      {!loading && orders.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><FileText size={28} /></div><h2>{t("purchasing.orders.empty")}</h2></div>
      )}

      {!loading && orders.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: columns }}>
            <span>{t("purchasing.columns.number")}</span>
            <span>{t("purchasing.columns.date")}</span>
            <span>{t("purchasing.columns.supplier")}</span>
            <span>{t("purchasing.columns.status")}</span>
            <span>{t("purchasing.totals.ttc")}</span>
            <span>{t("purchasing.columns.paid")}</span>
            <span>{t("purchasing.columns.payment")}</span>
            <span>{t("purchasing.columns.received")}</span>
          </div>
          {orders.map((o) => (
            <div key={o._id} className={`dataTableRow ${styles.clickableRow}`} style={{ gridTemplateColumns: columns }}
              role="button" tabIndex={0} onClick={() => navigate(`/purchasing/orders/${o._id}`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/purchasing/orders/${o._id}`)}>
              <span><strong>{o.number}</strong></span>
              <span className="dataTableCellMuted">{formatDate(o.date)}</span>
              <span>{o.supplier?.name || "—"}</span>
              <span><StatusPill status={PILL[o.status]} label={t(`purchasing.orderStatus.${o.status}`)} /></span>
              <span>{formatMoney(o.totalTTC)}</span>
              <span className="dataTableCellMuted">{formatMoney(o.amountPaid)}</span>
              <span><StatusPill status={PILL[o.paymentStatus]} label={t(`purchasing.paymentStatus.${o.paymentStatus}`)} /></span>
              <span className={styles.progressCell}>
                <span className={styles.progressBar}><span style={{ width: `${progress(o)}%` }} /></span>
                <small>{progress(o)}%</small>
              </span>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
      )}
    </div>
  );
}
