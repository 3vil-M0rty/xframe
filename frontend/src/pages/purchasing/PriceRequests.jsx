import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileQuestion, Plus, Send, CheckCheck, XCircle, Upload, ArrowRightCircle, Trash2, Paperclip, ChevronDown, ChevronRight, FileDown, Mail, Scale, X } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import {
  getPriceRequests, createPriceRequests, updatePriceRequest, uploadQuoteFile, convertPriceRequest, deletePriceRequest, getSuppliers, downloadPriceRequestPdf,
  emailPriceRequest, comparePriceRequests,
} from "../../services/purchasingService";
import LinesEditor, { emptyLine } from "./LinesEditor";
import { useCompanyPicker, useCompanyProducts, formatDate, formatMoney, lineTotals, PILL } from "./shared";
import styles from "./Purchasing.module.css";

const toPayloadLines = (lines) => lines.map((l) => ({
  product: l.product?._id || l.product || null,
  description: l.description,
  quantity: Number(l.quantity),
  unit: l.unit,
  quotedUnitPrice: l.quotedUnitPrice === "" || l.quotedUnitPrice === null || l.quotedUnitPrice === undefined ? null : Number(l.quotedUnitPrice),
  vatRate: Number(l.vatRate),
}));

/**
 * Demandes de prix: ask a supplier for a quote, record the quoted
 * prices (and the quote file) when they answer, then convert it into a
 * bon de commande at those prices — or reject it.
 */
export default function PriceRequests() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const products = useCompanyProducts(companyId);

  const [suppliers, setSuppliers] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  // one request can go to several suppliers at once (compared later)
  const [newSuppliers, setNewSuppliers] = useState([]);
  const [notice, setNotice] = useState("");
  const [emailDoc, setEmailDoc] = useState(null);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", message: "" });
  const [comparison, setComparison] = useState(null);
  const [newDeadline, setNewDeadline] = useState("");
  const [newLines, setNewLines] = useState([emptyLine()]);

  const [openId, setOpenId] = useState(null);
  const [editLines, setEditLines] = useState([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setList(await getPriceRequests(companyId));
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (companyId) getSuppliers(companyId, { active: "true" }).then(setSuppliers).catch(() => setSuppliers([]));
  }, [companyId]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try { return await fn(); } catch (err) { setError(err.response?.data?.message || t("purchasing.errors.save")); return null; } finally { setBusy(false); }
  };

  const replace = (doc) => { if (doc?._id) setList((l) => l.map((x) => (x._id === doc._id ? doc : x))); };

  const create = async () => {
    if (!newSuppliers.length) { setError(t("purchasing.orders.form.supplierRequired")); return; }
    const result = await run(() => createPriceRequests({ company: companyId, suppliers: newSuppliers, responseDeadline: newDeadline || null, lines: toPayloadLines(newLines) }));
    if (result) {
      setCreating(false);
      setNewSuppliers([]); setNewDeadline(""); setNewLines([emptyLine()]);
      setList((l) => [...result.docs, ...l]);
      if (result.docs.length > 1) setNotice(t("purchasing.compare.created").replace("{count}", result.docs.length));
    }
  };

  const openCompare = async (group) => setComparison(await run(() => comparePriceRequests(group)));

  const chooseFromComparison = async (priceRequestId) => {
    const doc = list.find((x) => x._id === priceRequestId);
    if (!doc) return;
    const result = await run(() => convertPriceRequest(doc._id));
    if (result?.purchaseOrderId) navigate(`/purchasing/orders/${result.purchaseOrderId}`);
  };

  const sendEmail = async () => {
    const result = await run(() => emailPriceRequest(emailDoc._id, emailForm));
    if (result) {
      replace(result.priceRequest);
      setNotice(result.simulated ? t("purchasing.email.simulated") : t("purchasing.email.sent").replace("{to}", emailForm.to));
      setEmailDoc(null);
    }
  };

  const toggleOpen = (doc) => {
    if (openId === doc._id) { setOpenId(null); return; }
    setOpenId(doc._id);
    setEditLines(doc.lines.map((l) => ({ ...l, product: l.product?._id || l.product || "", quotedUnitPrice: l.quotedUnitPrice ?? "" })));
  };

  const saveLines = async (doc, extra = {}) => replace(await run(() => updatePriceRequest(doc._id, { lines: toPayloadLines(editLines), ...extra })));
  const setStatus = async (doc, status) => replace(await run(() => updatePriceRequest(doc._id, { status })));

  const convert = async (doc) => {
    // save the prices first so the conversion uses what's on screen
    const saved = await run(() => updatePriceRequest(doc._id, { lines: toPayloadLines(editLines) }));
    if (!saved) return;
    const result = await run(() => convertPriceRequest(doc._id));
    if (result?.purchaseOrderId) navigate(`/purchasing/orders/${result.purchaseOrderId}`);
  };

  const remove = async (doc) => {
    if (!window.confirm(t("purchasing.priceRequests.deleteConfirm"))) return;
    const ok = await run(() => deletePriceRequest(doc._id));
    if (ok) setList((l) => l.filter((x) => x._id !== doc._id));
  };

  const closed = (doc) => ["accepted", "rejected"].includes(doc.status);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.priceRequests.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><FileQuestion size={20} /><h1>{t("purchasing.priceRequests.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.priceRequests.subtitle")}</p>
        </div>
        {companyId && !creating && (
          <button type="button" className="btnPrimary" onClick={() => setCreating(true)}><Plus size={15} /> {t("purchasing.priceRequests.new")}</button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.infoBanner}>{notice}</div>}

      {creating && (
        <div className={styles.panel}>
          <h3>{t("purchasing.priceRequests.new")}</h3>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>{t("purchasing.compare.suppliers")} *</span>
              <CustomSelect value="" onSelect={(v) => v && setNewSuppliers((list0) => (list0.includes(v) ? list0 : [...list0, v]))}
                placeholder={t("purchasing.compare.addSupplier")}
                options={suppliers.filter((s) => !newSuppliers.includes(s._id)).map((s) => ({ value: s._id, label: s.name }))} />
              <span className={styles.chipList}>
                {newSuppliers.map((id) => (
                  <span key={id} className={styles.chip}>
                    {suppliers.find((s) => s._id === id)?.name}
                    <button type="button" aria-label={t("common.delete")} onClick={() => setNewSuppliers((l) => l.filter((x) => x !== id))}><X size={12} /></button>
                  </span>
                ))}
              </span>
              {newSuppliers.length > 1 && <small className={styles.muted}>{t("purchasing.compare.multiHint").replace("{count}", newSuppliers.length)}</small>}
            </label>
            <label className={styles.field}><span>{t("purchasing.priceRequests.deadline")}</span>
              <input type="date" className={styles.input} value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} /></label>
          </div>
          <p className={styles.muted}>{t("purchasing.priceRequests.noPricesHint")}</p>
          <LinesEditor lines={newLines} onChange={setNewLines} products={products} priceKey="quotedUnitPrice" priceOptional showPrices={false} />
          <div className={styles.formActions}>
            <button type="button" className="btnCancel" onClick={() => setCreating(false)}>{t("common.cancel")}</button>
            <button type="button" className="btnPrimary" disabled={busy} onClick={create}>{t("common.save")}</button>
          </div>
        </div>
      )}

      {loading && <p className={styles.muted}>{t("common.loading")}</p>}
      {!loading && list.length === 0 && !creating && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><FileQuestion size={28} /></div><h2>{t("purchasing.priceRequests.empty")}</h2></div>
      )}

      {list.map((doc) => {
        const isOpen = openId === doc._id;
        const totals = lineTotals(isOpen ? editLines : doc.lines, "quotedUnitPrice");
        return (
          <div key={doc._id} className={styles.card}>
            <div className={styles.cardHeader} role="button" tabIndex={0} onClick={() => toggleOpen(doc)} onKeyDown={(e) => e.key === "Enter" && toggleOpen(doc)}>
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <strong>{doc.number}</strong>
              <span>{doc.supplier?.name}</span>
              <span className={styles.muted}>{formatDate(doc.date)}{doc.responseDeadline && ` → ${formatDate(doc.responseDeadline)}`}</span>
              <StatusPill status={PILL[doc.status]} label={t(`purchasing.priceStatus.${doc.status}`)} />
              {totals.ttc > 0 && <span className={styles.muted}>{formatMoney(totals.ttc)}</span>}
              {doc.purchaseOrder && <span className={styles.orderLink}>→ {doc.purchaseOrder.number}</span>}
              {doc.comparisonGroup && (
                <button type="button" className={styles.compareBtn} onClick={(e) => { e.stopPropagation(); openCompare(doc.comparisonGroup); }}>
                  <Scale size={13} /> {t("purchasing.compare.button")}
                </button>
              )}
            </div>

            {isOpen && (
              <div className={styles.cardBody}>
                <div className={styles.cardTopActions}>
                  <button type="button" className="btnEdit" disabled={busy} onClick={() => run(() => downloadPriceRequestPdf(doc))}>
                    <FileDown size={14} /> {t("purchasing.pdf.download")}
                  </button>
                  {!closed(doc) && (
                    <button type="button" className="btnEdit" disabled={busy}
                      onClick={() => { setEmailForm({ to: doc.supplier?.email || "", cc: "", message: "" }); setEmailDoc(doc); }}>
                      <Mail size={14} /> {t("purchasing.email.send")}
                    </button>
                  )}
                </div>
                {closed(doc) ? (
                  <div className="dataTable">
                    {doc.lines.map((l) => (
                      <div key={l._id} className="dataTableRow" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                        <span>{l.description}</span><span>{l.quantity} {l.unit || ""}</span>
                        <span>{l.quotedUnitPrice !== null && l.quotedUnitPrice !== undefined ? formatMoney(l.quotedUnitPrice) : "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {doc.status !== "draft" && <p className={styles.muted}>{t("purchasing.priceRequests.enterPricesHint")}</p>}
                    <LinesEditor lines={editLines} onChange={setEditLines} products={products} priceKey="quotedUnitPrice" priceOptional
                      showPrices={doc.status !== "draft"} />
                  </>
                )}

                {doc.quoteFile?.url && (
                  <a className={styles.fileLink} href={doc.quoteFile.url} target="_blank" rel="noopener noreferrer">
                    <Paperclip size={13} /> {doc.quoteFile.originalName || t("purchasing.priceRequests.quote")}
                  </a>
                )}
                {doc.notes && <p className={styles.muted}>{doc.notes}</p>}

                {!closed(doc) && (
                  <div className={styles.formActions}>
                    <button type="button" className="btnDelete" disabled={busy} onClick={() => remove(doc)}><Trash2 size={14} /></button>
                    <label className="btnEdit" style={{ cursor: "pointer" }}>
                      <Upload size={14} /> {t("purchasing.priceRequests.uploadQuote")}
                      <input type="file" accept=".pdf,image/*" hidden onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) replace(await run(() => uploadQuoteFile(doc._id, file)));
                      }} />
                    </label>
                    <button type="button" className="btnEdit" disabled={busy} onClick={() => saveLines(doc)}>{t("common.save")}</button>
                    {doc.status === "draft" && (
                      <button type="button" className="btnEdit" disabled={busy} onClick={() => setStatus(doc, "sent")}><Send size={14} /> {t("purchasing.priceRequests.markSent")}</button>
                    )}
                    {doc.status === "sent" && (
                      <button type="button" className="btnEdit" disabled={busy} onClick={() => saveLines(doc, { status: "answered" })}><CheckCheck size={14} /> {t("purchasing.priceRequests.markAnswered")}</button>
                    )}
                    <button type="button" className="btnCancel" disabled={busy} onClick={() => setStatus(doc, "rejected")}><XCircle size={14} /> {t("purchasing.priceRequests.reject")}</button>
                    {doc.status !== "draft" && (
                      <button type="button" className="btnPrimary" disabled={busy} onClick={() => convert(doc)}><ArrowRightCircle size={14} /> {t("purchasing.priceRequests.convert")}</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {emailDoc && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3>{t("purchasing.email.titleDp").replace("{number}", emailDoc.number)}</h3>
            <label className={styles.field}><span>{t("purchasing.email.to")} *</span>
              <input type="email" className={styles.input} value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} /></label>
            <label className={styles.field}><span>{t("purchasing.email.cc")}</span>
              <input className={styles.input} value={emailForm.cc} onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })} /></label>
            <label className={styles.field}><span>{t("purchasing.email.message")}</span>
              <textarea className={styles.input} rows={4} value={emailForm.message} placeholder={t("purchasing.email.defaultMessageHint")}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} /></label>
            <p className={styles.muted}><Paperclip size={12} /> {emailDoc.number}.pdf</p>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setEmailDoc(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy || !emailForm.to.trim()} onClick={sendEmail}><Mail size={14} /> {t("purchasing.email.send")}</button>
            </div>
          </div>
        </div>
      )}

      {comparison && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 900 }}>
            <h3><Scale size={16} /> {t("purchasing.compare.title")}</h3>
            <div className={styles.compareScroll}>
              <table className={styles.compareTable}>
                <thead>
                  <tr>
                    <th>{t("purchasing.lines.article")}</th>
                    <th>{t("purchasing.lines.quantity")}</th>
                    {comparison.totals.map((tt) => <th key={tt.priceRequestId}>{tt.supplier}<small>{tt.number}</small></th>)}
                  </tr>
                </thead>
                <tbody>
                  {comparison.lines.map((line, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={i}>
                      <td>{line.description}</td>
                      <td>{line.quantity} {line.unit || ""}</td>
                      {line.quotes.map((q) => (
                        <td key={q.priceRequestId} className={q.best ? styles.bestPrice : ""}>
                          {q.unitPrice === null ? <span className={styles.muted}>—</span> : formatMoney(q.unitPrice)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className={styles.compareTotal}>
                    <td colSpan={2}>{t("purchasing.totals.ttc")}</td>
                    {comparison.totals.map((tt) => (
                      <td key={tt.priceRequestId} className={tt.priceRequestId === comparison.cheapestId ? styles.bestPrice : ""}>
                        {tt.complete ? formatMoney(tt.totalTTC) : <span className={styles.muted}>{t("purchasing.compare.incomplete")}</span>}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td colSpan={2} />
                    {comparison.totals.map((tt) => (
                      <td key={tt.priceRequestId}>
                        {tt.status === "accepted" ? <StatusPill status="accepted" label={t("purchasing.priceStatus.accepted")} />
                          : tt.status === "rejected" ? <StatusPill status="rejected" label={t("purchasing.priceStatus.rejected")} />
                          : (
                            <button type="button" className="btnPrimary" disabled={busy || !tt.complete} onClick={() => chooseFromComparison(tt.priceRequestId)}>
                              {t("purchasing.compare.choose")}
                            </button>
                          )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.muted}>{t("purchasing.compare.hint")}</p>
            <div className={styles.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setComparison(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

