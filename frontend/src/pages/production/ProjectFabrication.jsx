import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Factory, AlertTriangle, CheckCircle2, Rocket } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import { canSeeFinancials } from "../../utils/permissions";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import { updateProject } from "../../services/projectService";
import { addProjectItem, updateProjectItem, deleteProjectItem, getProjectProduction, planProjectProduction } from "../../services/productionService";
import ChassisConfigurator from "./ChassisConfigurator";
import LaunchProduction from "../../components/workflow/LaunchProduction";
import MissingGlassFix from "../../components/workflow/MissingGlassFix";
import ProjectFlow from "../../components/flow/ProjectFlow";
import ChassisDrawing from "./ChassisDrawing";
import useChassisData from "./useChassisData";
import { ORDER_PILL, fmtQty, fmtMm, formatMoney, defaultParams } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";
import { useDialog } from "../../components/useful/DialogProvider";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

/** The project's ouvrages: every chassis to manufacture (from the devis, or added after the site survey). */
export function ProjectOuvrages({ project, canEdit, reload, onError }) {
  const dialog = useDialog();
  const { t } = useI18n();
  const { models, finishes, articles, families, glassTypes } = useChassisData(project.company);
  const [editing, setEditing] = useState(null);
  const [missing, setMissing] = useState([]);
  const itemsKey = (project.items || []).map((i) => `${i._id}:${JSON.stringify(i.params || {})}`).join("|");
  useEffect(() => {
    if (!(project.items || []).length) { setMissing([]); return; }
    getProjectProduction(project._id).then((d) => setMissing(d.missingGlass || [])).catch(() => setMissing([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project._id, itemsKey]);
  const missingIds = new Set(missing.map((m) => String(m.item)));
  const area = (project.items || []).reduce((a, i) => a + (i.L * i.H * i.quantity) / 1e6, 0);
  const count = (project.items || []).reduce((a, i) => a + i.quantity, 0);

  const save = async () => {
    const { _id, ...body } = editing;
    try {
      const payload = { ...body, model: idOf(body.model), finish: idOf(body.finish) || null };
      if (_id) await updateProjectItem(project._id, _id, payload); else await addProjectItem(project._id, payload);
      setEditing(null);
      reload();
    } catch (err) { onError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const remove = async (item) => {
    if (!(await dialog.confirm(t("prod.project.deleteItem")))) return;
    try { await deleteProjectItem(project._id, item._id); reload(); } catch (err) { onError(err.response?.data?.message || t("prod.errors.save")); }
  };

  return (
    <>
      <div className={purch.sectionHeader}>
        <div className={s.statusBar} style={{ marginBottom: 0 }}>
          <span className={s.muted}>{t("prod.project.defaultFinish")}</span>
          <div style={{ width: 200 }}>
            <CustomSelect value={idOf(project.finish)} disabled={!canEdit} onSelect={async (v) => { try { await updateProject(project._id, { finish: v || null }); reload(); } catch (err) { onError(err.response?.data?.message || t("prod.errors.save")); } }}
              options={[{ value: "", label: t("prod.noFinish") }, ...finishes.map((f) => ({ value: f._id, label: `${f.code}${f.name ? ` — ${f.name}` : ""}` }))]} />
          </div>
          <span className={s.muted}>{fmtQty(count, 0)} {t("prod.project.chassis")} · {fmtQty(area, 2)} m²</span>
        </div>
        {canEdit && <button type="button" className="btnEdit" onClick={() => setEditing({ model: "", ref: `R${(project.items || []).length + 1}`, L: 1200, H: 1000, quantity: 1, finish: idOf(project.finish), params: {} })}><Plus size={14} /> {t("prod.project.addItem")}</button>}
      </div>
      <MissingGlassFix project={project} missing={missing} canEdit={canEdit} onFixed={reload} />
      {(project.items || []).length === 0 ? (
        <p className={s.muted}>{t("prod.project.noItems")}</p>
      ) : (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: "60px 64px 2.4fr 1fr 60px 1fr 80px" }}>
            <span>{t("prod.ref")}</span><span /><span>{t("prod.model")}</span><span>L × H</span><span>{t("prod.quantity")}</span><span>{t("prod.finish")}</span><span />
          </div>
          {project.items.map((it) => (
            <div key={it._id} className="dataTableRow" style={{ gridTemplateColumns: "60px 64px 2.4fr 1fr 60px 1fr 80px" }}>
              <span><strong>{it.ref}</strong></span>
              <span><ChassisDrawing drawing={it.model?.drawing} image={it.model?.image?.url} L={it.L} H={it.H} params={it.params} width={56} height={44} /></span>
              <span>{it.model?.name || "?"}<small className={s.muted} style={{ display: "block" }}>{it.label}</small>{missingIds.has(String(it._id)) && <small className={s.bad} style={{ display: "block" }}>{t("glassFix.badge")}</small>}</span>
              <span>{fmtMm(it.L)} × {fmtMm(it.H)}</span>
              <span>{it.quantity}</span>
              <span>{it.finish ? <><i className={styles.dot} style={{ background: it.finish.color }} /> {it.finish.code}</> : project.finish ? <span className={s.muted}>{project.finish.code} ({t("prod.default").toLowerCase()})</span> : "—"}</span>
              <span className="dataTableActions">
                {canEdit && <button type="button" className="tableActionBtn" onClick={() => setEditing({ ...it, model: idOf(it.model), finish: idOf(it.finish), params: { ...defaultParams(models.find((m) => m._id === idOf(it.model))), ...(it.params || {}) } })}><Pencil size={14} /></button>}
                {canEdit && <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => remove(it)}><Trash2 size={14} /></button>}
              </span>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalWide}>
            <h3>{editing._id ? t("prod.project.editItem") : t("prod.project.addItem")}</h3>
            <ChassisConfigurator value={editing} onChange={setEditing} models={models} finishes={finishes} articles={articles} families={families} glassTypes={glassTypes} />
            <label className={purch.field}>{t("prod.project.itemLabel")}<input className={purch.input} value={editing.label || ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></label>
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={!editing.model} onClick={save}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** What each workshop must produce and consume, the work orders, and real vs planned consumption. */
export function ProjectFabrication({ project, canEdit, reload, onError, onNotice, onShowGlassCutting }) {
  const { user } = useAuth();
  const money = canSeeFinancials(user);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getProjectProduction(project._id)); } catch (err) { onError(err.response?.data?.message || t("prod.errors.load")); }
  }, [project._id, onError, t]);
  useEffect(() => { load(); }, [load]);

  const consumption = useMemo(() => {
    const rows = new Map();
    for (const o of data?.orders || []) {
      for (const n of o.needs || []) {
        const key = `${n.product?._id || n.label}`;
        const r = rows.get(key) || { name: n.product?.name || n.label, type: n.materialType || n.kind || "other", unit: n.unit, planned: 0, consumed: 0, cost: 0 };
        r.planned += n.theoretical || 0;
        r.consumed += n.consumed || 0;
        r.cost += (n.consumed || 0) * (n.unitCost || 0);
        rows.set(key, r);
      }
    }
    return [...rows.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }, [data]);

  if (!data) return <p className={s.muted}>{t("common.loading")}</p>;
  const { plan, orders } = data;
  const started = orders.some((o) => ["in_progress", "done"].includes(o.status));

  return (
    <>
      <div className={purch.sectionHeader}>
        <p className={s.muted} style={{ margin: 0 }}>{t("prod.project.fabricationHint")}</p>
        {canEdit && (project.items || []).length > 0 && !started && (
          <button type="button" className="btnPrimary" disabled={plan.errors.length > 0} onClick={() => setLaunching(true)}><Rocket size={15} /> {orders.length ? t("prod.project.replan") : t("prod.project.launch")}</button>
        )}
      </div>
      {launching && <LaunchProduction project={project} onChanged={reload} onClose={() => setLaunching(false)} onLaunched={async (r) => { setLaunching(false); onNotice(t("prod.project.planned").replace("{n}", r.orders.length)); await load(); reload(); }} />}
      {plan.errors.length > 0 && <ul className={styles.errList}>{plan.errors.slice(0, 10).map((e, i) => <li key={i}>{e.where} — {e.message}</li>)}</ul>}
      {plan.warnings.length > 0 && <ul className={styles.warnList}>{plan.warnings.slice(0, 10).map((w, i) => <li key={i}>{w.message}</li>)}</ul>}

      {orders.some((o) => o.status !== "cancelled") && <ProjectFlow project={project} onChanged={() => { load(); reload(); }} onShowGlassCutting={onShowGlassCutting} />}
      {orders.length > 0 && (
        <section className={purch.section}>
          <h2>{t("prod.project.orders")}</h2>
          <div className={styles.flow}>
            {orders.map((o) => (
              <button key={o._id} type="button" className={styles.flowStep} onClick={() => navigate(`/production/orders/${o._id}`)} style={{ cursor: "pointer", background: "transparent", color: "inherit" }}>
                <i className={styles.dot} style={{ background: o.workshop?.color }} /> {o.workshop?.name} · {o.number} <StatusPill status={ORDER_PILL[o.status]} label={t(`prod.orderStatus.${o.status}`)} />
              </button>
            ))}
          </div>
        </section>
      )}

      {plan.shortages.length > 0 && (
        <section className={purch.section}>
          <h2><AlertTriangle size={16} className={s.warn} /> {t("prod.project.shortages")}</h2>
          <p className={s.muted}>{t("prod.project.shortagesHint")}</p>
          <table className={styles.needTable}>
            <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.order.needed")}</th><th className={styles.num}>{t("prod.stock")}</th><th className={styles.num}>{t("prod.project.missing")}</th></tr></thead>
            <tbody>{plan.shortages.map((x, i) => <tr key={i}><td>{x.name}{x.variant && <small>{t("prod.project.variantToBuy")}</small>}</td><td className={styles.num}>{fmtQty(x.needed)} {x.unit}</td><td className={styles.num}>{fmtQty(x.stock)}</td><td className={`${styles.num} ${s.bad}`}>{fmtQty(x.missing)}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      {!orders.length && plan.workshops.map((w) => (
        <section key={w.workshop.code} className={purch.section}>
          <h2><i className={styles.dot} style={{ background: w.workshop.color }} /> {w.workshop.name} <span className={s.muted}>· {w.items.length} {t("prod.project.lines")} · {fmtQty(w.labourMinutes / 60, 1)} h{w.dependsOnCodes.length ? ` · ${t("prod.project.after")} ${w.dependsOnCodes.join(", ")}` : ""}</span></h2>
          <div className={styles.tableWrap}>
            <table className={styles.needTable}>
              <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.planned")}</th><th className={styles.num}>{t("prod.stock")}</th><th>{t("prod.project.detail")}</th></tr></thead>
              <tbody>
                {w.needs.map((n, i) => (
                  <tr key={i}>
                    <td>{n.productName || <span className={styles.unmapped}>{n.label}</span>}{n.warning && <small className={styles.unmapped}>{n.warning}</small>}</td>
                    <td className={styles.num}>{fmtQty(n.theoretical)} {n.unit}</td>
                    <td className={`${styles.num} ${n.shortage > 0 ? s.bad : ""}`}>{fmtQty(n.stock)}</td>
                    <td className={s.muted}>
                      {n.barLength ? t("prodPlan.barsOf").replace("{length}", fmtQty(n.barLength)) : n.measure === "area" ? `${fmtQty(n.area, 3)} m²` : ""}
                      {n.toLacquer !== undefined && ` · ${t("prod.project.fromStock")} ${fmtQty(n.fromStock)} · ${t("prod.project.toLacquer")} ${fmtQty(n.toLacquer)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {consumption.length > 0 && (
        <section className={purch.section}>
          <h2><Factory size={16} /> {t("prod.project.consumption")}</h2>
          <p className={s.muted}>{t("prod.project.consumptionHint")}</p>
          <table className={styles.needTable}>
            <thead><tr><th>{t("prod.project.type")}</th><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.planned")}</th><th className={styles.num}>{t("prod.order.consumed")}</th><th className={styles.num}>{t("prod.project.gap")}</th>{money && <th className={styles.num}>{t("prod.project.cost")}</th>}</tr></thead>
            <tbody>
              {consumption.map((r, i) => {
                const gap = r.consumed - r.planned;
                return (
                  <tr key={i}>
                    <td>{t(`prod.materialTypes.${r.type}`, r.type)}</td>
                    <td>{r.name}</td>
                    <td className={styles.num}>{fmtQty(r.planned)} {r.unit}</td>
                    <td className={styles.num}>{fmtQty(r.consumed)}</td>
                    <td className={`${styles.num} ${gap > 1e-6 ? s.bad : gap < -1e-6 ? s.muted : s.good}`}>{r.consumed ? (gap > 0 ? "+" : "") + fmtQty(gap) : "—"}</td>
                    {money && <td className={styles.num}>{r.cost ? formatMoney(r.cost, "") : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orders.every((o) => o.status === "done") && <p className={s.good}><CheckCircle2 size={14} /> {t("prod.project.allDone")}</p>}
        </section>
      )}
    </>
  );
}
