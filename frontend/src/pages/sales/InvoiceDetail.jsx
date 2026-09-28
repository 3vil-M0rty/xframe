import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Receipt, Pencil, Stamp, Download, Send, Trash2, FileMinus, Wallet, Link2 } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import StatusPill from "../../components/useful/StatusPill";
import CustomSelect from "../../components/useful/CustomSelect";
import ActionModal from "../../components/useful/ActionModal";
import {
  getInvoice, getInvoices, issueInvoice, deleteInvoice, addInvoicePayment, deleteInvoicePayment, createCreditNote, applyCreditNote, emailInvoice, downloadInvoicePdf,
} from "../../services/salesService";
import { formatMoney, formatDate, todayInput, SALES_PILL, PAYMENT_METHODS, lineHT } from "./salesShared";
import styles from "../purchasing/Purchasing.module.css";
import SalesLineCell from "./SalesLineCell";
import s from "./Sales.module.css";

/** One invoice / deposit invoice / credit note: issue it, send it, record payments. */
export default function InvoiceDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [openInvoices, setOpenInvoices] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setInv(await getInvoice(id));
    } catch (err) {
      setError(err.response?.data?.message || t("sales.errors.load"));
    }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, successKey) => {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (successKey) setNotice(t(successKey));
      return r ?? true;
    } catch (err) {
      setError(err.response?.data?.message || t("sales.errors.save"));
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (!inv) return <div className="pageShell">{error ? <div className="errorMessage">{error}</div> : <p className={s.muted}>{t("common.loading")}</p>}</div>;

  const isCredit = inv.type === "credit_note";
  const open = ["issued", "partially_paid"].includes(inv.status);
  const remaining = Math.max(Math.round((inv.totalTTC - inv.amountPaid) * 100) / 100, 0);
  const linesHT = (inv.totalHT || 0) + (inv.depositsDeductedHT || 0);

  const openPayment = () => {
    setForm({ date: todayInput(), amount: remaining, method: "virement", reference: "" });
    setModal("payment");
  };
  const openApply = async () => {
    const { invoices } = await getInvoices({ companyId: inv.company, customer: inv.customer?._id, status: "unpaid", limit: 100 });
    setOpenInvoices(invoices.filter((i) => i.type !== "credit_note"));
    setForm({ invoice: "", amount: "" });
    setModal("apply");
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.sales"), href: "/sales/quotes" }, { label: t("sales.invoices.title"), href: "/sales/invoices" }, { label: inv.number || t("sales.invoiceStatus.draft") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Receipt size={20} />
            <h1>{t(`sales.invoiceTypes.${inv.type}`)} {inv.number || ""}</h1>
            <StatusPill status={SALES_PILL[inv.status]} label={t(`sales.invoiceStatus.${inv.status}`)} />
          </div>
          <p className="pageSubtitle">{inv.customer?.name}{inv.subject ? ` — ${inv.subject}` : ""}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className="btnEdit" onClick={() => run(() => downloadInvoicePdf(inv))}><Download size={15} /> PDF</button>
          {inv.status === "draft" && <button type="button" className="btnEdit" onClick={() => navigate(`/sales/invoices/${id}/edit`)}><Pencil size={15} /> {t("common.edit")}</button>}
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.infoBanner}>{notice}</div>}

      <div className={s.statusBar}>
        {inv.status === "draft" && (
          <>
            <button type="button" className="btnPrimary" onClick={() => setModal("issue")}><Stamp size={15} /> {t("sales.invoices.issue")}</button>
            <button type="button" className="btnDelete" onClick={() => setModal("delete")}><Trash2 size={15} /> {t("common.delete")}</button>
          </>
        )}
        {open && !isCredit && <button type="button" className="btnPrimary" onClick={openPayment}><Wallet size={15} /> {t("sales.invoices.addPayment")}</button>}
        {open && isCredit && <button type="button" className="btnPrimary" onClick={openApply}><Link2 size={15} /> {t("sales.invoices.applyCredit")}</button>}
        {inv.status !== "draft" && inv.status !== "cancelled" && (
          <button type="button" className="btnEdit" onClick={() => { setForm({ to: inv.customer?.email || inv.customer?.contacts?.[0]?.email || "", cc: "", message: "" }); setModal("email"); }}>
            <Send size={15} /> {t("sales.invoices.sendEmail")}
          </button>
        )}
        {!isCredit && ["issued", "partially_paid", "paid"].includes(inv.status) && (
          <button type="button" className="btnCancel" onClick={async () => { const c = await run(() => createCreditNote(id)); if (c) navigate(`/sales/invoices/${c._id}`); }}>
            <FileMinus size={15} /> {t("sales.invoices.makeCredit")}
          </button>
        )}
      </div>
      {inv.status === "draft" && <div className={styles.infoBanner}>{t("sales.invoices.draftHint")}</div>}

      <div className={s.docMeta}>
        <div><span>{t("sales.customer")}</span>{inv.customer?.name}{inv.customer?.ice ? <small className={s.muted}>ICE {inv.customer.ice}</small> : !isCredit && inv.customer?.kind !== "individual" && <small className={s.warn}>{t("sales.invoices.noIce")}</small>}</div>
        <div><span>{t("sales.date")}</span>{formatDate(inv.date)}</div>
        {!isCredit && <div><span>{t("sales.dueDate")}</span>{inv.dueDate ? formatDate(inv.dueDate) : t("sales.invoices.dueOnIssue")}</div>}
        {inv.quote && <div><span>{t("sales.quotes.one")}</span><button type="button" className={styles.linkButton} onClick={() => navigate(`/sales/quotes/${inv.quote._id}`)}>{inv.quote.number}</button></div>}
        {inv.project && <div><span>{t("sales.project")}</span><button type="button" className={styles.linkButton} onClick={() => navigate(`/production/projects/${inv.project._id}`)}>{inv.project.number} — {inv.project.name}</button></div>}
        {inv.creditedInvoice && <div><span>{t("sales.invoices.creditedInvoice")}</span><button type="button" className={styles.linkButton} onClick={() => navigate(`/sales/invoices/${inv.creditedInvoice._id}`)}>{inv.creditedInvoice.number}</button></div>}
      </div>

      <table className={s.linesTable}>
        <thead><tr><th>{t("sales.lines.description")}</th><th className={s.num}>{t("sales.lines.quantity")}</th><th>{t("sales.lines.unit")}</th>
          <th className={s.num}>{t("sales.lines.unitPrice")}</th><th className={s.num}>{t("sales.lines.discount")}</th><th className={s.num}>{t("sales.lines.vat")}</th><th className={s.num}>{t("sales.lines.totalHT")}</th></tr></thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={l._id}>
              <td><SalesLineCell line={l} info={inv.chassisInfo?.[i]} /></td><td className={s.num}>{l.quantity}</td><td>{l.unit}</td><td className={s.num}>{formatMoney(l.unitPrice, "")}</td>
              <td className={s.num}>{l.discount ? `${l.discount}%` : ""}</td><td className={s.num}>{l.vatRate}%</td><td className={s.num}>{formatMoney(lineHT(l), "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={s.totalsBox}>
        <div><span>{t("sales.totals.ht")}</span><strong>{formatMoney(linesHT)}</strong></div>
        {inv.depositsDeductedHT > 0 && (
          <>
            <div><span>{t("sales.invoices.depositsDeducted")}</span><span>− {formatMoney(inv.depositsDeductedHT)}</span></div>
            <div><span>{t("sales.invoices.netHT")}</span><strong>{formatMoney(inv.totalHT)}</strong></div>
          </>
        )}
        {(inv.vatBreakdown || []).filter((b) => b.rate > 0).map((b) => <div key={b.rate}><span>{t("sales.totals.vat")} {b.rate}%</span><span>{formatMoney(b.vat)}</span></div>)}
        <div className={s.grand}><span>{inv.depositsDeductedHT > 0 ? t("sales.invoices.netToPay") : t("sales.totals.ttc")}</span><span>{formatMoney(inv.totalTTC)}</span></div>
        {inv.status !== "draft" && !isCredit && (
          <>
            <div><span>{t("sales.invoices.paid")}</span><span className={s.good}>{formatMoney(inv.amountPaid)}</span></div>
            <div><span>{t("sales.invoices.remaining")}</span><strong className={remaining > 0 ? s.bad : s.good}>{formatMoney(remaining)}</strong></div>
          </>
        )}
      </div>
      {(inv.depositInvoices || []).length > 0 && (
        <p className={s.muted}>{t("sales.invoices.depositsList")}: {inv.depositInvoices.map((d) => d.number).join(", ")}</p>
      )}

      {(inv.payments || []).length > 0 && (
        <section className={styles.section}>
          <h2>{isCredit ? t("sales.invoices.usage") : t("sales.invoices.payments")}</h2>
          <div className="dataTable">
            {inv.payments.map((p) => (
              <div key={p._id} className="dataTableRow" style={{ gridTemplateColumns: "110px 1fr 1fr 1.4fr 44px" }}>
                <span>{formatDate(p.date)}</span>
                <span><strong>{formatMoney(p.amount)}</strong></span>
                <span className="dataTableCellMuted">{t(`purchasing.paymentMethods.${p.method}`)}</span>
                <span className="dataTableCellMuted">{p.reference || "—"}{p.notes ? ` · ${p.notes}` : ""}</span>
                <span className="dataTableActions">
                  {!isCredit && (
                    <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")}
                      onClick={async () => { const r = await run(() => deleteInvoicePayment(id, p._id)); if (r) setInv({ ...inv, ...r }); }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {(inv.creditNotes || []).length > 0 && (
        <p className={s.muted}>{t("sales.invoices.creditNotes")}: {inv.creditNotes.map((c) => c.number || t("sales.invoiceStatus.draft")).join(", ")}</p>
      )}

      {/* ---------- modals ---------- */}
      <ActionModal isOpen={modal === "issue"} type="confirm" title={t("sales.invoices.issue")} message={t("sales.invoices.issueMessage")}
        onClose={() => setModal(null)} onConfirm={async () => { const r = await run(() => issueInvoice(id), "sales.invoices.issued"); setModal(null); if (r) setInv({ ...inv, ...r }); }} />
      <ActionModal isOpen={modal === "delete"} type="confirm" title={t("common.delete")} message={t("sales.invoices.deleteMessage")}
        onClose={() => setModal(null)} onConfirm={async () => { const r = await run(() => deleteInvoice(id)); if (r) navigate("/sales/invoices"); }} />

      {modal === "payment" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>{t("sales.invoices.addPayment")}</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>{t("sales.date")}<input className={styles.input} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className={styles.field}>{t("sales.amount")}<input className={styles.input} type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            </div>
            <label className={styles.field}>{t("sales.method")}
              <CustomSelect value={form.method} onSelect={(v) => setForm({ ...form, method: v })}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`purchasing.paymentMethods.${m}`) }))} />
            </label>
            <label className={styles.field}>{t("sales.reference")}<input className={styles.input} value={form.reference} placeholder={t("sales.referencePlaceholder")} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setModal(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy} onClick={async () => {
                const r = await run(() => addInvoicePayment(id, { ...form, amount: Number(form.amount) }), "sales.invoices.paymentSaved");
                if (r) { setInv({ ...inv, ...r }); setModal(null); }
              }}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
      {modal === "apply" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>{t("sales.invoices.applyCredit")}</h3>
            <p className={s.muted}>{t("sales.invoices.applyHint").replace("{amount}", formatMoney(remaining))}</p>
            <label className={styles.field}>{t("sales.invoices.title")}
              <CustomSelect value={form.invoice} onSelect={(v) => setForm({ ...form, invoice: v })} placeholder={openInvoices.length ? t("sales.invoices.pickInvoice") : t("sales.invoices.noOpenInvoice")}
                options={openInvoices.map((i) => ({ value: i._id, label: `${i.number} — ${t("sales.invoices.remaining")} ${formatMoney(i.due)}` }))} />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setModal(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy || !form.invoice} onClick={async () => {
                const r = await run(() => applyCreditNote(id, { invoice: form.invoice }), "sales.invoices.applied");
                if (r) { setInv({ ...inv, ...r }); setModal(null); }
              }}>{t("sales.invoices.apply")}</button>
            </div>
          </div>
        </div>
      )}
      {modal === "email" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>{t("sales.invoices.sendEmail")}</h3>
            <label className={styles.field}>{t("sales.emailTo")}<input className={styles.input} type="email" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
            <label className={styles.field}>CC<input className={styles.input} value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} /></label>
            <label className={styles.field}>{t("sales.emailMessage")}<textarea className={styles.input} rows={4} value={form.message} placeholder={t("sales.emailDefault")} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setModal(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy} onClick={async () => {
                const res = await run(() => emailInvoice(id, form));
                if (res) { setNotice(res.simulated ? t("sales.emailSimulated") : t("sales.emailSent")); setModal(null); }
              }}><Send size={14} /> {t("sales.send")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
