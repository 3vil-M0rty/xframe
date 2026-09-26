import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, FileText, Send, Pencil, Ban, Trash2, PackageCheck, Undo2, Receipt, Wallet, Paperclip, FileDown,
  CheckCircle2, AlertTriangle, RotateCcw, Lock, Inbox, Mail, ShieldCheck, XCircle,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import StatusPill from "../../components/useful/StatusPill";
import CustomSelect from "../../components/useful/CustomSelect";
import {
  getOrder, setOrderStatus, deleteOrder, addReception, addInvoice, deleteInvoice, addPayment, deletePayment,
  addLineToInventory, downloadOrderPdf, closeOrderLine, reopenOrderLine,
  approveOrder, refuseOrderApproval, setOrderStatusWithMessage, emailOrder,
} from "../../services/purchasingService";
import { getInventoryCategories } from "../../services/inventoryCategoryService";
import { formatMoney, formatDate, todayInput, PILL, PAYMENT_METHODS, lineOutstanding } from "./shared";
import styles from "./Purchasing.module.css";
import d from "./PurchaseOrderDetail.module.css";
import FileLink from "../../components/useful/FileLink";

const net = (l) => (l.receivedQuantity || 0) - (l.returnedQuantity || 0);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const VAT_RATES = [20, 14, 10, 7, 0];

/**
 * VAT lines to pre-fill an invoice / credit note, one per rate, from
 * the order: goods kept (or ordered if nothing arrived yet) for an
 * invoice — scaled to what's still to invoice — or goods returned for
 * a credit note. The user then matches them to the supplier's paper.
 */
function suggestedVatLines(order, type, targetTTC) {
  const byRate = new Map();
  for (const l of order.lines) {
    const kept = (l.receivedQuantity || 0) - (l.returnedQuantity || 0);
    const qty = type === "credit_note" ? (l.returnedQuantity || 0) : (kept > 0 ? kept : l.quantity);
    const ht = qty * (l.unitPrice || 0);
    if (ht > 0) byRate.set(l.vatRate ?? 20, (byRate.get(l.vatRate ?? 20) || 0) + ht);
  }
  let rows = [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, ht]) => ({ rate, baseHT: r2(ht), vat: r2(ht * rate / 100) }));
  const fullTTC = rows.reduce((s, x) => s + x.baseHT + x.vat, 0);
  if (targetTTC > 0 && fullTTC > 0 && Math.abs(fullTTC - targetTTC) > 0.01) {
    const k = targetTTC / fullTTC;
    rows = rows.map((x) => ({ rate: x.rate, baseHT: r2(x.baseHT * k), vat: r2(x.vat * k) }));
  }
  return rows.length ? rows : [{ rate: 20, baseHT: "", vat: "" }];
}

// "YYYY-MM-DD" + n days, in local time (no UTC shift)
const addDays = (ymd, days) => {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const pct = (part, total) => (total > 0 ? Math.max(0, Math.min(Math.round((part / total) * 100), 100)) : 0);

/** A section card: title with count, action on the right, content below. */
function Section({ icon, title, count, action, children }) {
  return (
    <section className={d.card}>
      <header className={d.cardHeader}>
        <h2>{icon}{title}{count !== undefined && <span className={d.count}>{count}</span>}</h2>
        {action}
      </header>
      <div className={d.cardBody}>{children}</div>
    </section>
  );
}

function Empty({ icon, text }) {
  return <div className={d.empty}>{icon}<span>{text}</span></div>;
}

export default function PurchaseOrderDetail() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();

  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // approval + email dialogs
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", message: "" });

  // reception / return form
  const [receiving, setReceiving] = useState(null);
  const [recRef, setRecRef] = useState("");
  const [recDate, setRecDate] = useState(todayInput());
  const [recNotes, setRecNotes] = useState("");
  const [recFile, setRecFile] = useState(null);
  const [recQty, setRecQty] = useState({});

  // invoice / payment forms
  const [showInvoice, setShowInvoice] = useState(false);
  const [inv, setInv] = useState({ type: "invoice", number: "", date: todayInput(), dueDate: "", amountTTC: "", file: null });
  const [dueAuto, setDueAuto] = useState(true); // due date follows the invoice date until edited by hand
  const [showPayment, setShowPayment] = useState(false);
  const [pay, setPay] = useState({ date: todayInput(), amount: "", method: "virement", reference: "", invoiceId: "" });

  // dialogs
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [closingLine, setClosingLine] = useState(null);
  const [closeReason, setCloseReason] = useState("");
  const [articleLine, setArticleLine] = useState(null);
  const [articleForm, setArticleForm] = useState({ category: "", internalReference: "", unit: "", threshold: "" });
  const [categories, setCategories] = useState([]);

  const load = useCallback(async () => {
    try {
      setOrder(await getOrder(id));
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const updated = await fn();
      if (updated?._id) setOrder(updated);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.save"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!order) {
    return <div className="pageShell">{error ? <div className="errorMessage">{error}</div> : <p className={styles.muted}>{t("common.loading")}</p>}</div>;
  }

  // Shown to admins, owners and department managers; the backend makes
  // the real decision (purchasing department manager only, not one's own order).
  const canApprove = user?.role === "admin" || user?.role === "owner" || (user?.managedDepartments?.length || 0) > 0;
  const supplierHasDays = Number.isFinite(order.supplier?.paymentDays);
  const paymentDays = supplierHasDays ? order.supplier.paymentDays : 60; // Loi 69-21 default
  const match = order.analysis?.match || {};
  const invoiceState = new Map((order.analysis?.invoices || []).map((r) => [String(r.invoice), r]));
  const canReceive = ["sent", "partially_received", "received"].includes(order.status);
  const editable = ["draft", "sent"].includes(order.status) && order.receptions.length === 0;
  const amountDue = order.amountDue ?? Math.max(order.totalTTC - order.amountPaid, 0);
  const toInvoice = Math.max((match.receivedTTC || 0) - (match.invoicedNetTTC || 0), 0);

  const name = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "");
  const lineLabel = (lineId) => order.lines.find((l) => String(l._id) === String(lineId))?.description || "—";
  // Private files: opened through a short-lived link (FileLink).
  const fileLink = (kind, entry) => (
    <FileLink kind={kind} id={order._id} sub={entry._id} file={entry.file} className={styles.fileLink}>
      {entry.file?.originalName || t("purchasing.detail.file")}
    </FileLink>
  );

  // ---------- actions ----------
  const openReceiving = (type) => {
    setReceiving(type);
    setRecRef(""); setRecDate(todayInput()); setRecNotes(""); setRecFile(null);
    setRecQty(Object.fromEntries(order.lines.map((l) => [l._id, type === "reception" ? lineOutstanding(l) : 0])));
  };
  const submitReception = async () => {
    const lines = Object.entries(recQty).filter(([, q]) => Number(q) > 0).map(([lineId, quantity]) => ({ lineId, quantity: Number(quantity) }));
    if (await run(() => addReception(order._id, { type: receiving, reference: recRef, date: recDate, notes: recNotes, lines, file: recFile }))) setReceiving(null);
  };
  const openInvoiceForm = (type) => {
    const suggested = type === "credit_note" ? match.creditExpected : (toInvoice || order.totalTTC);
    const date = todayInput();
    setInv({ type, number: "", date, dueDate: type === "invoice" ? addDays(date, paymentDays) : "", file: null,
      vatLines: suggestedVatLines(order, type, suggested ? r2(suggested) : 0) });
    setDueAuto(true);
    setShowInvoice(true);
  };
  const setInvoiceDate = (date) => setInv((prev) => ({ ...prev, date, dueDate: dueAuto && prev.type === "invoice" ? addDays(date, paymentDays) : prev.dueDate }));
  const submitInvoice = async () => {
    const vatBreakdown = (inv.vatLines || [])
      .map((x) => ({ rate: Number(x.rate), baseHT: r2(x.baseHT), vat: r2(x.vat) }))
      .filter((x) => x.baseHT || x.vat);
    const payload = { ...inv, vatBreakdown, amountTTC: r2(vatBreakdown.reduce((sum, x) => sum + x.baseHT + x.vat, 0)) };
    const saved = { ...payload };
    if (await run(() => addInvoice(order._id, payload))) {
      setShowInvoice(false);
      if (saved.type === "invoice") {
        setNotice(t("purchasing.dueDate.savedNotice").replace("{number}", saved.number).replace("{date}", formatDate(saved.dueDate))
          + (supplierHasDays ? "" : ` ${t("purchasing.dueDate.savedNoTerms")}`));
      }
    }
  };
  const submitPayment = async () => {
    if (await run(() => addPayment(order._id, { ...pay, amount: Number(pay.amount) }))) {
      setShowPayment(false);
      setPay({ date: todayInput(), amount: "", method: "virement", reference: "", invoiceId: "" });
    }
  };
  const openAddToInventory = async (line) => {
    setArticleLine(line);
    setArticleForm({ category: "", internalReference: "", unit: line.unit || "", threshold: "" });
    try {
      const list = await getInventoryCategories(order.company?._id || order.company);
      setCategories(Array.isArray(list) ? list : []);
    } catch { setCategories([]); }
  };

  const invoiceStatusPill = (row) => {
    if (!row) return null;
    if (row.overdue) return <StatusPill status="rejected" label={t("purchasing.invoiceStatus.overdue").replace("{days}", row.daysOverdue)} />;
    return <StatusPill status={PILL[row.status]} label={t(`purchasing.paymentStatus.${row.status}`)} />;
  };

  const matchBadge = {
    not_invoiced: { cls: d.badgeNeutral, text: t("purchasing.match.notInvoiced") },
    matched: { cls: d.badgeOk, text: t("purchasing.match.matched") },
    partially_invoiced: { cls: d.badgeWarn, text: t("purchasing.match.toInvoice").replace("{amount}", formatMoney(-match.gap)) },
    over_invoiced: { cls: d.badgeBad, text: t("purchasing.match.overInvoiced").replace("{amount}", formatMoney(match.gap)) },
  }[match.status || "not_invoiced"];

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.orders.title"), href: "/purchasing/orders" }, { label: order.number }]} />
      <button type="button" className="btnBack" onClick={() => navigate("/purchasing/orders")}><ArrowLeft size={16} /> {t("common.back")}</button>

      {/* ---------- header ---------- */}
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <FileText size={20} /><h1>{order.number}</h1>
            <StatusPill status={PILL[order.status]} label={t(`purchasing.orderStatus.${order.status}`)} />
            <StatusPill status={PILL[order.paymentStatus]} label={t(`purchasing.paymentStatus.${order.paymentStatus}`)} />
          </div>
          <p className="pageSubtitle">
            <strong>{order.supplier?.name}</strong> · {formatDate(order.date)}
            {order.expectedDate && ` · ${t("purchasing.orders.form.expectedDate")} : ${formatDate(order.expectedDate)}`}
            {order.supplier?.paymentTerms && ` · ${order.supplier.paymentTerms}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className="btnEdit" disabled={busy} onClick={() => run(() => downloadOrderPdf(order))}>
            <FileDown size={14} /> {t("purchasing.pdf.download")}
          </button>
          {order.status === "draft" && (
            <button type="button" className="btnPrimary" disabled={busy} onClick={() => run(async () => {
              const { order: updated, message } = await setOrderStatusWithMessage(order._id, "sent");
              setNotice(message === "approval_requested" ? t("purchasing.approval.requested") : "");
              return updated;
            })}>
              <Send size={14} /> {t("purchasing.detail.markSent")}
            </button>
          )}
          {["sent", "partially_received", "received"].includes(order.status) && (
            <button type="button" className="btnEdit" disabled={busy}
              onClick={() => { setEmailForm({ to: order.supplier?.email || "", cc: "", message: "" }); setEmailOpen(true); }}>
              <Mail size={14} /> {t("purchasing.email.send")}
            </button>
          )}
          {order.status === "pending_approval" && canApprove && (
            <>
              <button type="button" className="btnPrimary" disabled={busy} onClick={() => run(async () => {
                const updated = await approveOrder(order._id);
                setNotice(t("purchasing.approval.approvedNotice"));
                return updated;
              })}>
                <ShieldCheck size={14} /> {t("purchasing.approval.approve")}
              </button>
              <button type="button" className="btnCancel" disabled={busy} onClick={() => { setRefuseReason(""); setRefuseOpen(true); }}>
                <XCircle size={14} /> {t("purchasing.approval.refuse")}
              </button>
            </>
          )}
          {editable && <button type="button" className="btnEdit" onClick={() => navigate(`/purchasing/orders/${order._id}/edit`)}><Pencil size={14} /> {t("common.edit")}</button>}
          {(editable || order.status === "pending_approval") && <button type="button" className="btnCancel" onClick={() => { setCancelReason(""); setCancelOpen(true); }}><Ban size={14} /> {t("purchasing.detail.cancelOrder")}</button>}
          {order.status === "draft" && (
            <button type="button" className="btnDelete" disabled={busy}
              onClick={async () => { if (window.confirm(t("purchasing.detail.deleteConfirm"))) { try { await deleteOrder(order._id); navigate("/purchasing/orders"); } catch (err) { setError(err.response?.data?.message || t("purchasing.errors.save")); } } }}>
              <Trash2 size={14} /> {t("common.delete")}
            </button>
          )}
        </div>
      </div>

      {order.status === "cancelled" && order.cancelReason && (
        <div className="errorMessage">{t("purchasing.detail.cancelledBecause")} : {order.cancelReason}</div>
      )}
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.infoBanner}>{notice}</div>}
      {order.status === "pending_approval" && (
        <div className={d.alertWarn}>
          <ShieldCheck size={15} />
          {t("purchasing.approval.pendingBanner").replace("{date}", formatDate(order.approval?.requestedAt))}
          {!canApprove && ` ${t("purchasing.approval.waitingForApprover")}`}
        </div>
      )}
      {order.status === "draft" && order.approval?.rejectedAt && (
        <div className={d.alertBad}><XCircle size={15} /> {t("purchasing.approval.refusedBanner").replace("{reason}", order.approval.rejectReason || "—")}</div>
      )}
      {order.approval?.approvedAt && order.status !== "draft" && order.status !== "pending_approval" && (
        <p className={d.muted}><ShieldCheck size={13} /> {t("purchasing.approval.approvedOn").replace("{date}", formatDate(order.approval.approvedAt))}</p>
      )}
      {order.emails?.length > 0 && (
        <p className={d.muted}>
          <Mail size={13} /> {order.emails.slice(-3).map((e) => `${e.to} (${formatDate(e.at)}${e.simulated ? ` — ${t("purchasing.email.simulatedShort")}` : ""})`).join(" · ")}
        </p>
      )}

      {/* ---------- at a glance ---------- */}
      <div className={d.kpis}>
        <div className={d.kpi}>
          <span className={d.kpiLabel}>{t("purchasing.kpi.ordered")}</span>
          <strong className={d.kpiValue}>{formatMoney(order.totalTTC)}</strong>
          <span className={d.kpiSub}>{t("purchasing.totals.ht")} {formatMoney(order.totalHT)} · {t("purchasing.totals.vat")} {formatMoney(order.totalVAT)}</span>
        </div>
        <div className={d.kpi}>
          <span className={d.kpiLabel}>{t("purchasing.kpi.received")}</span>
          <strong className={d.kpiValue}>{formatMoney(match.receivedTTC || 0)}</strong>
          <div className={d.bar}><span style={{ width: `${pct(match.receivedTTC, match.orderedTTC)}%` }} /></div>
          <span className={d.kpiSub}>{pct(match.receivedTTC, match.orderedTTC)}% {t("purchasing.kpi.ofOrder")}</span>
        </div>
        <div className={d.kpi}>
          <span className={d.kpiLabel}>{t("purchasing.kpi.invoiced")}</span>
          <strong className={d.kpiValue}>{formatMoney(match.invoicedNetTTC || 0)}</strong>
          <span className={`${d.badge} ${matchBadge.cls}`}>{matchBadge.text}</span>
        </div>
        <div className={d.kpi}>
          <span className={d.kpiLabel}>{t("purchasing.kpi.paid")}</span>
          <strong className={d.kpiValue}>{formatMoney(order.amountPaid)}</strong>
          <span className={amountDue > 0 ? d.kpiDue : d.kpiSettled}>
            {amountDue > 0 ? `${t("purchasing.summary.remaining")} : ${formatMoney(amountDue)}` : t("purchasing.kpi.settled")}
          </span>
        </div>
      </div>

      {["partially_received", "received"].includes(order.status) && (match.receivedTTC || 0) > 0
        && !order.invoices.some((i) => i.type !== "credit_note") && (
        <div className={d.alertWarn}>
          <Receipt size={15} />
          {t("purchasing.missingInvoice.banner").replace("{amount}", formatMoney(match.receivedTTC))}
          {order.status !== "cancelled" && !showInvoice && (
            <button type="button" className={d.alertAction} onClick={() => openInvoiceForm("invoice")}>{t("purchasing.detail.addInvoice")}</button>
          )}
        </div>
      )}
      {match.creditExpected > 0 && (
        <div className={d.alertWarn}><AlertTriangle size={15} /> {t("purchasing.match.creditExpected").replace("{amount}", formatMoney(match.creditExpected))}</div>
      )}
      {match.status === "over_invoiced" && (
        <div className={d.alertBad}><AlertTriangle size={15} /> {t("purchasing.match.overInvoicedHint").replace("{amount}", formatMoney(match.gap))}</div>
      )}

      {/* ---------- lines ---------- */}
      <Section icon={<FileText size={16} />} title={t("purchasing.detail.lines")} count={order.lines.length}>
        <div className={d.lines}>
          {order.lines.map((l) => {
            const kept = net(l);
            const outstanding = lineOutstanding(l);
            const done = order.status !== "cancelled" && outstanding === 0 && kept > 0;
            return (
              <div key={l._id} className={`${d.line} ${l.closed ? d.lineClosed : ""}`}>
                <div className={d.lineMain}>
                  <div className={d.lineTitle}>
                    <strong>{l.description}</strong>
                    {l.closed && <span className={`${d.badge} ${d.badgeNeutral}`}><Lock size={11} /> {t("purchasing.lines.closed")}</span>}
                    {done && !l.closed && <span className={`${d.badge} ${d.badgeOk}`}><CheckCircle2 size={11} /> {t("purchasing.lines.complete")}</span>}
                  </div>
                  <div className={d.lineMeta}>
                    {l.product?.internalReference && <span>{l.product.internalReference}</span>}
                    <span>{formatMoney(l.unitPrice)} HT × {l.quantity} {l.unit || ""} · {t("purchasing.lines.vat")} {l.vatRate}%</span>
                    <span><strong>{formatMoney(l.quantity * l.unitPrice)}</strong> HT</span>
                    {!l.product && <span className={d.muted}>{t("purchasing.detail.noStock")}</span>}
                    {!l.product && order.status !== "cancelled" && (
                      <button type="button" className={styles.linkButton} onClick={() => openAddToInventory(l)}>{t("purchasing.addToInventory.button")}</button>
                    )}
                  </div>
                  {l.closed && l.closeReason && <div className={d.lineReason}>{t("purchasing.lines.closedBecause")} : {l.closeReason}</div>}
                </div>

                <div className={d.lineProgress}>
                  <div className={d.bar}><span className={l.closed ? d.barClosed : ""} style={{ width: `${pct(kept, l.quantity)}%` }} /></div>
                  <div className={d.lineCounts}>
                    <span><strong>{kept}</strong> / {l.quantity} {t("purchasing.lines.receivedShort")}</span>
                    {l.returnedQuantity > 0 && <span className={d.muted}>{l.returnedQuantity} {t("purchasing.lines.returnedShort")}</span>}
                    {outstanding > 0 && order.status !== "cancelled" && <span className={d.outstanding}>{outstanding} {t("purchasing.lines.expectedShort")}</span>}
                  </div>
                </div>

                <div className={d.lineActions}>
                  {canReceive && !l.closed && outstanding > 0 && (
                    <button type="button" className="btnEdit" disabled={busy} title={t("purchasing.lines.closeHint")}
                      onClick={() => { setClosingLine(l); setCloseReason(""); }}>
                      <Lock size={13} /> {t("purchasing.lines.close")}
                    </button>
                  )}
                  {canReceive && l.closed && (
                    <button type="button" className="btnCancel" disabled={busy} onClick={() => run(() => reopenOrderLine(order._id, l._id))}>
                      <RotateCcw size={13} /> {t("purchasing.lines.reopen")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {order.notes && <p className={d.notes}>{order.notes}</p>}
      </Section>

      {/* ---------- receptions ---------- */}
      <Section
        icon={<PackageCheck size={16} />}
        title={t("purchasing.detail.receptions")}
        count={order.receptions.length}
        action={canReceive && !receiving && (
          <div className={styles.headerActions}>
            {order.status !== "received" && (
              <button type="button" className="btnPrimary" onClick={() => openReceiving("reception")}><PackageCheck size={14} /> {t("purchasing.detail.receive")}</button>
            )}
            {order.lines.some((l) => net(l) > 0) && (
              <button type="button" className="btnEdit" onClick={() => openReceiving("return")}><Undo2 size={14} /> {t("purchasing.detail.returnGoods")}</button>
            )}
          </div>
        )}
      >
        {order.status === "draft" && <p className={d.muted}>{t("purchasing.detail.sendFirst")}</p>}

        {receiving && (
          <div className={styles.panel}>
            <h3>{receiving === "reception" ? t("purchasing.detail.receptionTitle") : t("purchasing.detail.returnTitle")}</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>{receiving === "reception" ? t("purchasing.detail.blNumber") : t("purchasing.detail.returnReference")} *</span>
                <input className={styles.input} value={recRef} onChange={(e) => setRecRef(e.target.value)} placeholder={receiving === "reception" ? "BL-…" : "RET-…"} />
              </label>
              <label className={styles.field}>
                <span>{t("purchasing.columns.date")}</span>
                <input type="date" className={styles.input} value={recDate} onChange={(e) => setRecDate(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>{t("purchasing.detail.scan")}</span>
                <input type="file" accept=".pdf,image/*" className={styles.input} onChange={(e) => setRecFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className={styles.recLines}>
              {order.lines.map((l) => {
                const max = receiving === "reception" ? lineOutstanding(l) : net(l);
                return (
                  <label key={l._id} className={styles.recLine}>
                    <span>{l.description} <small className={styles.muted}>({receiving === "reception" ? t("purchasing.detail.outstanding") : t("purchasing.detail.kept")} : {max})</small></span>
                    <input type="number" min="0" max={max} step="any" className={styles.input} value={recQty[l._id] ?? 0} disabled={max === 0}
                      onChange={(e) => setRecQty((q) => ({ ...q, [l._id]: e.target.value }))} />
                  </label>
                );
              })}
            </div>
            <label className={styles.field}>
              <span>{t("purchasing.columns.note")}</span>
              <input className={styles.input} value={recNotes} onChange={(e) => setRecNotes(e.target.value)} />
            </label>
            <p className={styles.muted}>{receiving === "reception" ? t("purchasing.detail.stockInHint") : t("purchasing.detail.stockOutHint")}</p>
            <div className={styles.formActions}>
              <button type="button" className="btnCancel" onClick={() => setReceiving(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy || !recRef.trim()} onClick={submitReception}>{t("common.confirm")}</button>
            </div>
          </div>
        )}

        {order.receptions.length === 0 ? (
          order.status !== "draft" && <Empty icon={<Inbox size={18} />} text={t("purchasing.detail.noReceptions")} />
        ) : (
          <ol className={d.timeline}>
            {[...order.receptions].reverse().map((r) => (
              <li key={r._id} className={d.timelineItem}>
                <span className={`${d.dot} ${r.type === "return" ? d.dotReturn : ""}`}>{r.type === "return" ? <Undo2 size={12} /> : <PackageCheck size={12} />}</span>
                <div className={d.timelineBody}>
                  <div className={d.timelineHead}>
                    <strong>{t(`purchasing.detail.type.${r.type}`)} · {r.reference}</strong>
                    <span className={d.muted}>{formatDate(r.date)}{name(r.by) && ` · ${name(r.by)}`}</span>
                  </div>
                  <div className={d.chips}>
                    {r.lines.map((x) => <span key={String(x.lineId)} className={d.chip}>{x.quantity} × {lineLabel(x.lineId)}</span>)}
                  </div>
                  {r.notes && <p className={d.muted}>{r.notes}</p>}
                  {fileLink("order-reception", r)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* ---------- invoices & credit notes ---------- */}
      <Section
        icon={<Receipt size={16} />}
        title={t("purchasing.detail.invoices")}
        count={order.invoices.length}
        action={order.status !== "cancelled" && !showInvoice && (
          <div className={styles.headerActions}>
            <button type="button" className="btnEdit" onClick={() => openInvoiceForm("invoice")}>{t("purchasing.detail.addInvoice")}</button>
            <button type="button" className="btnCancel" onClick={() => openInvoiceForm("credit_note")}>{t("purchasing.detail.addCreditNote")}</button>
          </div>
        )}
      >
        {showInvoice && (
          <div className={styles.panel}>
            <h3>{inv.type === "credit_note" ? t("purchasing.detail.addCreditNote") : t("purchasing.detail.addInvoice")}</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>{inv.type === "credit_note" ? t("purchasing.detail.creditNoteNumber") : t("purchasing.detail.invoiceNumber")} *</span>
                <input className={styles.input} value={inv.number} onChange={(e) => setInv({ ...inv, number: e.target.value })} /></label>
              <label className={styles.field}><span>{t("purchasing.columns.date")} *</span>
                <input type="date" className={styles.input} value={inv.date} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
              {inv.type === "invoice" && (
                <label className={styles.field}><span>{t("purchasing.detail.dueDate")}</span>
                  <input type="date" className={styles.input} value={inv.dueDate}
                    onChange={(e) => { setDueAuto(false); setInv({ ...inv, dueDate: e.target.value }); }} />
                  {dueAuto && supplierHasDays && (
                    <small className={d.dueOk}>{t("purchasing.dueDate.fromSupplier").replace("{days}", paymentDays).replace("{supplier}", order.supplier?.name || "")}</small>
                  )}
                  {dueAuto && !supplierHasDays && (
                    <small className={d.dueWarn}>{t("purchasing.dueDate.noSupplierTerms").replace("{supplier}", order.supplier?.name || "")}</small>
                  )}
                  {!dueAuto && <small className={d.muted}>{t("purchasing.dueDate.manual")}</small>}
                </label>
              )}

              <label className={styles.field}><span>{t("purchasing.detail.file")}</span>
                <input type="file" accept=".pdf,image/*" className={styles.input} onChange={(e) => setInv({ ...inv, file: e.target.files?.[0] || null })} /></label>
            </div>

            {/* Exact VAT, rate by rate, as printed on the supplier's paper */}
            <div className={d.vatEditor}>
              <div className={d.vatHead}>
                <span>{t("purchasing.lines.vat")}</span><span>{t("purchasing.totals.ht")}</span><span>{t("purchasing.invoiceVat.vatAmount")}</span><span>{t("purchasing.totals.ttc")}</span><span />
              </div>
              {(inv.vatLines || []).map((row, i) => {
                const setRow = (patch, recalcVat) => setInv((prev) => ({
                  ...prev,
                  vatLines: prev.vatLines.map((x, k) => {
                    if (k !== i) return x;
                    const next = { ...x, ...patch };
                    return recalcVat ? { ...next, vat: next.baseHT === "" ? "" : r2(Number(next.baseHT) * Number(next.rate) / 100) } : next;
                  }),
                }));
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className={d.vatRow}>
                    <CustomSelect value={String(row.rate)} onSelect={(v) => setRow({ rate: Number(v) }, true)}
                      options={VAT_RATES.map((rate) => ({ value: String(rate), label: `${rate}%` }))} />
                    <input type="number" step="any" className={styles.input} value={row.baseHT} onChange={(e) => setRow({ baseHT: e.target.value }, true)} />
                    <input type="number" step="any" className={styles.input} value={row.vat} onChange={(e) => setRow({ vat: e.target.value }, false)} />
                    <span className={d.vatTtc}>{formatMoney(r2(Number(row.baseHT) + Number(row.vat)))}</span>
                    <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} disabled={(inv.vatLines || []).length === 1}
                      onClick={() => setInv((prev) => ({ ...prev, vatLines: prev.vatLines.filter((_, k) => k !== i) }))}><Trash2 size={13} /></button>
                  </div>
                );
              })}
              <div className={d.vatFooter}>
                {(inv.vatLines || []).length < VAT_RATES.length && (
                  <button type="button" className={styles.linkButton} onClick={() => setInv((prev) => {
                    const used = new Set(prev.vatLines.map((x) => Number(x.rate)));
                    const rate = VAT_RATES.find((x) => !used.has(x)) ?? 0;
                    return { ...prev, vatLines: [...prev.vatLines, { rate, baseHT: "", vat: "" }] };
                  })}>+ {t("purchasing.invoiceVat.addRate")}</button>
                )}
                <strong>{t("purchasing.totals.ttc")} : {formatMoney(r2((inv.vatLines || []).reduce((sum, x) => sum + (Number(x.baseHT) || 0) + (Number(x.vat) || 0), 0)))}</strong>
              </div>
              <small className={d.muted}>
                {inv.type === "invoice"
                  ? t("purchasing.invoiceVat.hintInvoice").replace("{amount}", formatMoney(toInvoice || order.totalTTC))
                  : t("purchasing.invoiceVat.hintCredit")}
              </small>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btnCancel" onClick={() => setShowInvoice(false)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy} onClick={submitInvoice}>{t("common.save")}</button>
            </div>
          </div>
        )}

        {order.invoices.length === 0 ? <Empty icon={<Receipt size={18} />} text={t("purchasing.detail.noInvoices")} /> : (
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: "90px 1.2fr 95px 1.1fr 1fr 1.3fr 40px" }}>
              <span>{t("purchasing.invoices.type")}</span>
              <span>{t("purchasing.detail.invoiceNumber")}</span>
              <span>{t("purchasing.columns.date")}</span>
              <span>{t("purchasing.detail.dueDate")}</span>
              <span>{t("purchasing.detail.amountTTC")}</span>
              <span>{t("purchasing.columns.status")}</span>
              <span />
            </div>
            {order.invoices.map((i) => {
              const row = invoiceState.get(String(i._id));
              const isCredit = i.type === "credit_note";
              return (
                <div key={i._id} className="dataTableRow" style={{ gridTemplateColumns: "90px 1.2fr 95px 1.1fr 1fr 1.3fr 40px" }}>
                  <span><span className={`${d.badge} ${isCredit ? d.badgeWarn : d.badgeNeutral}`}>{t(`purchasing.invoices.types.${isCredit ? "credit_note" : "invoice"}`)}</span></span>
                  <span><strong>{i.number}</strong> {fileLink("order-invoice", i)}</span>
                  <span className="dataTableCellMuted">{formatDate(i.date)}</span>
                  <span className="dataTableCellMuted">
                    {isCredit ? "—" : formatDate(i.dueDate)}
                    {row && row.legal !== "ok" && row.legal !== "unknown" && (
                      <span className={`${d.badge} ${row.legal === "over_max" ? d.badgeBad : d.badgeWarn}`} title={t(`purchasing.legal.${row.legal}Hint`)}>
                        {row.termDays} j
                      </span>
                    )}
                  </span>
                  <span className={isCredit ? d.creditAmount : ""}>
                    <strong>{isCredit ? "− " : ""}{formatMoney(i.amountTTC)}</strong>
                    <small className={d.muted} style={{ display: "block" }}>
                      {i.vatBreakdown?.length
                        ? i.vatBreakdown.map((x) => `${x.rate}% : ${formatMoney(x.vat)}`).join(" · ")
                        : t("purchasing.invoiceVat.estimated")}
                    </small>
                  </span>
                  <span>{isCredit ? <span className={d.muted}>{t("purchasing.invoices.applied")}</span> : invoiceStatusPill(row)}
                    {row && row.status === "partially_paid" && <small className={d.muted}> {t("purchasing.summary.remaining")} : {formatMoney(row.remaining)}</small>}
                  </span>
                  <span><button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")}
                    onClick={() => window.confirm(t("purchasing.detail.deleteInvoiceConfirm")) && run(() => deleteInvoice(order._id, i._id))}><Trash2 size={13} /></button></span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ---------- payments ---------- */}
      <Section
        icon={<Wallet size={16} />}
        title={t("purchasing.detail.payments")}
        count={order.payments.length}
        action={order.status !== "cancelled" && amountDue > 0 && !showPayment && (
          <button type="button" className="btnEdit" onClick={() => { setPay((p) => ({ ...p, amount: amountDue })); setShowPayment(true); }}>{t("purchasing.detail.addPayment")}</button>
        )}
      >
        {showPayment && (
          <div className={styles.panel}>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>{t("purchasing.columns.date")} *</span>
                <input type="date" className={styles.input} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
              <label className={styles.field}><span>{t("purchasing.detail.amount")} *</span>
                <input type="number" min="0" step="any" className={styles.input} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
              <label className={styles.field}><span>{t("purchasing.detail.method")} *</span>
                <CustomSelect value={pay.method} onSelect={(v) => setPay({ ...pay, method: v })}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`purchasing.paymentMethods.${m}`) }))} /></label>
              <label className={styles.field}><span>{t("purchasing.detail.paymentReference")}</span>
                <input className={styles.input} value={pay.reference} placeholder={t("purchasing.detail.paymentReferencePlaceholder")} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
              {order.invoices.some((i) => i.type !== "credit_note") && (
                <label className={styles.field}><span>{t("purchasing.invoiceVat.settlesInvoice")}</span>
                  <CustomSelect value={pay.invoiceId} onSelect={(v) => {
                    const row = invoiceState.get(String(v));
                    setPay({ ...pay, invoiceId: v, amount: row ? row.remaining : pay.amount });
                  }}
                    options={[{ value: "", label: t("purchasing.invoiceVat.oldestFirst") },
                      ...order.invoices.filter((i) => i.type !== "credit_note" && (invoiceState.get(String(i._id))?.remaining || 0) > 0)
                        .map((i) => ({ value: String(i._id), label: `${i.number} — ${formatMoney(invoiceState.get(String(i._id))?.remaining || 0)}` }))]} /></label>
              )}
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btnCancel" onClick={() => setShowPayment(false)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy} onClick={submitPayment}>{t("common.save")}</button>
            </div>
          </div>
        )}
        {order.payments.length > 0 && !order.invoices.some((i) => i.type !== "credit_note") && (
          <div className={d.alertWarn} style={{ marginTop: 0, marginBottom: 10 }}>
            <AlertTriangle size={15} /> {t("purchasing.detail.paymentWithoutInvoice")}
          </div>
        )}
        {order.payments.length === 0 ? <Empty icon={<Wallet size={18} />} text={t("purchasing.detail.noPayments")} /> : (
          <div className="dataTable">
            {order.payments.map((p) => (
              <div key={p._id} className="dataTableRow" style={{ gridTemplateColumns: "95px 1fr 1.2fr 1fr 40px" }}>
                <span className="dataTableCellMuted">{formatDate(p.date)}</span>
                <span>{t(`purchasing.paymentMethods.${p.method}`)}</span>
                <span className="dataTableCellMuted">{p.reference || "—"}</span>
                <span><strong>{formatMoney(p.amount)}</strong></span>
                <span><button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")}
                  onClick={() => window.confirm(t("purchasing.detail.deletePaymentConfirm")) && run(() => deletePayment(order._id, p._id))}><Trash2 size={13} /></button></span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ---------- linked purchase requests ---------- */}
      {order.purchaseRequests?.length > 0 && (
        <Section icon={<Inbox size={16} />} title={t("purchasing.detail.linkedRequests")} count={order.purchaseRequests.length}
          action={<Link to="/purchasing/requests" className={styles.orderLink}>{t("purchasing.requests.title")} →</Link>}>
          <div className={d.chips}>
            {order.purchaseRequests.map((r) => (
              <span key={r._id} className={d.requestChip}>
                {r.requestedQuantity} × {r.product?.name}
                <StatusPill status={PILL[r.status]} label={t(`purchasing.requestStatus.${{ approved: "ordered", rejected: "declined" }[r.status] || r.status}`)} />
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- dialogs ---------- */}
      {closingLine && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3>{t("purchasing.lines.closeTitle")}</h3>
            <p>
              <strong>{closingLine.description}</strong><br />
              {t("purchasing.lines.closeSummary")
                .replace("{received}", net(closingLine))
                .replace("{ordered}", closingLine.quantity)
                .replace("{missing}", lineOutstanding(closingLine))}
            </p>
            <label className={styles.field}>
              <span>{t("purchasing.lines.closeReason")}</span>
              <input className={styles.input} value={closeReason} placeholder={t("purchasing.lines.closeReasonPlaceholder")}
                onChange={(e) => setCloseReason(e.target.value)} />
            </label>
            <p className={styles.muted}>{t("purchasing.lines.closeEffect")}</p>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setClosingLine(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy}
                onClick={async () => { if (await run(() => closeOrderLine(order._id, closingLine._id, closeReason))) setClosingLine(null); }}>
                <Lock size={14} /> {t("purchasing.lines.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {articleLine && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3>{t("purchasing.addToInventory.title")}</h3>
            <p className={styles.muted}>{articleLine.description} — {order.supplier?.name} : {formatMoney(articleLine.unitPrice)}</p>
            <label className={styles.field}>
              <span>{t("purchasing.addToInventory.category")} *</span>
              <CustomSelect value={articleForm.category} onSelect={(v) => setArticleForm({ ...articleForm, category: v })}
                placeholder={t("purchasing.addToInventory.category")} options={categories.map((c) => ({ value: c._id, label: c.name }))} />
            </label>
            <label className={styles.field}>
              <span>{t("purchasing.supplierPrices.internalReference")}</span>
              <input className={styles.input} value={articleForm.internalReference} placeholder={t("purchasing.addToInventory.referenceOptional")}
                onChange={(e) => setArticleForm({ ...articleForm, internalReference: e.target.value })} />
            </label>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>{t("purchasing.lines.unit")}</span>
                <input className={styles.input} value={articleForm.unit} onChange={(e) => setArticleForm({ ...articleForm, unit: e.target.value })} />
              </label>
              <label className={styles.field}>
                <span>{t("purchasing.addToInventory.threshold")}</span>
                <input type="number" min="0" step="any" className={styles.input} value={articleForm.threshold}
                  onChange={(e) => setArticleForm({ ...articleForm, threshold: e.target.value })} />
              </label>
            </div>
            <p className={styles.muted}>
              {net(articleLine) > 0 ? t("purchasing.addToInventory.stockNow").replace("{count}", net(articleLine)) : t("purchasing.addToInventory.stockLater")}
            </p>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setArticleLine(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy || !articleForm.category}
                onClick={async () => { if (await run(() => addLineToInventory(order._id, articleLine._id, articleForm))) setArticleLine(null); }}>
                {t("purchasing.addToInventory.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {refuseOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3>{t("purchasing.approval.refuseTitle")} {order.number}</h3>
            <label className={styles.field}>
              <span>{t("purchasing.approval.refuseReason")} *</span>
              <textarea className={styles.input} rows={3} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setRefuseOpen(false)}>{t("common.back")}</button>
              <button type="button" className="btnDelete" disabled={busy || !refuseReason.trim()}
                onClick={async () => { if (await run(() => refuseOrderApproval(order._id, refuseReason))) setRefuseOpen(false); }}>
                {t("purchasing.approval.refuse")}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3>{t("purchasing.email.title").replace("{number}", order.number)}</h3>
            <label className={styles.field}><span>{t("purchasing.email.to")} *</span>
              <input type="email" className={styles.input} value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} /></label>
            <label className={styles.field}><span>{t("purchasing.email.cc")}</span>
              <input className={styles.input} value={emailForm.cc} placeholder="a@x.ma, b@y.ma" onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })} /></label>
            <label className={styles.field}><span>{t("purchasing.email.message")}</span>
              <textarea className={styles.input} rows={4} value={emailForm.message} placeholder={t("purchasing.email.defaultMessageHint")}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} /></label>
            <p className={styles.muted}><Paperclip size={12} /> {order.number}.pdf</p>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setEmailOpen(false)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy || !emailForm.to.trim()} onClick={async () => {
                const ok = await run(async () => {
                  const { order: updated, simulated } = await emailOrder(order._id, emailForm);
                  setNotice(simulated ? t("purchasing.email.simulated") : t("purchasing.email.sent").replace("{to}", emailForm.to));
                  return updated;
                });
                if (ok) setEmailOpen(false);
              }}>
                <Mail size={14} /> {t("purchasing.email.send")}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3>{t("purchasing.detail.cancelOrder")} {order.number}</h3>
            <label className={styles.field}>
              <span>{t("purchasing.detail.cancelReason")} *</span>
              <textarea className={styles.input} rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </label>
            {order.purchaseRequests?.length > 0 && <p className={styles.muted}>{t("purchasing.detail.cancelRequestsHint")}</p>}
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setCancelOpen(false)}>{t("common.back")}</button>
              <button type="button" className="btnDelete" disabled={busy || !cancelReason.trim()}
                onClick={async () => { if (await run(() => setOrderStatus(order._id, "cancelled", cancelReason))) setCancelOpen(false); }}>
                {t("purchasing.detail.cancelOrder")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
