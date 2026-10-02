import { useEffect, useMemo, useState } from "react";
import { Truck, PackageCheck, Plus, Trash2, Scissors, PaintBucket, Handshake, Package } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import CustomSelect from "../useful/CustomSelect";
import SearchSelect from "../useful/SearchSelect";
import { getSuppliers } from "../../services/purchasingService";
import { getCatalogArticles } from "../../services/productionService";
import { issueMaterial, receiveTransfer, finishLaquage, subcontractOrder, getOffcuts } from "../../services/productionFlowService";
import { fmtQty, fmtMm, articleLabel } from "../../pages/production/prodShared";
import purch from "../../pages/purchasing/Purchasing.module.css";
import s from "../../pages/sales/Sales.module.css";
import styles from "../../pages/production/Production.module.css";

const errorOf = (err, t) => err.response?.data?.message || t("prod.errors.save");

function Modal({ title, icon: Icon, children, onClose, footer, wide = true }) {
  const { t } = useI18n();
  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={wide ? styles.modalWide : purch.modalCard} style={wide ? undefined : { maxWidth: 560 }}>
        <h3>{Icon && <Icon size={16} />} {title}</h3>
        {children}
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          {footer}
        </div>
      </div>
    </div>
  );
}

/** Offcuts used for one bar line: from the offcut stock, or pieces not recorded in it. */
function OffcutPicker({ mine, avail, onChange }) {
  const { t } = useI18n();
  const [manual, setManual] = useState({ length: "", quantity: 1 });
  const setOff = (_k, list) => onChange(list);
  const k = null; // single line: the parent keys the list
  return (
    <div className={styles.cutSettings} style={{ margin: "6px 0" }}>
      <h4><Scissors size={12} /> {t("flowUi.offcutsUsed")}</h4>
      {avail.length === 0 && <p className={s.muted} style={{ margin: "0 0 6px", fontSize: "0.76rem" }}>{t("flowUi.noOffcutStock")}</p>}
      {avail.map((o) => {
        const used = mine.find((x) => x.offcut === o._id)?.quantity || 0;
        return (
          <div key={o._id} className={s.inlineForm} style={{ marginBottom: 4 }}>
            <span className={s.grow}>{fmtMm(o.length)} mm · {t("flowUi.available")} {o.quantity}{o.location ? ` · ${o.location}` : ""}</span>
            <input type="number" min="0" max={o.quantity} step="1" value={used || ""} placeholder="0" style={{ width: 80 }}
              onChange={(e) => { const q = Math.min(o.quantity, Math.max(0, Math.round(Number(e.target.value) || 0))); setOff(k, [...mine.filter((x) => x.offcut !== o._id), ...(q ? [{ offcut: o._id, length: o.length, quantity: q }] : [])]); }} />
          </div>
        );
      })}
      {mine.filter((x) => !x.offcut).map((x, i) => (
        <div key={`m${i}`} className={s.inlineForm} style={{ marginBottom: 4 }}>
          <span className={s.grow}>{fmtMm(x.length)} mm × {x.quantity} <small className={s.muted}>({t("flowUi.notInStock")})</small></span>
          <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setOff(k, mine.filter((y) => y !== x))}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className={s.inlineForm}>
        <label>{t("flowUi.otherOffcut")} (mm)<input type="number" min="1" value={manual.length} onChange={(e) => setManual({ ...manual, length: e.target.value })} style={{ width: 100 }} /></label>
        <label>{t("prod.quantity")}<input type="number" min="1" step="1" value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })} style={{ width: 70 }} /></label>
        <button type="button" className="btnEdit" disabled={!(Number(manual.length) > 0)} onClick={() => { setOff(k, [...mine, { offcut: null, length: Number(manual.length), quantity: Math.max(1, Math.round(Number(manual.quantity) || 1)) }]); setManual({ length: "", quantity: 1 }); }}><Plus size={13} /></button>
      </div>
    </div>
  );
}

/**
 * Issue from stock: bars (+ offcuts) or accessories. Lines come from the
 * project flow; quantities default to what is left to issue — the person
 * writes what he really takes.
 */
export function IssueModal({ project, flow, category, onClose, onDone }) {
  const { t } = useI18n();
  const lines = category === "bars" ? flow.bars : flow.accessories;
  const [qty, setQty] = useState(() => Object.fromEntries(lines.map((l) => [`${l.order}|${l.need}`, l.toIssue > 0 ? String(category === "bars" ? Math.ceil(l.toIssue - 1e-9) : l.toIssue) : ""])));
  const [offcuts, setOffcuts] = useState({}); // key → [{ offcut?, length, quantity }]
  const [stockOffcuts, setStockOffcuts] = useState([]);
  const [openOff, setOpenOff] = useState(null);
  const [extras, setExtras] = useState([]);
  const [articles, setArticles] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const orders = flow.orders.filter((o) => ["planned", "in_progress", "draft"].includes(o.status));

  useEffect(() => {
    if (category !== "bars") return;
    const ids = [...new Set(lines.map((l) => l.product))];
    getOffcuts(project.company, ids.length ? { product: ids.join(",") } : {}).then(setStockOffcuts).catch(() => setStockOffcuts([]));
    getCatalogArticles(project.company, { materialType: "profile", variants: "true" }).then(setArticles).catch(() => setArticles([]));
  }, [category, project.company]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (category === "accessories") getCatalogArticles(project.company, { variants: "true" }).then(setArticles).catch(() => setArticles([]));
  }, [category, project.company]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const l of lines) {
      if (!m.has(l.order)) m.set(l.order, { order: l.order, number: l.orderNumber, workshop: l.workshop, color: l.workshopColor, kind: l.workshopKind, lines: [] });
      m.get(l.order).lines.push(l);
    }
    return [...m.values()];
  }, [lines]);

  const setOff = (key, list) => setOffcuts({ ...offcuts, [key]: list });
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const body = {
        category, note,
        lines: [
          ...lines.map((l) => { const k = `${l.order}|${l.need}`; return { order: l.order, need: l.need, quantity: Number(qty[k]) || 0, offcuts: offcuts[k] || [] }; }),
          ...extras.filter((x) => x.order && x.product).map((x) => ({ order: x.order, product: x.product, quantity: Number(x.quantity) || 0, offcuts: x.offcuts || [] })),
        ],
      };
      await issueMaterial(project._id, body);
      onDone();
    } catch (err) { setError(errorOf(err, t)); } finally { setBusy(false); }
  };

  return (
    <Modal title={category === "bars" ? t("flowUi.issueBars") : t("flowUi.issueAccessories")} icon={Truck} onClose={onClose}
      footer={<button type="button" className="btnPrimary" disabled={busy} onClick={submit}><Truck size={14} /> {t("flowUi.send")}</button>}>
      <p className={s.muted} style={{ marginTop: -4 }}>{category === "bars" ? t("flowUi.issueBarsHint") : t("flowUi.issueAccessoriesHint")}</p>
      {groups.length === 0 && <p className={s.muted}>{t("flowUi.nothingToIssue")}</p>}
      {groups.map((g) => (
        <section key={g.order} className={purch.section} style={{ marginTop: 10 }}>
          <h2 style={{ fontSize: "0.9rem" }}><i className={styles.dot} style={{ background: g.color }} /> {t("flowUi.to")} {g.workshop} <span className={s.muted}>· {g.number}</span></h2>
          <div className={styles.tableWrap}>
            <table className={styles.needTable}>
              <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.planned")}</th>{category === "bars" && <th className={styles.num}>{t("flowUi.viaLaquage")}</th>}<th className={styles.num}>{t("flowUi.alreadyIssued")}</th><th className={styles.num}>{t("prod.stock")}</th><th>{t("flowUi.issueNow")}</th></tr></thead>
              <tbody>
                {g.lines.map((l) => {
                  const k = `${l.order}|${l.need}`;
                  const offCount = (offcuts[k] || []).reduce((a, x) => a + x.quantity, 0);
                  return [
                    <tr key={k}>
                      <td>{l.name}{l.ref && <small>{l.ref}</small>}{l.finish && <small><i className={styles.dot} style={{ background: l.finish.color }} /> {l.finish.code}</small>}</td>
                      <td className={styles.num}>{fmtQty(l.planned)} {l.unit}</td>
                      {category === "bars" && <td className={styles.num}>{l.comingFromLaq ? fmtQty(l.comingFromLaq) : "—"}</td>}
                      <td className={styles.num}>{fmtQty(l.issued)}</td>
                      <td className={`${styles.num} ${l.stock < (Number(qty[k]) || 0) ? s.bad : ""}`}>{fmtQty(l.stock)}</td>
                      <td>
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input type="number" min="0" step={category === "bars" ? "1" : "any"} value={qty[k] ?? ""} placeholder="0" onChange={(e) => setQty({ ...qty, [k]: e.target.value })} />
                          {category === "bars" && <button type="button" className="btnEdit" style={{ whiteSpace: "nowrap" }} onClick={() => setOpenOff(openOff === k ? null : k)}><Scissors size={13} /> {offCount ? `${offCount} ${t("flowUi.offcutsShort")}` : t("flowUi.offcutsShort")}</button>}
                        </span>
                      </td>
                    </tr>,
                    openOff === k && <tr key={`${k}-off`}><td colSpan={6}><OffcutPicker mine={offcuts[k] || []} avail={stockOffcuts.filter((o) => String(o.product?._id || o.product) === String(l.product))} onChange={(list) => setOff(k, list)} /></td></tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {/* Something not planned: e.g. lacquered bars to re-lacquer, an extra accessory */}
      <h4 className={purch.subTitle}>{t("flowUi.extra")}</h4>
      <p className={s.muted} style={{ margin: "0 0 6px", fontSize: "0.78rem" }}>{category === "bars" ? t("flowUi.extraBarsHint") : t("flowUi.extraHint")}</p>
      {extras.map((x, i) => (
        <div key={i} className={styles.gridRow} style={{ gridTemplateColumns: "1fr 2fr 0.6fr 34px", marginBottom: 6 }}>
          <CustomSelect value={x.order} onSelect={(v) => setExtras(extras.map((y, j) => (j === i ? { ...y, order: v } : y)))} options={orders.map((o) => ({ value: o._id, label: `${o.workshop?.name} · ${o.number}` }))} placeholder={t("flowUi.destination")} />
          <SearchSelect value={x.product} onSelect={(v) => setExtras(extras.map((y, j) => (j === i ? { ...y, product: v } : y)))} options={articles.map((a) => ({ value: a._id, label: `${articleLabel(a)} · ${t("prod.stock")} ${fmtQty(a.quantity)}` }))} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} />
          <input className={purch.input} type="number" min="0" step="any" value={x.quantity} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, quantity: e.target.value } : y)))} />
          <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setExtras(extras.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" className="btnEdit" onClick={() => setExtras([...extras, { order: orders.find((o) => (category === "bars" ? o.kind === "laquage" : o.kind === "aluminium"))?._id || orders[0]?._id || "", product: "", quantity: 1 }])}><Plus size={14} /> {t("flowUi.addLine")}</button>
      <label className={purch.field} style={{ marginTop: 10 }}>{t("prod.order.note")}<input className={purch.input} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {error && <div className="errorMessage" style={{ marginTop: 8 }}>{error}</div>}
    </Modal>
  );
}

/** Reception of a transfer: received quantities (default = sent) + a note for any gap. */
export function ReceiveModal({ transfer, onClose, onDone }) {
  const { t } = useI18n();
  const [rec, setRec] = useState(() => Object.fromEntries(transfer.lines.map((l) => [l._id, String(l.quantity)])));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await receiveTransfer(transfer._id, { note, lines: transfer.lines.map((l) => ({ line: l._id, receivedQty: rec[l._id] })) });
      onDone();
    } catch (err) { setError(errorOf(err, t)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${t("flowUi.receive")} — ${transfer.number}`} icon={PackageCheck} onClose={onClose} wide={false}
      footer={<button type="button" className="btnPrimary" disabled={busy} onClick={submit}><PackageCheck size={14} /> {t("flowUi.confirmReception")}</button>}>
      <p className={s.muted} style={{ marginTop: -4 }}>{t(`flowUi.categories.${transfer.category}`)} · {transfer.fromWorkshop?.name || t("flowUi.stock")} → {transfer.toWorkshop?.name}</p>
      <table className={styles.needTable}>
        <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("flowUi.sent")}</th><th>{t("flowUi.received")}</th></tr></thead>
        <tbody>
          {transfer.lines.map((l) => (
            <tr key={l._id}>
              <td>{l.ref && <strong>{l.ref} </strong>}{l.label}{l.L && l.H ? <small>{fmtMm(l.L)} × {fmtMm(l.H)} mm</small> : null}{(l.offcuts || []).length > 0 && <small><Scissors size={11} /> {l.offcuts.map((x) => `${fmtMm(x.length)} mm × ${x.quantity}`).join(", ")}</small>}</td>
              <td className={styles.num}>{fmtQty(l.quantity)} {l.unit}</td>
              <td><input type="number" min="0" step="any" value={rec[l._id]} onChange={(e) => setRec({ ...rec, [l._id]: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className={purch.field} style={{ marginTop: 10 }}>{t("flowUi.receptionNote")}<input className={purch.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("flowUi.receptionNotePh")} /></label>
      {error && <div className="errorMessage" style={{ marginTop: 8 }}>{error}</div>}
    </Modal>
  );
}

/** Laquage done: how many kg of powder — that's it (lacquered quantities adjustable if needed). */
export function FinishLaquageModal({ order, onClose, onDone }) {
  const { t } = useI18n();
  const powder = order.powder || [];
  const [kg, setKg] = useState(() => Object.fromEntries(powder.map((p) => [p._id, ""])));
  const [produced, setProduced] = useState(() => Object.fromEntries((order.outputs || []).map((o) => [o._id, String(o.quantity)])));
  const [showAdjust, setShowAdjust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = powder.every((p) => kg[p._id] !== "" && Number(kg[p._id]) >= 0);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await finishLaquage(order._id, {
        powder: powder.map((p) => ({ need: p._id, kg: Number(kg[p._id]) })),
        outputs: (order.outputs || []).map((o) => ({ output: o._id, produced: Number(produced[o._id]) || 0, rejected: Math.max(0, (o.quantity || 0) - (Number(produced[o._id]) || 0)) })),
      });
      onDone();
    } catch (err) { setError(errorOf(err, t)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${t("flowUi.finishLaquage")} — ${order.number}`} icon={PaintBucket} onClose={onClose} wide={false}
      footer={<button type="button" className="btnPrimary" disabled={busy || !ready} onClick={submit}><PaintBucket size={14} /> {t("flowUi.finishAndSend")}</button>}>
      {powder.map((p) => (
        <label key={p._id} className={purch.field}>{t("flowUi.powderUsed")} — {p.product || p.label} (kg)
          <input className={purch.input} type="number" min="0" step="0.01" autoFocus value={kg[p._id]} placeholder={p.theoretical ? `${t("prod.planned")} ${fmtQty(p.theoretical, 2)}` : ""} onChange={(e) => setKg({ ...kg, [p._id]: e.target.value })} />
        </label>
      ))}
      <p className={s.muted} style={{ fontSize: "0.8rem" }}>{t("flowUi.finishLaquageHint")}</p>
      <button type="button" className="btnEdit" onClick={() => setShowAdjust(!showAdjust)}>{t("flowUi.adjustLacquered")}</button>
      {showAdjust && (order.outputs || []).map((o) => (
        <div key={o._id} className={s.inlineForm} style={{ marginTop: 6 }}>
          <span className={s.grow}>{o.variant?.name || o.product?.name}</span>
          <label>{t("flowUi.lacqueredOk")}<input type="number" min="0" step="1" value={produced[o._id]} onChange={(e) => setProduced({ ...produced, [o._id]: e.target.value })} /></label>
        </div>
      ))}
      {error && <div className="errorMessage" style={{ marginTop: 8 }}>{error}</div>}
    </Modal>
  );
}

/** Sub-contract a step: a draft purchase order to the supplier (prices completed by purchasing). */
export function SubcontractModal({ order, companyId, onClose, onDone }) {
  const { t } = useI18n();
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getSuppliers(companyId, { active: "true" }).then(setSuppliers).catch(() => setSuppliers([])); }, [companyId]);
  const submit = async () => {
    setBusy(true);
    setError("");
    try { const r = await subcontractOrder(order._id, { supplier, note }); onDone(r); } catch (err) { setError(errorOf(err, t)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${t("flowUi.subcontract")} — ${order.workshop?.name} · ${order.number}`} icon={Handshake} onClose={onClose} wide={false}
      footer={<button type="button" className="btnPrimary" disabled={busy || !supplier} onClick={submit}><Handshake size={14} /> {t("flowUi.createPo")}</button>}>
      <p className={s.muted} style={{ marginTop: -4 }}>{t("flowUi.subcontractHint")}</p>
      <label className={purch.field}>{t("flowUi.supplier")}<SearchSelect value={supplier} onSelect={setSupplier} options={suppliers.map((x) => ({ value: x._id, label: x.name }))} placeholder={t("flowUi.pickSupplier")} noResultsLabel={t("common.noResults")} /></label>
      <label className={purch.field}>{t("prod.order.note")}<input className={purch.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("flowUi.subcontractNotePh")} /></label>
      {error && <div className="errorMessage" style={{ marginTop: 8 }}>{error}</div>}
    </Modal>
  );
}
