import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Inbox, ShoppingCart, Clock, XCircle, MessageSquare, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import Pagination from "../../components/useful/Pagination";
import { getRequests, processRequest, getOrders } from "../../services/purchasingService";
import { useCompanyPicker, formatDate, PILL } from "./shared";
import styles from "./Purchasing.module.css";

const FILTERS = {
  open: "pending,delayed",
  ordered: "ordered",
  declined: "declined",
  received: "received",
  all: "",
};

/**
 * Demandes d'achat — the purchasing team's queue. Production asks from
 * an inventory article; here the buyer answers each request (ordered,
 * delayed with a reason, declined with a reason, or a note), or
 * selects several and turns them into one purchase order.
 */
export default function PurchaseRequestsQueue() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();

  const [filter, setFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(null);

  // action dialog: { request, action } — action: ordered | delayed | declined | note
  const [dialog, setDialog] = useState(null);
  const [dialogNote, setDialogNote] = useState("");
  const [dialogOrderId, setDialogOrderId] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openOrders, setOpenOrders] = useState([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const { requests: list, pagination: p } = await getRequests({ companyId, status: FILTERS[filter], page, limit: 20 });
      setRequests(list);
      setPagination(p);
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, filter, page, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(new Set()); setPage(1); }, [companyId, filter]);

  const isOpen = (r) => r.status === "pending" || r.status === "delayed";
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const createOrderFromSelection = () => {
    const chosen = requests.filter((r) => selected.has(r._id));
    navigate("/purchasing/orders/new", { state: { companyId, requests: chosen } });
  };

  const openDialog = async (request, action) => {
    setDialog({ request, action });
    setDialogNote(action === "note" ? (request.purchasingNote || "") : "");
    setDialogOrderId("");
    setDialogError("");
    if (action === "ordered") {
      try {
        const { orders } = await getOrders({ companyId, status: "draft,sent,partially_received", limit: 50 });
        setOpenOrders(orders);
      } catch { setOpenOrders([]); }
    }
  };

  const submitDialog = async () => {
    setSaving(true);
    setDialogError("");
    try {
      await processRequest(dialog.request._id, { action: dialog.action, note: dialogNote, purchaseOrderId: dialogOrderId || undefined });
      setDialog(null);
      await load();
    } catch (err) {
      setDialogError(err.response?.data?.message || t("purchasing.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const name = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "—");
  const statusLabel = (s) => t(`purchasing.requestStatus.${{ approved: "ordered", rejected: "declined" }[s] || s}`);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing") }, { label: t("purchasing.requests.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Inbox size={20} /><h1>{t("purchasing.requests.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.requests.subtitle")}</p>
        </div>
        {selected.size > 0 && (
          <button type="button" className="btnPrimary" onClick={createOrderFromSelection}>
            <ShoppingCart size={15} /> {t("purchasing.requests.createOrder").replace("{count}", selected.size)}
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <div className={styles.tabs}>
          {Object.keys(FILTERS).map((key) => (
            <button key={key} type="button" className={filter === key ? styles.tabActive : styles.tab} onClick={() => setFilter(key)}>
              {t(`purchasing.requests.filters.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {loading && <p className={styles.muted}>{t("common.loading")}</p>}
      {!loading && requests.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><Inbox size={28} /></div><h2>{t("purchasing.requests.empty")}</h2></div>
      )}

      {!loading && requests.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: "32px 90px 1.6fr 0.8fr 1fr 0.9fr 1.6fr 170px" }}>
            <span />
            <span>{t("purchasing.columns.date")}</span>
            <span>{t("purchasing.columns.article")}</span>
            <span>{t("purchasing.columns.quantity")}</span>
            <span>{t("purchasing.columns.requestedBy")}</span>
            <span>{t("purchasing.columns.status")}</span>
            <span>{t("purchasing.columns.note")}</span>
            <span />
          </div>
          {requests.map((r) => (
            <div key={r._id}>
              <div className="dataTableRow" style={{ gridTemplateColumns: "32px 90px 1.6fr 0.8fr 1fr 0.9fr 1.6fr 170px" }}>
                <span>
                  {isOpen(r) && (
                    <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggle(r._id)} aria-label={t("purchasing.requests.select")} />
                  )}
                </span>
                <span className="dataTableCellMuted">{formatDate(r.createdAt)}</span>
                <span className={styles.articleCell}>
                  <button type="button" className={styles.expandBtn} onClick={() => setExpanded(expanded === r._id ? null : r._id)}>
                    {expanded === r._id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span>
                    <strong>{r.product?.name || "—"}</strong>
                    {r.product && (
                      <small className={r.product.quantity <= r.product.threshold ? styles.lowStock : styles.muted}>
                        {t("purchasing.requests.stock")}: {r.product.quantity} {r.product.unit || ""} · {t("purchasing.requests.threshold")}: {r.product.threshold}
                      </small>
                    )}
                  </span>
                </span>
                <span><strong>{r.requestedQuantity}</strong> {r.product?.unit || ""}</span>
                <span className="dataTableCellMuted">{name(r.requestedBy)}</span>
                <span>
                  <StatusPill status={PILL[r.status]} label={statusLabel(r.status)} />
                  {r.purchaseOrder && (
                    <Link className={styles.orderLink} to={`/purchasing/orders/${r.purchaseOrder._id}`}>{r.purchaseOrder.number}</Link>
                  )}
                </span>
                <span className={styles.noteCell}>{r.declineReason || r.purchasingNote || r.notes || "—"}</span>
                <span className="dataTableActions">
                  {isOpen(r) && (
                    <>
                      <button type="button" className="tableActionBtn tableActionBtnAccept" title={t("purchasing.requests.actions.ordered")} onClick={() => openDialog(r, "ordered")}>
                        <CheckCircle2 size={14} />
                      </button>
                      <button type="button" className="tableActionBtn" title={t("purchasing.requests.actions.delayed")} onClick={() => openDialog(r, "delayed")}>
                        <Clock size={14} />
                      </button>
                      <button type="button" className="tableActionBtn tableActionBtnReject" title={t("purchasing.requests.actions.declined")} onClick={() => openDialog(r, "declined")}>
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                  <button type="button" className="tableActionBtn" title={t("purchasing.requests.actions.note")} onClick={() => openDialog(r, "note")}>
                    <MessageSquare size={14} />
                  </button>
                </span>
              </div>
              {expanded === r._id && (
                <div className={styles.timeline}>
                  {r.notes && <p className={styles.muted}><strong>{t("purchasing.requests.productionNote")}:</strong> {r.notes}</p>}
                  {(r.history || []).map((h, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className={styles.timelineItem}>
                      <span className={styles.timelineDate}>{new Date(h.at).toLocaleString("fr-FR")}</span>
                      <StatusPill status={PILL[h.status]} label={statusLabel(h.status)} />
                      <span className={styles.muted}>{name(h.by)}</span>
                      {h.note && <span>— {h.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
      )}

      {dialog && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3>{t(`purchasing.requests.dialog.${dialog.action}Title`)}</h3>
            <p className={styles.muted}>{dialog.request.requestedQuantity} × {dialog.request.product?.name}</p>
            {dialog.action === "ordered" && (
              <label className={styles.field}>
                <span>{t("purchasing.requests.dialog.linkOrder")}</span>
                <CustomSelect value={dialogOrderId} onSelect={setDialogOrderId}
                  options={[{ value: "", label: t("purchasing.requests.dialog.noOrder") },
                    ...openOrders.map((o) => ({ value: o._id, label: `${o.number} — ${o.supplier?.name || ""}` }))]} />
              </label>
            )}
            <label className={styles.field}>
              <span>
                {t(`purchasing.requests.dialog.${dialog.action}Label`)}
                {(dialog.action === "declined" || dialog.action === "delayed" || dialog.action === "note") && " *"}
              </span>
              <textarea className={styles.input} rows={3} value={dialogNote} onChange={(e) => setDialogNote(e.target.value)}
                placeholder={t(`purchasing.requests.dialog.${dialog.action}Placeholder`)} />
            </label>
            <p className={styles.muted}>{t("purchasing.requests.dialog.notifyHint")}</p>
            {dialogError && <div className="errorMessage">{dialogError}</div>}
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setDialog(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={saving} onClick={submitDialog}>
                {saving ? t("common.loading") : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
