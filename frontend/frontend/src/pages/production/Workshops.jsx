import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Factory, Plus, Trash2, Package, Lock, Clock, Users, X, Info, PackageCheck } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import StatusPill from "../../components/useful/StatusPill";
import { getWorkshopBoard, createWorkOrder, getFinishes, getCatalogArticles, updateWorkshop } from "../../services/productionService";
import { getProjectPeople } from "../../services/projectService";
import { getTransfers, getToIssue } from "../../services/productionFlowService";
import { ReceiveModal } from "../../components/flow/FlowModals";
import { getCustomers } from "../../services/salesService";
import { canConfigureProduction } from "../../utils/permissions";
import { useCan } from "../../hooks/useCan";
import { useCompanyPicker, formatDate, ORDER_PILL, articleLabel, fmtQty } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";

/** Workshops (ateliers): each one's queue of work orders — Laquage, Aluminium, Vitrage… */
export default function Workshops() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [board, setBoard] = useState([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(null);
  const [team, setTeam] = useState(null); // workshop whose chef / team is being edited
  const [pending, setPending] = useState([]); // material sent to the workshops, not received yet
  const [receiving, setReceiving] = useState(null);
  const [toIssue, setToIssue] = useState([]); // projects with bars / accessories left to issue
  const can = useCan();
  const canAssign = can("production.workshops.assign") || can("production.config.edit");

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      setBoard(await getWorkshopBoard(companyId));
      getTransfers(companyId, { status: "sent" }).then(setPending).catch(() => setPending([]));
      if (can("production.flow.issueBars") || can("production.flow.issueAccessories")) getToIssue(companyId).then(setToIssue).catch(() => setToIssue([]));
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [companyId, t]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/workshops" }, { label: t("prod.workshops.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Factory size={20} /><h1>{t("prod.workshops.title")}</h1></div>
          <p className="pageSubtitle">{t("prod.workshops.subtitle")}</p>
        </div>
        {companyId && board.length > 0 && can("production.orders.create") && <button type="button" className="btnEdit" onClick={() => setCreating({ workshop: board[0]._id })}><Plus size={15} /> {t("flow.outsideOrder")}</button>}
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      <div className={purch.infoBanner}><Info size={14} /> {t("flow.workshopsHint")}</div>
      {toIssue.length > 0 && (
        <section className={purch.section}>
          <h2><Package size={16} /> {t("flowUi.toIssueTitle")}</h2>
          <div className={styles.orderList}>
            {toIssue.map((x) => (
              <button key={x.project._id} type="button" className={styles.orderRow} onClick={() => navigate(`/production/projects/${x.project._id}`, { state: { tab: "fabrication" } })}>
                <span><strong>{x.project.number}</strong> · {x.project.name}</span>
                <span className={s.muted}>{x.project.dueDate ? `${t("prod.due")} ${formatDate(x.project.dueDate)}` : ""}</span>
                <small>{x.bars > 0 ? t("flowUi.barsLeft").replace("{n}", fmtQty(x.bars)) : ""}{x.bars > 0 && x.accessories > 0 ? " · " : ""}{x.accessories > 0 ? t("flowUi.accLeft").replace("{n}", x.accessories) : ""}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {board.length > 0 && (
        <div className={styles.flow}>
          {board.map((w) => <span key={w._id} className={styles.flowStep}><i className={styles.dot} style={{ background: w.color }} /> {w.name}</span>)}
          {canConfigureProduction(user) && <button type="button" className="btnEdit" onClick={() => navigate("/production/configuration")}>{t("prod.workshops.configure")}</button>}
        </div>
      )}
      <div className={styles.boardGrid}>
        {board.map((w) => (
          <div key={w._id} className={styles.workshopCard} style={{ borderTopColor: w.color }}>
            <div className={styles.workshopHead}>
              <div>
                <h2>{w.name}</h2>
                <small>{t("flow.chef")} : {w.manager ? `${w.manager.firstName} ${w.manager.lastName}` : "—"}{(w.members || []).length ? ` · ${t("prod.config.members")} : ${w.members.map((m) => m.firstName).join(", ")}` : ""}</small>
              </div>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                {(canAssign || w.isManager) && <button type="button" className="tableActionBtn" title={t("flow.team")} onClick={() => setTeam(w)}><Users size={14} /></button>}
                <span className={styles.kindBadge}>{w.code}</span>
              </span>
            </div>
            {pending.filter((tr) => String(tr.toWorkshop?._id || tr.toWorkshop) === String(w._id)).map((tr) => (
              <button key={tr._id} type="button" className={styles.orderRow} style={{ borderColor: "var(--color-warning)" }} onClick={() => setReceiving(tr)}>
                <span><PackageCheck size={13} /> <strong>{t(`flowUi.receiveCat.${tr.category}`)}</strong> · {tr.number}</span>
                <span className={s.muted}>{tr.project?.number}</span>
                <small>{tr.fromWorkshop?.name || t("flowUi.stock")} · {tr.lines.length} {t("flowUi.lines")}</small>
              </button>
            ))}
            <div className={styles.counters}>
              <span className={styles.counter}><strong>{w.counts.planned}</strong> {t("prod.orderStatus.planned").toLowerCase()}</span>
              <span className={styles.counter}><strong>{w.counts.inProgress}</strong> {t("prod.orderStatus.in_progress").toLowerCase()}</span>
              {w.counts.late > 0 && <span className={`${styles.counter} ${styles.counterBad}`}><strong>{w.counts.late}</strong> {t("prod.late").toLowerCase()}</span>}
              <span className={styles.counter}><strong>{w.counts.doneLast30}</strong> {t("prod.workshops.done30")}</span>
            </div>
            <div className={styles.orderList}>
              {w.orders.length === 0 && <span className={styles.emptyLine}>{t("prod.workshops.noOrders")}</span>}
              {w.orders.map((o) => {
                const qty = o.progress?.total || 0;
                const done = o.progress?.done || 0;
                return (
                  <button key={o._id} type="button" className={styles.orderRow} onClick={() => navigate(`/production/orders/${o._id}`)}>
                    <span><strong>{o.number}</strong> {o.project ? `· ${o.project.number}` : ""}</span>
                    <span>
                      {o.blocked && <span className={`${s.tag} ${s.tagWarn}`} title={t("prod.workshops.blockedHint")}><Lock size={10} /> {t("prod.waiting")}</span>}
                      {o.late && <span className={`${s.tag} ${s.tagBad}`}><Clock size={10} /> {t("prod.late")}</span>}
                      {" "}<StatusPill status={ORDER_PILL[o.status]} label={t(`prod.orderStatus.${o.status}`)} />
                    </span>
                    <small>{o.project?.name || o.title}{o.dueDate ? ` · ${t("prod.due")} ${formatDate(o.dueDate)}` : ""}{qty ? ` · ${fmtQty(done)} / ${fmtQty(qty)}` : ""}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {receiving && <ReceiveModal transfer={receiving} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); load(); }} />}
      {team && <TeamModal companyId={companyId} workshop={team} canAssign={canAssign} onClose={() => setTeam(null)} onSaved={() => { setTeam(null); load(); }} />}
      {creating && <ManualOrderModal companyId={companyId} workshops={board} initial={creating} onClose={() => setCreating(null)} onCreated={(o) => navigate(`/production/orders/${o._id}`)} />}
    </div>
  );
}

/** A work order not coming from a project's ouvrages — e.g. lacquering for an outside customer. */
function ManualOrderModal({ companyId, workshops, initial, onClose, onCreated }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ workshop: initial.workshop, title: "", customer: "", customerMaterial: false, dueDate: "", priority: "normal", lacquer: [{ product: "", finish: "", quantity: 1 }], items: [{ label: "", quantity: 1 }], needs: [] });
  const [customers, setCustomers] = useState([]);
  const [finishes, setFinishes] = useState([]);
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    getCustomers(companyId, { active: "true" }).then(setCustomers).catch(() => setCustomers([]));
    getFinishes(companyId).then(setFinishes).catch(() => setFinishes([]));
    getCatalogArticles(companyId).then(setArticles).catch(() => setArticles([]));
  }, [companyId]);
  const workshop = workshops.find((w) => w._id === form.workshop);
  const isLaq = workshop?.kind === "laquage";
  const artOptions = (types) => articles.filter((a) => !types || !a.materialType || types.includes(a.materialType)).map((a) => ({ value: a._id, label: articleLabel(a) }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = {
        company: companyId, workshop: form.workshop, title: form.title, customer: form.customer || null,
        customerMaterial: isLaq && form.customerMaterial, dueDate: form.dueDate || null, priority: form.priority,
        ...(isLaq
          ? { lacquer: form.lacquer.filter((l) => l.product && l.finish && Number(l.quantity) > 0) }
          : { items: form.items.filter((i) => i.label), needs: form.needs.filter((n) => n.product && Number(n.quantity) > 0) }),
      };
      onCreated(await createWorkOrder(body));
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const setRow = (key, i, p) => setForm({ ...form, [key]: form[key].map((r, j) => (j === i ? { ...r, ...p } : r)) });

  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <form className={styles.modalWide} onSubmit={submit}>
        <h3>{t("flow.outsideOrder")}</h3>
        <p className={s.muted} style={{ marginTop: -4 }}>{t("flow.outsideOrderHint")}</p>
        <div className={purch.formGrid}>
          <label className={purch.field}>{t("prod.workshop")}<CustomSelect value={form.workshop} onSelect={(v) => setForm({ ...form, workshop: v })} options={workshops.map((w) => ({ value: w._id, label: w.name }))} /></label>
          <label className={purch.field}>{t("prod.workshops.orderTitle")}<input className={purch.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={isLaq ? t("prod.workshops.laqTitlePh") : ""} /></label>
          {customers.length > 0 && <label className={purch.field}>{t("sales.customer")}<CustomSelect value={form.customer} onSelect={(v) => setForm({ ...form, customer: v })} options={[{ value: "", label: "—" }, ...customers.map((c) => ({ value: c._id, label: c.name }))]} /></label>}
          <label className={purch.field}>{t("prod.dueDate")}<input className={purch.input} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <label className={purch.field}>{t("prod.priority")}<CustomSelect value={form.priority} onSelect={(v) => setForm({ ...form, priority: v })} options={["low", "normal", "high", "urgent"].map((p) => ({ value: p, label: t(`prod.priorities.${p}`) }))} /></label>
        </div>
        {isLaq ? (
          <>
            <label className={purch.inlineCheck}><input type="checkbox" checked={form.customerMaterial} onChange={(e) => setForm({ ...form, customerMaterial: e.target.checked })} /> {t("prod.workshops.customerMaterial")}</label>
            <h4 className={purch.subTitle}>{t("prod.workshops.barsToLacquer")}</h4>
            {form.lacquer.map((l, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className={styles.gridRow} style={{ gridTemplateColumns: "2fr 1fr 0.7fr 34px", marginBottom: 6 }}>
                <SearchSelect value={l.product} onSelect={(v) => setRow("lacquer", i, { product: v })} options={artOptions(["profile", "panel"])} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} />
                <CustomSelect value={l.finish} onSelect={(v) => setRow("lacquer", i, { finish: v })} options={finishes.filter((f) => f.kind === "lacquer").map((f) => ({ value: f._id, label: f.code }))} placeholder={t("prod.finish")} />
                <input className={purch.input} type="number" min="0" step="any" value={l.quantity} onChange={(e) => setRow("lacquer", i, { quantity: e.target.value })} />
                <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setForm({ ...form, lacquer: form.lacquer.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <button type="button" className="btnEdit" onClick={() => setForm({ ...form, lacquer: [...form.lacquer, { product: "", finish: "", quantity: 1 }] })}><Plus size={14} /> {t("prod.workshops.addLine")}</button>
          </>
        ) : (
          <>
            <h4 className={purch.subTitle}>{t("prod.workshops.toProduce")}</h4>
            {form.items.map((it, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className={styles.gridRow} style={{ gridTemplateColumns: "2fr 0.7fr 34px", marginBottom: 6 }}>
                <input className={purch.input} value={it.label} placeholder={t("prod.workshops.itemPh")} onChange={(e) => setRow("items", i, { label: e.target.value })} />
                <input className={purch.input} type="number" min="0" step="any" value={it.quantity} onChange={(e) => setRow("items", i, { quantity: e.target.value })} />
                <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <button type="button" className="btnEdit" onClick={() => setForm({ ...form, items: [...form.items, { label: "", quantity: 1 }] })}><Plus size={14} /> {t("prod.workshops.addLine")}</button>
            <h4 className={purch.subTitle}>{t("prod.workshops.materials")}</h4>
            {form.needs.map((n, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className={styles.gridRow} style={{ gridTemplateColumns: "2fr 0.7fr 34px", marginBottom: 6 }}>
                <SearchSelect value={n.product} onSelect={(v) => setRow("needs", i, { product: v })} options={artOptions(null)} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} />
                <input className={purch.input} type="number" min="0" step="any" value={n.quantity} onChange={(e) => setRow("needs", i, { quantity: e.target.value })} />
                <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setForm({ ...form, needs: form.needs.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <button type="button" className="btnEdit" onClick={() => setForm({ ...form, needs: [...form.needs, { product: "", quantity: 1 }] })}><Plus size={14} /> {t("prod.workshops.addMaterial")}</button>
          </>
        )}
        {error && <div className="errorMessage" style={{ marginTop: 10 }}>{error}</div>}
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="btnPrimary">{t("prod.workshops.create")}</button>
        </div>
      </form>
    </div>
  );
}

/** Chef d'atelier and team of one workshop: the production manager appoints the chef; a chef manages his team. */
function TeamModal({ companyId, workshop, canAssign, onClose, onSaved }) {
  const { t } = useI18n();
  const [people, setPeople] = useState([]);
  const [manager, setManager] = useState(workshop.manager?._id || "");
  const [members, setMembers] = useState((workshop.members || []).map((m) => m._id));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { getProjectPeople(companyId).then(setPeople).catch(() => setPeople([])); }, [companyId]);
  const nameOf = (id) => { const p = people.find((x) => x._id === id) || [workshop.manager, ...(workshop.members || [])].find((x) => x?._id === id); return p ? `${p.firstName} ${p.lastName}` : id; };
  const options = people.map((p) => ({ value: p._id, label: `${p.firstName} ${p.lastName}${p.jobTitle ? ` — ${p.jobTitle}` : ""}` }));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await updateWorkshop(workshop._id, canAssign ? { manager: manager || null, members } : { members });
      onSaved();
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); } finally { setBusy(false); }
  };
  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={purch.modalCard} style={{ maxWidth: 520 }}>
        <h3><Users size={16} /> {t("flow.team")} — {workshop.name}</h3>
        <p className={s.muted}>{t("flow.teamHint")}</p>
        <label className={purch.field}>{t("flow.chef")}
          {canAssign
            ? <SearchSelect value={manager} onSelect={(v) => setManager(v || "")} options={[{ value: "", label: "—" }, ...options]} placeholder={t("prod.config.pickPerson")} noResultsLabel={t("common.noResults")} />
            : <input className={purch.input} readOnly value={manager ? nameOf(manager) : "—"} />}
        </label>
        {!canAssign && <small className={s.muted}>{t("flow.chefLocked")}</small>}
        <label className={purch.field} style={{ marginTop: 10 }}>{t("prod.config.members")}
          <SearchSelect value="" onSelect={(v) => v && v !== manager && !members.includes(v) && setMembers([...members, v])} options={options.filter((o) => o.value !== manager && !members.includes(o.value))} placeholder={t("prod.config.addMember")} noResultsLabel={t("common.noResults")} />
        </label>
        <div className={styles.chips} style={{ marginTop: 6 }}>
          {members.map((id) => <span key={id} className={styles.chip}>{nameOf(id)} <button type="button" className="tableActionBtn" style={{ padding: 0, minWidth: 0, height: "auto" }} onClick={() => setMembers(members.filter((x) => x !== id))}><X size={11} /></button></span>)}
          {!members.length && <span className={s.muted}>—</span>}
        </div>
        {error && <div className="errorMessage" style={{ marginTop: 10 }}>{error}</div>}
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btnPrimary" disabled={busy} onClick={save}>{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}
