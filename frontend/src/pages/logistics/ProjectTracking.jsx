import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Hammer, PackageCheck, Truck, Wrench, BadgeCheck, RefreshCw, Scissors, Ban, History, AlertTriangle, X, Plus, Trash2, FileText } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import { canAccessLogistics } from "../../utils/permissions";
import { getProjectTracking, syncProjectTracking, trackingAction, updateUnitParts, cancelUnit, openDeliveryNotePdf } from "../../services/logisticsService";
import { STAGE_COLORS, NOTE_PILL, PART_KINDS, fmtQty, formatDate } from "./logisticsShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Logistics.module.css";

const FILTERS = ["all", "to_make", "in_production", "made", "ready", "partially_delivered", "delivered", "installed", "modified", "cancelled"];

export function StageChip({ stage }) {
  const { t } = useI18n();
  return <span className={styles.stageChip}><i className={styles.stageDot} style={{ background: STAGE_COLORS[stage] }} />{t(`logi.stages.${stage}`)}</span>;
}

/** The 5-step pipeline (made → ready → delivered → installed → received). */
export function Pipeline({ summary }) {
  const { t } = useI18n();
  return (
    <div className={styles.pipeline}>
      {["made", "ready", "delivered", "installed", "received"].map((k) => (
        <div key={k} className={styles.pipeStep}>
          <span>{t(`logi.pipeline.${k}`)}</span>
          <strong>{summary.counts[k]} / {summary.units}</strong> <small className={s.muted}>{summary.percent[k]}%</small>
          <div className={styles.mini}><i style={{ width: `${summary.percent[k]}%`, background: STAGE_COLORS[k] }} /></div>
        </div>
      ))}
    </div>
  );
}

/**
 * Suivi des châssis of one project: every chassis (F1-1, F1-2…) with its
 * parts (frame, sashes, glass, modules…) and their stage. Select whole
 * chassis or single parts, then: made / ready / installed / received (or
 * undo), create a delivery note, edit a chassis breakdown, cancel one.
 */
export default function ProjectTracking({ projectId, onChanged }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState({}); // unitId → true (whole) | { partId: true }
  const [qty, setQty] = useState(null); // { action } → quantity dialog for one part
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);

  const load = useCallback(async () => {
    try { setData(await getProjectTracking(projectId)); } catch (err) { setError(err.response?.data?.message || t("logi.errors.load")); }
  }, [projectId, t]);
  useEffect(() => { load(); }, [load]);

  const units = useMemo(() => {
    if (!data) return [];
    return data.units.filter((u) => {
      if (filter === "all") return !u.cancelled;
      if (filter === "cancelled") return u.cancelled;
      if (filter === "modified") return u.modified && !u.cancelled;
      return !u.cancelled && (u.status === filter || u.parts.some((p) => p.status === filter));
    });
  }, [data, filter]);

  if (!data) return error ? <div className="errorMessage">{error}</div> : <p className={s.muted}>{t("common.loading")}</p>;
  const canUpdate = data.canUpdate;
  // Which buttons: production marks started / made / ready, logistics installed / accepted.
  const perm = data.can || { production: canUpdate, logistics: canUpdate, parts: canUpdate, cancel: data.canCancel, deliver: canAccessLogistics(user) };
  const LOGI = ["installed", "received", "uninstalled", "unreceived"];
  const allowed = (a) => (LOGI.includes(a) ? perm.logistics : perm.production);

  const targets = () => Object.entries(sel).flatMap(([unit, v]) => (v === true ? [{ unit }] : Object.keys(v).filter((k) => v[k]).map((part) => ({ unit, part }))));
  const count = targets().length;
  const isUnitSel = (u) => sel[u._id] === true;
  const isPartSel = (u, p) => sel[u._id] === true || !!sel[u._id]?.[p._id];
  const toggleUnit = (u) => setSel((x) => { const n = { ...x }; if (n[u._id] === true) delete n[u._id]; else n[u._id] = true; return n; });
  const togglePart = (u, p) => setSel((x) => {
    const n = { ...x };
    const cur = n[u._id] === true ? Object.fromEntries(u.parts.filter((q) => !q.cancelled).map((q) => [q._id, true])) : { ...(n[u._id] || {}) };
    if (cur[p._id]) delete cur[p._id]; else cur[p._id] = true;
    if (!Object.keys(cur).length) delete n[u._id]; else n[u._id] = cur;
    return n;
  });
  const selectAll = () => setSel(Object.fromEntries(units.filter((u) => !u.cancelled).map((u) => [u._id, true])));
  const selectKind = (kinds) => setSel(Object.fromEntries(units.filter((u) => !u.cancelled).map((u) => [u._id, Object.fromEntries(u.parts.filter((p) => !p.cancelled && kinds.includes(p.kind)).map((p) => [p._id, true]))]).filter(([, v]) => Object.keys(v).length)));

  const run = async (fn, okKey) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (okKey) setNotice(t(okKey));
      await load();
      onChanged?.();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || t("logi.errors.save"));
      return false;
    } finally { setBusy(false); }
  };
  const act = (action, list = targets()) => run(() => trackingAction(projectId, action, list), "logi.done").then((ok) => ok && setSel({}));

  // Delivery note from the selection: every selected part with what's available.
  const toDeliveryNote = () => {
    const lines = [];
    for (const tg of targets()) {
      const u = data.units.find((x) => x._id === tg.unit);
      for (const p of u.parts.filter((q) => (tg.part ? q._id === tg.part : !q.cancelled))) if (p.available > 0) lines.push({ unit: u._id, part: p._id, quantity: p.available });
    }
    if (!lines.length) return setError(t("logi.nothingAvailable"));
    navigate("/logistics/delivery-notes/new", { state: { projectId, lines } });
  };

  return (
    <>
      <Pipeline summary={data.summary} />
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      {data.summary.modified > 0 && <div className={purch.infoBanner}><AlertTriangle size={14} /> {t("logi.modifiedBanner").replace("{n}", data.summary.modified)}</div>}

      <div className={purch.sectionHeader}>
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className={filter === f ? s.tabActive : s.tab} style={{ borderRadius: 8, border: "1px solid var(--color-border)" }} onClick={() => setFilter(f)}>
              {f === "all" ? t("sales.all") : f === "modified" ? t("logi.modified") : t(`logi.stages.${f}`)}
              {f !== "all" && <span className={s.count}>{f === "modified" ? data.summary.modified : f === "cancelled" ? data.summary.cancelled : data.summary[f] || 0}</span>}
            </button>
          ))}
        </div>
        {canUpdate && <button type="button" className="btnEdit" disabled={busy} onClick={() => run(() => syncProjectTracking(projectId), "logi.synced")} title={t("logi.syncHint")}><RefreshCw size={14} /> {t("logi.sync")}</button>}
      </div>

      {canUpdate && (
        <div className={styles.filters}>
          <span className={s.muted}>{t("logi.select")}</span>
          <button type="button" className={styles.partChip} onClick={selectAll}>{t("logi.selectAll")}</button>
          <button type="button" className={styles.partChip} onClick={() => selectKind(["frame", "complete"])}>{t("logi.selectFrames")}</button>
          <button type="button" className={styles.partChip} onClick={() => selectKind(["sash", "screen"])}>{t("logi.selectSashes")}</button>
          <button type="button" className={styles.partChip} onClick={() => selectKind(["glass", "module"])}>{t("logi.selectGlass")}</button>
          {count > 0 && <button type="button" className={styles.partChip} onClick={() => setSel({})}><X size={11} /> {t("logi.clear")}</button>}
        </div>
      )}

      {units.length === 0 ? <p className={s.muted}>{data.units.length ? t("logi.noneForFilter") : t("logi.noUnits")}</p> : (
        <div className={purch.card} style={{ overflowX: "auto" }}>
          <table className={styles.unitTable}>
            <thead><tr>{canUpdate && <th />}<th>{t("prod.ref")}</th><th>{t("prod.model")}</th><th>L × H</th><th>{t("logi.status")}</th><th>{t("logi.parts")}</th><th /></tr></thead>
            <tbody>
              {units.map((u, i) => {
                const prev = units[i - 1];
                const group = !prev || String(prev.projectItem) !== String(u.projectItem);
                return (
                  <Fragment key={u._id}>
                    {group && <tr className={styles.groupRow}><td colSpan={canUpdate ? 7 : 6}>{u.ref.replace(/-\d+$/, "")} · {u.label}</td></tr>}
                    <tr className={u.cancelled ? styles.cancelledRow : ""}>
                      {canUpdate && <td>{!u.cancelled && <input type="checkbox" checked={isUnitSel(u)} onChange={() => toggleUnit(u)} />}</td>}
                      <td>
                        <strong>{u.ref}</strong>
                        {u.modified && <span className={styles.flag} title={t("logi.modifiedHint")}><AlertTriangle size={10} /> {t("logi.modified")}</span>}
                        {u.cancelled && <span className={`${styles.flag} ${styles.flagBad}`}>{t("logi.stages.cancelled")}</span>}
                      </td>
                      <td>{u.model?.name || u.label}{u.finish && <small className={s.muted} style={{ display: "block" }}><i className={styles.stageDot} style={{ background: u.finish.color }} />{u.finish.code}</small>}</td>
                      <td>{Math.round(u.L)} × {Math.round(u.H)}</td>
                      <td><StageChip stage={u.status} /></td>
                      <td>
                        <div className={styles.parts}>
                          {u.parts.map((p) => (
                            <button key={p._id} type="button" disabled={p.cancelled || !canUpdate}
                              className={`${styles.partChip} ${isPartSel(u, p) ? styles.partChipSelected : ""} ${p.cancelled ? styles.partChipCancelled : ""}`}
                              onClick={() => togglePart(u, p)}
                              title={`${t("logi.startedShort")} ${fmtQty(p.startedQty)} · ${t("logi.pipeline.made")} ${fmtQty(p.madeQty)} · ${t("logi.pipeline.ready")} ${fmtQty(p.readyQty)} · ${t("logi.pipeline.delivered")} ${fmtQty(p.deliveredQty)} · ${t("logi.pipeline.installed")} ${fmtQty(p.installedQty)}${p.reserved ? ` · ${t("logi.reservedOn")} ${p.reservedOn.join(", ")}` : ""}`}>
                              <i className={styles.stageDot} style={{ background: STAGE_COLORS[p.status] }} />
                              {p.label}{p.quantity !== 1 && <small>×{fmtQty(p.quantity)}</small>}
                              {p.deliveredQty > 0 && p.deliveredQty < p.quantity && <small>({fmtQty(p.deliveredQty)} {t("logi.deliveredShort")})</small>}
                              {p.reserved > 0 && <Truck size={11} />}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="dataTableActions">
                        <button type="button" className="tableActionBtn" title={t("logi.history")} onClick={() => setHistoryOf(u)}><History size={14} /></button>
                        {perm.parts && !u.cancelled && <button type="button" className="tableActionBtn" title={t("logi.editParts")} onClick={() => setEditing({ unit: u, parts: u.parts.filter((p) => !p.cancelled).map((p) => ({ ...p })) })}><Scissors size={14} /></button>}
                        {perm.cancel && !u.cancelled && (
                          <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("logi.cancelUnit")} onClick={() => {
                            const reason = window.prompt(t("logi.cancelPrompt").replace("{ref}", u.ref));
                            if (reason !== null) run(() => cancelUnit(u._id, reason), "logi.cancelled");
                          }}><Ban size={14} /></button>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canUpdate && count > 0 && (
        <div className={styles.actionBar}>
          <strong>{t("logi.selected").replace("{n}", count)}</strong>
          {perm.production && <button type="button" className="btnEdit" disabled={busy} onClick={() => act("started")}><Play size={14} /> {t("logi.actions.started")}</button>}
          {perm.production && <button type="button" className="btnEdit" disabled={busy} onClick={() => act("made")}><Hammer size={14} /> {t("logi.actions.made")}</button>}
          {perm.production && <button type="button" className="btnEdit" disabled={busy} onClick={() => act("ready")}><PackageCheck size={14} /> {t("logi.actions.ready")}</button>}
          {perm.deliver && <button type="button" className="btnPrimary" disabled={busy} onClick={toDeliveryNote}><Truck size={14} /> {t("logi.actions.deliver")}</button>}
          {perm.logistics && <button type="button" className="btnEdit" disabled={busy} onClick={() => act("installed")}><Wrench size={14} /> {t("logi.actions.installed")}</button>}
          {perm.logistics && <button type="button" className="btnEdit" disabled={busy} onClick={() => act("received")}><BadgeCheck size={14} /> {t("logi.actions.received")}</button>}
          {count === 1 && targets()[0].part && <button type="button" className="btnEdit" disabled={busy} onClick={() => setQty({ action: perm.production ? "ready" : "installed", quantity: 1 })}>{t("logi.partial")}</button>}
          <CustomSelect value="" placeholder={t("logi.undo")} onSelect={(v) => v && act(v)}
            options={["unstarted", "unmade", "unready", "uninstalled", "unreceived", "clear_modified"].filter(allowed).map((a) => ({ value: a, label: t(`logi.actions.${a}`) }))} />
        </div>
      )}

      {data.deliveryNotes.length > 0 && (
        <section className={purch.section}>
          <h2>{t("logi.deliveryNotes")}</h2>
          <div className="dataTable">
            {data.deliveryNotes.map((n) => (
              <div key={n._id} className={`dataTableRow ${purch.clickableRow}`} style={{ gridTemplateColumns: "130px 110px 1fr 90px 130px 40px" }}
                role="button" tabIndex={0} onClick={() => navigate(`/logistics/delivery-notes/${n._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/logistics/delivery-notes/${n._id}`)}>
                <span><strong>{n.number}</strong></span>
                <span>{formatDate(n.deliveredAt || n.date)}</span>
                <span className="dataTableCellMuted">{(n.refs || []).join(", ")}</span>
                <span>{fmtQty(n.pieces)} {t("logi.pieces")}</span>
                <span><StatusPill status={NOTE_PILL[n.status]} label={t(`logi.noteStatus.${n.status}`)} /></span>
                <span onClick={(e) => e.stopPropagation()} role="presentation"><button type="button" className="tableActionBtn" onClick={() => openDeliveryNotePdf(n._id)}><FileText size={14} /></button></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {qty && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <div className={purch.modalCard}>
            <h3>{t("logi.partialTitle")}</h3>
            <label className={purch.field}>{t("logi.action")}
              <CustomSelect value={qty.action} onSelect={(v) => setQty({ ...qty, action: v })} options={["started", "made", "ready", "installed", "unstarted", "unmade", "unready", "uninstalled"].filter(allowed).map((a) => ({ value: a, label: t(`logi.actions.${a}`) }))} />
            </label>
            <label className={purch.field}>{t("prod.quantity")}<input className={purch.input} type="number" min="0.001" step="any" value={qty.quantity} onChange={(e) => setQty({ ...qty, quantity: e.target.value })} /></label>
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setQty(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" onClick={async () => { const ok = await act(qty.action, targets().map((x) => ({ ...x, quantity: Number(qty.quantity) }))); if (ok !== false) setQty(null); }}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <div className={purch.modalCard} style={{ maxWidth: 640 }}>
            <h3>{t("logi.editPartsTitle").replace("{ref}", editing.unit.ref)}</h3>
            <p className={s.muted}>{t("logi.editPartsHint")}</p>
            {editing.parts.map((p, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={p._id || i} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 80px 34px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                <input className={purch.input} value={p.label} onChange={(e) => setEditing({ ...editing, parts: editing.parts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <CustomSelect value={p.kind} onSelect={(v) => setEditing({ ...editing, parts: editing.parts.map((x, j) => (j === i ? { ...x, kind: v } : x)) })} options={PART_KINDS.map((k) => ({ value: k, label: t(`logi.kinds.${k}`) }))} />
                <input className={purch.input} type="number" min="0.001" step="any" value={p.quantity} onChange={(e) => setEditing({ ...editing, parts: editing.parts.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)) })} />
                <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setEditing({ ...editing, parts: editing.parts.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                {p._id && (p.startedQty > 0 || p.madeQty > 0 || p.deliveredQty > 0) && <small className={s.muted} style={{ gridColumn: "1 / -1", marginTop: -4 }}>{t("logi.partProgress").replace("{made}", fmtQty(p.madeQty)).replace("{delivered}", fmtQty(p.deliveredQty))}</small>}
              </div>
            ))}
            <div className={styles.filters}>
              <button type="button" className="btnEdit" onClick={() => setEditing({ ...editing, parts: [...editing.parts, { label: "", kind: "other", quantity: 1 }] })}><Plus size={14} /> {t("logi.addPart")}</button>
              {editing.parts.some((p) => !p._id || p.madeQty === 0) && editing.parts.some((p) => Number(p.quantity) > 1 && Number.isInteger(Number(p.quantity)) && !(p.madeQty > 0 || p.deliveredQty > 0)) && (
                <button type="button" className="btnEdit" onClick={() => setEditing({
                  ...editing,
                  parts: editing.parts.flatMap((p) => (Number(p.quantity) > 1 && Number.isInteger(Number(p.quantity)) && !(p.madeQty > 0 || p.deliveredQty > 0)
                    ? Array.from({ length: Number(p.quantity) }, (_, k) => (k === 0 ? { ...p, quantity: 1, label: `${p.label} ${k + 1}` } : { label: `${p.label} ${k + 1}`, kind: p.kind, quantity: 1 }))
                    : [p])),
                })}><Scissors size={14} /> {t("logi.onePerPiece")}</button>
              )}
              {editing.parts.length === 1 && editing.parts[0].quantity > 1 && (
                <button type="button" className="btnEdit" onClick={() => {
                  const p = editing.parts[0];
                  const half = Math.ceil(p.quantity / 2);
                  setEditing({ ...editing, parts: [{ ...p, quantity: half, label: `${p.label} (1)` }, { label: `${p.label} (2)`, kind: p.kind, quantity: p.quantity - half }] });
                }}><Scissors size={14} /> {t("logi.splitInTwo")}</button>
              )}
            </div>
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" onClick={async () => {
                const ok = await run(() => updateUnitParts(editing.unit._id, editing.parts.map((p) => ({ _id: p._id, label: p.label, kind: p.kind, quantity: Number(p.quantity), notes: p.notes }))), "logi.partsSaved");
                if (ok) setEditing(null);
              }}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      {historyOf && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true" onClick={() => setHistoryOf(null)}>
          <div className={purch.modalCard} style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()} role="presentation">
            <h3>{t("logi.historyTitle").replace("{ref}", historyOf.ref)}</h3>
            <ul className={styles.timeline}>
              {[...historyOf.history].reverse().map((h, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={i}><strong>{t(`logi.historyActions.${h.action}`, h.action)}</strong> · {new Date(h.at).toLocaleString("fr-FR")}{h.by ? ` · ${`${h.by.firstName || ""} ${h.by.lastName || ""}`.trim() || h.by.email}` : ""}{h.note ? ` — ${h.note}` : ""}</li>
              ))}
            </ul>
            <div className={purch.modalActions}><button type="button" className="btnCancel" onClick={() => setHistoryOf(null)}>{t("common.close", "OK")}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
