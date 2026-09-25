import { useCallback, useEffect, useState } from "react";
import { Download, Paperclip, Trash2, FileText, FolderOpen } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import CustomSelect from "../../components/useful/CustomSelect";
import {
  getSupplierStatement, downloadSupplierStatement, addSupplierDocument, deleteSupplierDocument,
} from "../../services/purchasingService";
import { formatMoney, formatDate } from "./shared";
import styles from "./Purchasing.module.css";

export const DOC_TYPES = ["attestation_fiscale", "rc", "cnss", "rib", "patente", "other"];
const DAY = 86400000;

/** "expired" | "expiring" (within 30 days) | "ok" | null (no expiry date) */
export function docState(doc, now = new Date()) {
  if (!doc.expiryDate) return null;
  const exp = new Date(doc.expiryDate);
  if (exp < now) return "expired";
  if (exp - now <= 30 * DAY) return "expiring";
  return "ok";
}

/** Worst document state of a supplier, for the list badge. */
export function supplierDocAlert(supplier) {
  const states = (supplier.documents || []).map((d) => docState(d));
  if (states.includes("expired")) return "expired";
  if (states.includes("expiring")) return "expiring";
  return null;
}

// ------------------------------------------------------------
// Statement (relevé fournisseur)
// ------------------------------------------------------------
export function SupplierStatementModal({ supplier, onClose }) {
  const { t } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await getSupplierStatement(supplier._id, { from: from || undefined, to: to || undefined }));
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    }
  }, [supplier._id, from, to, t]);
  useEffect(() => { load(); }, [load]);

  const typeLabel = (r) => t(`purchasing.statement.types.${r.type}`) + (r.method ? ` (${t(`purchasing.paymentMethods.${r.method}`)})` : "");
  const cols = "95px 1.3fr 1fr 110px 1fr 1fr 1fr";

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard} style={{ maxWidth: 920 }}>
        <h3><FileText size={16} /> {t("purchasing.statement.title")} — {supplier.name}</h3>
        <div className={styles.toolbar} style={{ margin: "10px 0" }}>
          <div className="filterGroup"><label>{t("common.dateFrom")}</label><input type="date" className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="filterGroup"><label>{t("common.dateTo")}</label><input type="date" className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        {error && <div className="errorMessage">{error}</div>}
        {data && (
          <>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}><span>{t("purchasing.statement.opening")}</span><strong>{formatMoney(data.openingBalance)}</strong></div>
              <div className={styles.summaryCard}><span>{t("purchasing.statement.invoiced")}</span><strong>{formatMoney(data.totalInvoiced)}</strong></div>
              <div className={styles.summaryCard}><span>{t("purchasing.statement.settled")}</span><strong>{formatMoney(data.totalSettled)}</strong></div>
              <div className={styles.summaryCard}><span>{t("purchasing.statement.closing")}</span><strong className={data.closingBalance > 0 ? styles.amountDue : ""}>{formatMoney(data.closingBalance)}</strong></div>
            </div>
            {data.rows.length === 0 ? <p className={styles.muted}>{t("purchasing.statement.empty")}</p> : (
              <div className="dataTable" style={{ maxHeight: 360, overflowY: "auto" }}>
                <div className="dataTableHead" style={{ gridTemplateColumns: cols }}>
                  <span>{t("purchasing.columns.date")}</span><span>{t("purchasing.statement.operation")}</span>
                  <span>{t("purchasing.statement.reference")}</span><span>{t("purchasing.columns.number")}</span>
                  <span>{t("purchasing.statement.debit")}</span><span>{t("purchasing.statement.credit")}</span><span>{t("purchasing.statement.balance")}</span>
                </div>
                {data.rows.map((r, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className="dataTableRow" style={{ gridTemplateColumns: cols }}>
                    <span className="dataTableCellMuted">{formatDate(r.date)}</span>
                    <span>{typeLabel(r)}</span>
                    <span className="dataTableCellMuted">{r.reference || "—"}</span>
                    <span className="dataTableCellMuted">{r.orderNumber}</span>
                    <span>{r.debit ? formatMoney(r.debit) : ""}</span>
                    <span>{r.credit ? formatMoney(r.credit) : ""}</span>
                    <span><strong>{formatMoney(r.balance)}</strong></span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className={styles.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.close")}</button>
          <button type="button" className="btnPrimary" onClick={() => downloadSupplierStatement(supplier._id, supplier.name, { from: from || undefined, to: to || undefined }).catch((err) => setError(err.message))}>
            <Download size={14} /> {t("purchasing.reports.downloadXlsx")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Documents (attestation fiscale, RC, CNSS, RIB...) with expiry
// ------------------------------------------------------------
export function SupplierDocumentsModal({ supplier, onClose, onChanged }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(supplier);
  const [form, setForm] = useState({ type: "attestation_fiscale", label: "", number: "", issueDate: "", expiryDate: "", file: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = (updated) => { setCurrent(updated); onChanged(updated); };

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      apply(await addSupplierDocument(current._id, form));
      setForm({ type: "attestation_fiscale", label: "", number: "", issueDate: "", expiryDate: "", file: null });
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.save"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc) => {
    if (!window.confirm(t("purchasing.supplierDocs.deleteConfirm"))) return;
    try { apply(await deleteSupplierDocument(current._id, doc._id)); } catch (err) { setError(err.response?.data?.message || t("purchasing.errors.save")); }
  };

  const stateBadge = (doc) => {
    const st = docState(doc);
    if (!st) return <span className={styles.muted}>{t("purchasing.supplierDocs.noExpiry")}</span>;
    const cls = st === "expired" ? styles.docExpired : st === "expiring" ? styles.docExpiring : styles.docOk;
    return <span className={cls}>{t(`purchasing.supplierDocs.state.${st}`)} · {formatDate(doc.expiryDate)}</span>;
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard} style={{ maxWidth: 760 }}>
        <h3><FolderOpen size={16} /> {t("purchasing.supplierDocs.title")} — {current.name}</h3>
        {(current.documents || []).length === 0 ? <p className={styles.muted}>{t("purchasing.supplierDocs.empty")}</p> : (
          <div className="dataTable" style={{ margin: "10px 0" }}>
            {current.documents.map((doc) => (
              <div key={doc._id} className="dataTableRow" style={{ gridTemplateColumns: "1.4fr 1fr 1.4fr 1fr 40px" }}>
                <span><strong>{doc.label || t(`purchasing.supplierDocs.types.${doc.type}`)}</strong></span>
                <span className="dataTableCellMuted">{doc.number || "—"}</span>
                <span>{stateBadge(doc)}</span>
                <span>{doc.file?.url ? <a className={styles.fileLink} href={doc.file.url} target="_blank" rel="noopener noreferrer"><Paperclip size={12} /> {t("purchasing.detail.file")}</a> : "—"}</span>
                <span><button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => remove(doc)}><Trash2 size={13} /></button></span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.panel}>
          <h3>{t("purchasing.supplierDocs.add")}</h3>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>{t("purchasing.supplierDocs.type")} *</span>
              <CustomSelect value={form.type} onSelect={(v) => setForm({ ...form, type: v })}
                options={DOC_TYPES.map((ty) => ({ value: ty, label: t(`purchasing.supplierDocs.types.${ty}`) }))} /></label>
            {form.type === "other" && (
              <label className={styles.field}><span>{t("purchasing.supplierDocs.label")}</span>
                <input className={styles.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
            )}
            <label className={styles.field}><span>{t("purchasing.supplierDocs.number")}</span>
              <input className={styles.input} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
            <label className={styles.field}><span>{t("purchasing.supplierDocs.issueDate")}</span>
              <input type="date" className={styles.input} value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></label>
            <label className={styles.field}><span>{t("purchasing.supplierDocs.expiryDate")}</span>
              <input type="date" className={styles.input} value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></label>
            <label className={styles.field}><span>{t("purchasing.detail.file")}</span>
              <input type="file" accept=".pdf,image/*" className={styles.input} onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} /></label>
          </div>
          <p className={styles.muted}>{t("purchasing.supplierDocs.alertHint")}</p>
          {error && <div className="errorMessage">{error}</div>}
          <div className={styles.formActions}>
            <button type="button" className="btnPrimary" disabled={busy} onClick={add}>{t("common.save")}</button>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
