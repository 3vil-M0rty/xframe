import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Truck, Save, FileText, Send, CheckCircle2, XCircle, Trash2, Plus, CalendarCheck, AlertTriangle } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import { getProjects } from "../../services/projectService";
import {
  getDeliveryNote, createDeliveryNote, updateDeliveryNote, setDeliveryNoteStatus, deleteDeliveryNote, openDeliveryNotePdf, getProjectTracking,
} from "../../services/logisticsService";
import { useCompanyPicker, formatDate, toInputDate, fmtQty, NOTE_PILL, STAGE_COLORS } from "./logisticsShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Logistics.module.css";
import { useDialog } from "../../components/useful/DialogProvider";

const emptyTransport = { mode: "own", carrier: "", vehicle: "", driver: "", driverPhone: "", trackingRef: "", cost: 0 };

/**
 * Bon de livraison: create (from "À livrer" / a project's tracking, or
 * from scratch), edit while draft / planned, then plan → ship → mark
 * delivered (received by, reserves) or cancel (a delivered note cancelled
 * = goods returned). Lines are chassis PARTS with quantities, so a note
 * can carry frames only, sashes + glass, some curtain-wall modules…
 */
export default function DeliveryNoteForm() {
  const dialog = useDialog();
  const can = useCan();
  const { id } = useParams();
  const isNew = !id || id === "new";
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { companyId: pickedCompany } = useCompanyPicker();
  const companyId = location.state?.companyId || pickedCompany;
  const [note, setNote] = useState(null);
  const [form, setForm] = useState(null);
  const [units, setUnits] = useState([]);
  const [qty, setQty] = useState({}); // "unit|part" → quantity
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliverDialog, setDeliverDialog] = useState(null);

  const loadProjectUnits = useCallback(async (projectId) => {
    const tr = await getProjectTracking(projectId);
    setUnits(tr.units.filter((u) => !u.cancelled));
  }, []);

  const load = useCallback(async () => {
    try {
      if (isNew) {
        const projectId = location.state?.projectId || "";
        setForm({ project: projectId, date: toInputDate(new Date(Date.now() + 86400000)), timeSlot: "", address: "", siteContact: "", sitePhone: "", transport: { ...emptyTransport }, packages: "", weightKg: "", notes: "", internalNotes: "", extraLines: [], status: "draft" });
        if (projectId) await loadProjectUnits(projectId);
        setQty(Object.fromEntries((location.state?.lines || []).map((l) => [`${l.unit}|${l.part}`, l.quantity])));
      } else {
        const n = await getDeliveryNote(id);
        setNote(n);
        setForm({
          project: n.project._id, date: toInputDate(n.date), timeSlot: n.timeSlot || "", address: n.address || "", siteContact: n.siteContact || "", sitePhone: n.sitePhone || "",
          transport: { ...emptyTransport, ...(n.transport || {}) }, packages: n.packages ?? "", weightKg: n.weightKg ?? "", notes: n.notes || "", internalNotes: n.internalNotes || "",
          extraLines: (n.extraLines || []).map((e) => ({ label: e.label, quantity: e.quantity, unit: e.unit })), status: n.status,
        });
        setUnits(n.units.filter((u) => !u.cancelled));
        setQty(Object.fromEntries(n.lines.map((l) => [`${l.unit}|${l.part}`, l.quantity])));
      }
    } catch (err) { setError(err.response?.data?.message || t("logi.errors.load")); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isNew && companyId && !location.state?.projectId) getProjects({ companyId, status: "active" }).then(setProjects).catch(() => setProjects([]));
  }, [isNew, companyId, location.state?.projectId]);

  const editable = isNew || ["draft", "planned"].includes(note?.status);
  // The server computes `available` without this note's own lines, so they stay editable.
  const maxFor = (u, p) => p.available;
  const lines = useMemo(() => Object.entries(qty).filter(([, q]) => Number(q) > 0).map(([k, q]) => { const [unit, part] = k.split("|"); return { unit, part, quantity: Number(q) }; }), [qty]);
  const pieces = lines.reduce((a, l) => a + l.quantity, 0);

  if (!form) return <div className="pageShell">{error && <div className="errorMessage">{error}</div>}</div>;
  const setT = (k, v) => setForm({ ...form, transport: { ...form.transport, [k]: v } });
  const body = () => ({
    project: form.project, date: form.date, timeSlot: form.timeSlot, address: form.address, siteContact: form.siteContact, sitePhone: form.sitePhone,
    transport: { ...form.transport, cost: Number(form.transport.cost) || 0 }, packages: form.packages === "" ? null : Number(form.packages), weightKg: form.weightKg === "" ? null : Number(form.weightKg),
    notes: form.notes, internalNotes: form.internalNotes, extraLines: form.extraLines.filter((e) => e.label), lines,
  });

  const run = async (fn, okKey) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fn();
      if (okKey) setNotice(t(okKey));
      return r || true;
    } catch (err) {
      setError(err.response?.data?.message || t("logi.errors.save"));
      return null;
    } finally { setBusy(false); }
  };
  const save = async (status) => {
    const r = await run(async () => (isNew ? createDeliveryNote({ ...body(), status }) : updateDeliveryNote(id, body())), "logi.saved");
    if (r && isNew) navigate(`/logistics/delivery-notes/${r._id}`, { replace: true });
    else if (r) { if (status === "planned" && note.status === "draft") await run(() => setDeliveryNoteStatus(id, { status: "planned" })); load(); }
  };
  const status = async (next, extra = {}) => {
    if (editable && !isNew && ["planned", "shipped", "delivered"].includes(next)) {
      const saved = await run(() => updateDeliveryNote(id, body()));
      if (!saved) return;
    }
    const r = await run(() => setDeliveryNoteStatus(id, { status: next, ...extra }), `logi.noteStatusDone.${next}`);
    if (r) { setDeliverDialog(null); load(); }
  };

  const pickKinds = (kinds) => setQty(Object.fromEntries(units.flatMap((u) => u.parts.filter((p) => maxFor(u, p) > 0 && (!kinds || kinds.includes(p.kind))).map((p) => [`${u._id}|${p._id}`, maxFor(u, p)]))));
  const deliverable = units.filter((u) => u.parts.some((p) => maxFor(u, p) > 0 || qty[`${u._id}|${p._id}`]));

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.logistics"), href: "/logistics/to-deliver" }, { label: t("logi.notes.title"), href: "/logistics/delivery-notes" }, { label: note?.number || t("logi.notes.new") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Truck size={20} /><h1>{note?.number || t("logi.notes.new")}</h1>
            {note && <StatusPill status={NOTE_PILL[note.status]} label={t(`logi.noteStatus.${note.status}`)} />}
          </div>
          <p className="pageSubtitle">{note ? `${note.project.number} — ${note.project.name}${note.customer ? ` · ${note.customer.name}` : ""}` : t("logi.notes.newHint")}</p>
        </div>
        <div className={purch.headerActions}>
          {note && <button type="button" className="btnEdit" onClick={() => openDeliveryNotePdf(id)}><FileText size={15} /> PDF</button>}
          {editable && can(isNew ? "logistics.notes.create" : "logistics.notes.edit") && <button type="button" className="btnEdit" disabled={busy || !form.project || !lines.length} onClick={() => save(isNew ? "draft" : undefined)}><Save size={15} /> {isNew ? t("logi.notes.saveDraft") : t("common.save")}</button>}
          {(isNew || note?.status === "draft") && can(isNew ? "logistics.notes.create" : "logistics.notes.ship") && <button type="button" className="btnPrimary" disabled={busy || !form.project || !lines.length} onClick={() => save("planned")}><CalendarCheck size={15} /> {t("logi.notes.plan")}</button>}
          {note && ["draft", "planned"].includes(note.status) && can("logistics.notes.ship") && <button type="button" className="btnEdit" disabled={busy} onClick={() => status("shipped")}><Send size={15} /> {t("logi.notes.ship")}</button>}
          {note && ["draft", "planned", "shipped"].includes(note.status) && can("logistics.notes.deliver") && <button type="button" className="btnPrimary" disabled={busy} onClick={() => setDeliverDialog({ receivedBy: form.siteContact || "", reserves: "", deliveredAt: toInputDate(new Date()) })}><CheckCircle2 size={15} /> {t("logi.notes.deliver")}</button>}
          {note && note.status !== "cancelled" && can("logistics.notes.cancel") && <button type="button" className="btnCancel" disabled={busy} onClick={async () => { const reason = await dialog.prompt({ message: t(note.status === "delivered" ? "logi.notes.returnPrompt" : "logi.notes.cancelPrompt"), multiline: true }); if (reason !== null) status("cancelled", { reason }); }}><XCircle size={15} /> {note.status === "delivered" ? t("logi.notes.return") : t("common.cancel")}</button>}
          {note?.status === "draft" && can("logistics.notes.delete") && <button type="button" className="btnDelete" disabled={busy} onClick={async () => { if ((await dialog.confirm(t("logi.notes.deleteConfirm"))) && (await run(() => deleteDeliveryNote(id)))) navigate("/logistics/delivery-notes"); }}><Trash2 size={15} /></button>}
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      {note?.status === "delivered" && (
        <div className={purch.infoBanner}>
          <CheckCircle2 size={14} /> {t("logi.notes.deliveredOn").replace("{date}", formatDate(note.deliveredAt))}{note.receivedBy ? ` · ${t("logi.notes.receivedBy")} ${note.receivedBy}` : ""}
          {note.reserves && <><br /><AlertTriangle size={14} /> {t("logi.notes.reserves")} : {note.reserves}</>}
        </div>
      )}

      {isNew && !location.state?.projectId && (
        <div className={purch.formGrid}>
          <label className={purch.field}>{t("sales.project")}
            <CustomSelect value={form.project} placeholder={t("logi.notes.pickProject")} onSelect={async (v) => { setForm({ ...form, project: v }); setQty({}); await loadProjectUnits(v); }}
              options={projects.map((p) => ({ value: p._id, label: `${p.number} — ${p.name}` }))} />
          </label>
        </div>
      )}

      <section className={purch.section}>
        <h2>{t("logi.notes.delivery")}</h2>
        <div className={styles.transportGrid}>
          <label className={purch.field}>{t("logi.notes.date")}<input className={purch.input} type="date" disabled={!editable} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className={purch.field}>{t("logi.notes.timeSlot")}<input className={purch.input} disabled={!editable} value={form.timeSlot} placeholder="8h–10h" onChange={(e) => setForm({ ...form, timeSlot: e.target.value })} /></label>
          <label className={purch.field} style={{ gridColumn: "span 2" }}>{t("logi.notes.address")}<input className={purch.input} disabled={!editable} value={form.address} placeholder={t("logi.notes.addressPh")} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className={purch.field}>{t("logi.notes.siteContact")}<input className={purch.input} disabled={!editable} value={form.siteContact} onChange={(e) => setForm({ ...form, siteContact: e.target.value })} /></label>
          <label className={purch.field}>{t("logi.notes.sitePhone")}<input className={purch.input} disabled={!editable} value={form.sitePhone} onChange={(e) => setForm({ ...form, sitePhone: e.target.value })} /></label>
        </div>
      </section>

      <section className={purch.section}>
        <h2>{t("logi.notes.transport")}</h2>
        <div className={styles.modeTabs}>
          {["own", "carrier", "pickup"].map((m) => <button key={m} type="button" disabled={!editable} className={form.transport.mode === m ? styles.on : ""} onClick={() => setT("mode", m)}>{t(`logi.transportModes.${m}`)}</button>)}
        </div>
        <div className={styles.transportGrid}>
          {form.transport.mode === "carrier" && <label className={purch.field}>{t("logi.notes.carrier")}<input className={purch.input} disabled={!editable} value={form.transport.carrier} placeholder={t("logi.notes.carrierPh")} onChange={(e) => setT("carrier", e.target.value)} /></label>}
          {form.transport.mode !== "pickup" && <label className={purch.field}>{t("logi.notes.vehicle")}<input className={purch.input} disabled={!editable} value={form.transport.vehicle} placeholder="12345-A-6" onChange={(e) => setT("vehicle", e.target.value)} /></label>}
          <label className={purch.field}>{form.transport.mode === "pickup" ? t("logi.notes.pickupBy") : t("logi.notes.driver")}<input className={purch.input} disabled={!editable} value={form.transport.driver} onChange={(e) => setT("driver", e.target.value)} /></label>
          <label className={purch.field}>{t("logi.notes.driverPhone")}<input className={purch.input} disabled={!editable} value={form.transport.driverPhone} onChange={(e) => setT("driverPhone", e.target.value)} /></label>
          {form.transport.mode === "carrier" && <label className={purch.field}>{t("logi.notes.trackingRef")}<input className={purch.input} disabled={!editable} value={form.transport.trackingRef} onChange={(e) => setT("trackingRef", e.target.value)} /></label>}
          {form.transport.mode !== "pickup" && <label className={purch.field}>{t("logi.notes.cost")}<input className={purch.input} type="number" min="0" step="any" disabled={!editable} value={form.transport.cost} onChange={(e) => setT("cost", e.target.value)} /></label>}
          <label className={purch.field}>{t("logi.notes.packages")}<input className={purch.input} type="number" min="0" disabled={!editable} value={form.packages} onChange={(e) => setForm({ ...form, packages: e.target.value })} /></label>
          <label className={purch.field}>{t("logi.notes.weight")}<input className={purch.input} type="number" min="0" step="any" disabled={!editable} value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></label>
        </div>
        {form.transport.mode !== "pickup" && Number(form.transport.cost) > 0 && <p className={s.muted}>{t("logi.notes.costHint")}</p>}
      </section>

      <section className={purch.section}>
        <div className={purch.sectionHeader}>
          <h2>{t("logi.notes.lines")} <span className={s.muted}>· {fmtQty(pieces)} {t("logi.pieces")} · {new Set(lines.map((l) => l.unit)).size} {t("logi.notes.chassis").toLowerCase()}</span></h2>
          {editable && (
            <div className={styles.filters} style={{ margin: 0 }}>
              <button type="button" className={styles.partChip} onClick={() => pickKinds(null)}>{t("logi.toDeliver.allAvailable")}</button>
              <button type="button" className={styles.partChip} onClick={() => pickKinds(["frame", "complete"])}>{t("logi.selectFrames")}</button>
              <button type="button" className={styles.partChip} onClick={() => pickKinds(["complete", "frame", "sash", "screen", "panel", "accessory", "other"])}>{t("logi.toDeliver.withoutGlass")}</button>
              <button type="button" className={styles.partChip} onClick={() => pickKinds(["glass", "module"])}>{t("logi.selectGlass")}</button>
              <button type="button" className={styles.partChip} onClick={() => setQty({})}>{t("logi.clear")}</button>
            </div>
          )}
        </div>
        {!form.project ? <p className={s.muted}>{t("logi.notes.pickProjectFirst")}</p> : (
          <div className={purch.card} style={{ overflowX: "auto" }}>
            <table className={styles.unitTable}>
              <thead><tr><th>{t("prod.ref")}</th><th>{t("prod.model")}</th><th>L × H</th><th>{t("logi.part")}</th><th>{t("logi.toDeliver.state")}</th>{editable && <th>{t("logi.toDeliver.availableCol")}</th>}<th>{editable ? t("logi.toDeliver.toShip") : t("prod.quantity")}</th></tr></thead>
              <tbody>
                {(editable ? deliverable : units.filter((u) => u.parts.some((p) => qty[`${u._id}|${p._id}`]))).map((u) => {
                  const parts = u.parts.filter((p) => !p.cancelled && (editable ? maxFor(u, p) > 0 || qty[`${u._id}|${p._id}`] : qty[`${u._id}|${p._id}`]));
                  return (
                    <Fragment key={u._id}>
                      {parts.map((p, i) => {
                        const key = `${u._id}|${p._id}`;
                        return (
                          <tr key={p._id}>
                            {i === 0 && <td rowSpan={parts.length}><strong>{u.ref}</strong></td>}
                            {i === 0 && <td rowSpan={parts.length}>{u.label}{u.finish && <small className={s.muted} style={{ display: "block" }}>{u.finish.code}</small>}</td>}
                            {i === 0 && <td rowSpan={parts.length}>{Math.round(u.L)} × {Math.round(u.H)}</td>}
                            <td>{p.label}{p.quantity !== 1 && <small className={s.muted}> ×{fmtQty(p.quantity)}</small>}{p.width && p.height ? <small className={s.muted} style={{ display: "block" }}>{p.width} × {p.height}</small> : null}</td>
                            <td><span className={styles.stageChip}><i className={styles.stageDot} style={{ background: STAGE_COLORS[p.status] }} />{t(`logi.stages.${p.status}`)}</span></td>
                            {editable && <td>{fmtQty(maxFor(u, p))}</td>}
                            <td>{editable ? <input className={`${purch.input} ${styles.qtyInput}`} type="number" min="0" max={maxFor(u, p)} step="any" placeholder="0" value={qty[key] ?? ""} onChange={(e) => setQty({ ...qty, [key]: e.target.value })} /> : fmtQty(qty[key])}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {editable && deliverable.length === 0 && <p className={s.muted} style={{ padding: 12 }}>{t("logi.notes.nothingReady")}</p>}
          </div>
        )}
      </section>

      <section className={purch.section}>
        <h2>{t("logi.notes.extraLines")}</h2>
        <p className={s.muted}>{t("logi.notes.extraHint")}</p>
        {form.extraLines.map((e, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 90px 90px 34px", gap: 8, marginBottom: 6 }}>
            <input className={purch.input} disabled={!editable} value={e.label} placeholder={t("logi.notes.extraPh")} onChange={(ev) => setForm({ ...form, extraLines: form.extraLines.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
            <input className={purch.input} disabled={!editable} type="number" min="0" step="any" value={e.quantity} onChange={(ev) => setForm({ ...form, extraLines: form.extraLines.map((x, j) => (j === i ? { ...x, quantity: ev.target.value } : x)) })} />
            <input className={purch.input} disabled={!editable} value={e.unit} placeholder="u" onChange={(ev) => setForm({ ...form, extraLines: form.extraLines.map((x, j) => (j === i ? { ...x, unit: ev.target.value } : x)) })} />
            {editable && <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setForm({ ...form, extraLines: form.extraLines.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>}
          </div>
        ))}
        {editable && <button type="button" className="btnEdit" onClick={() => setForm({ ...form, extraLines: [...form.extraLines, { label: "", quantity: 1, unit: "" }] })}><Plus size={14} /> {t("logi.notes.addExtra")}</button>}
      </section>

      <section className={purch.section}>
        <div className={purch.formGrid}>
          <label className={purch.field} style={{ gridColumn: "1 / -1" }}>{t("logi.notes.notes")}<textarea className={purch.input} rows={2} disabled={!editable} value={form.notes} placeholder={t("logi.notes.notesPh")} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <label className={purch.field} style={{ gridColumn: "1 / -1" }}>{t("logi.notes.internalNotes")}<textarea className={purch.input} rows={2} disabled={!editable} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} /></label>
        </div>
      </section>

      {note?.history?.length > 0 && (
        <section className={purch.section}>
          <h2>{t("logi.history")}</h2>
          <ul className={styles.timeline}>
            {[...note.history].reverse().map((h, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={i}><strong>{t(`logi.noteStatus.${h.status}`)}</strong> · {new Date(h.at).toLocaleString("fr-FR")}{h.by ? ` · ${`${h.by.firstName || ""} ${h.by.lastName || ""}`.trim() || h.by.email}` : ""}{h.note ? ` — ${h.note}` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {deliverDialog && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <div className={purch.modalCard}>
            <h3>{t("logi.notes.deliverTitle")}</h3>
            <label className={purch.field}>{t("logi.notes.deliveredAt")}<input className={purch.input} type="date" value={deliverDialog.deliveredAt} onChange={(e) => setDeliverDialog({ ...deliverDialog, deliveredAt: e.target.value })} /></label>
            <label className={purch.field}>{t("logi.notes.receivedBy")}<input className={purch.input} value={deliverDialog.receivedBy} onChange={(e) => setDeliverDialog({ ...deliverDialog, receivedBy: e.target.value })} /></label>
            <label className={purch.field}>{t("logi.notes.reserves")}<textarea className={purch.input} rows={3} value={deliverDialog.reserves} placeholder={t("logi.notes.reservesPh")} onChange={(e) => setDeliverDialog({ ...deliverDialog, reserves: e.target.value })} /></label>
            <p className={s.muted}>{t("logi.notes.deliverHint")}</p>
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setDeliverDialog(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={busy} onClick={() => status("delivered", deliverDialog)}>{t("logi.notes.deliver")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
