import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackageOpen, Truck, ChevronDown, ChevronRight } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { getToDeliver } from "../../services/logisticsService";
import { useCompanyPicker, formatDate, fmtQty, STAGE_COLORS } from "./logisticsShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Logistics.module.css";

/**
 * À livrer: every project with chassis parts ready (or made, depending
 * on the setting) and not yet delivered. Tick parts — frames only,
 * without glass, some modules… — with the quantity, then create the
 * delivery note.
 */
export default function ToDeliver() {
  const can = useCan();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});
  const [pick, setPick] = useState({}); // projectId → { "unit|part": qty }
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const d = await getToDeliver(companyId);
      setData(d);
      setOpen((o) => (Object.keys(o).length ? o : Object.fromEntries(d.projects.filter((p) => p.available > 0).slice(0, 3).map((p) => [p.project._id, true]))));
    } catch (err) { setError(err.response?.data?.message || t("logi.errors.load")); }
  }, [companyId, t]);
  useEffect(() => { load(); }, [load]);

  const setQ = (pid, key, v) => setPick((x) => ({ ...x, [pid]: { ...(x[pid] || {}), [key]: v } }));
  const pickKinds = (row, kinds) => setPick((x) => ({
    ...x,
    [row.project._id]: Object.fromEntries(row.units.flatMap((u) => u.parts.filter((p) => p.available > 0 && (!kinds || kinds.includes(p.kind))).map((p) => [`${u._id}|${p._id}`, p.available]))),
  }));
  const linesOf = (pid) => Object.entries(pick[pid] || {}).filter(([, q]) => Number(q) > 0).map(([k, q]) => { const [unit, part] = k.split("|"); return { unit, part, quantity: Number(q) }; });

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.logistics"), href: "/logistics/to-deliver" }, { label: t("logi.toDeliver.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><PackageOpen size={20} /><h1>{t("logi.toDeliver.title")}</h1></div>
          <p className="pageSubtitle">{t(data?.requireReady === false ? "logi.toDeliver.subtitleMade" : "logi.toDeliver.subtitle")}</p>
        </div>
        <button type="button" className="btnEdit" onClick={() => navigate("/logistics/delivery-notes")}><Truck size={15} /> {t("logi.notes.title")}</button>
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup"><label>{t("employees.toolbar.company")}</label><CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} /></div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {data && data.projects.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><PackageOpen size={28} /></div><h2>{t("logi.toDeliver.empty")}</h2><p>{t("logi.toDeliver.emptyHint")}</p></div>
      )}
      {data?.projects.map((row) => {
        const pid = row.project._id;
        const lines = linesOf(pid);
        return (
          <div key={pid} className={styles.projectCard}>
            <div className={styles.projectHead} role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setOpen({ ...open, [pid]: !open[pid] })} onKeyDown={(e) => e.key === "Enter" && setOpen({ ...open, [pid]: !open[pid] })}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {open[pid] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div>
                  <h3>{row.project.number} — {row.project.name}</h3>
                  <small>{row.project.customer?.name || ""}{row.project.location ? ` · ${row.project.location}` : ""}{row.project.dueDate ? ` · ${t("projects.due")} ${formatDate(row.project.dueDate)}` : ""}</small>
                </div>
              </div>
              <div className={styles.filters} style={{ margin: 0 }}>
                <span className={styles.stageChip}><i className={styles.stageDot} style={{ background: STAGE_COLORS.ready }} />{fmtQty(row.available)} {t("logi.toDeliver.available")}</span>
                {row.reserved > 0 && <span className={styles.stageChip}><Truck size={11} /> {fmtQty(row.reserved)} {t("logi.toDeliver.reserved")}</span>}
                {row.notYet > 0 && <span className={styles.stageChip}><i className={styles.stageDot} style={{ background: STAGE_COLORS.in_production }} />{fmtQty(row.notYet)} {t("logi.toDeliver.notYet")}</span>}
              </div>
            </div>
            {open[pid] && (
              <div className={styles.projectBody}>
                <div className={styles.filters}>
                  <span className={s.muted}>{t("logi.select")}</span>
                  <button type="button" className={styles.partChip} onClick={() => pickKinds(row, null)}>{t("logi.toDeliver.allAvailable")}</button>
                  <button type="button" className={styles.partChip} onClick={() => pickKinds(row, ["frame", "complete"])}>{t("logi.selectFrames")}</button>
                  <button type="button" className={styles.partChip} onClick={() => pickKinds(row, ["complete", "frame", "sash", "screen", "panel", "accessory", "other"])}>{t("logi.toDeliver.withoutGlass")}</button>
                  <button type="button" className={styles.partChip} onClick={() => pickKinds(row, ["glass", "module"])}>{t("logi.selectGlass")}</button>
                  <button type="button" className={styles.partChip} onClick={() => setPick({ ...pick, [pid]: {} })}>{t("logi.clear")}</button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.unitTable}>
                    <thead><tr><th>{t("prod.ref")}</th><th>{t("prod.model")}</th><th>L × H</th><th>{t("logi.part")}</th><th>{t("logi.toDeliver.state")}</th><th>{t("logi.toDeliver.availableCol")}</th><th>{t("logi.toDeliver.toShip")}</th></tr></thead>
                    <tbody>
                      {row.units.map((u) => {
                        const parts = u.parts.filter((p) => !p.cancelled && p.deliveredQty < p.quantity);
                        return (
                          <Fragment key={u._id}>
                            {parts.map((p, i) => {
                              const key = `${u._id}|${p._id}`;
                              return (
                                <tr key={p._id}>
                                  {i === 0 && <td rowSpan={parts.length}><strong>{u.ref}</strong>{u.modified && <span className={styles.flag}>{t("logi.modified")}</span>}</td>}
                                  {i === 0 && <td rowSpan={parts.length}>{u.model?.name || u.label}{u.finish && <small className={s.muted} style={{ display: "block" }}>{u.finish.code}</small>}</td>}
                                  {i === 0 && <td rowSpan={parts.length}>{Math.round(u.L)} × {Math.round(u.H)}</td>}
                                  <td>{p.label}{p.quantity !== 1 && <small className={s.muted}> ×{fmtQty(p.quantity)}</small>}</td>
                                  <td>
                                    <span className={styles.stageChip}><i className={styles.stageDot} style={{ background: STAGE_COLORS[p.status] }} />{t(`logi.stages.${p.status}`)}</span>
                                    {p.reserved > 0 && <small className={s.muted} style={{ display: "block" }}>{fmtQty(p.reserved)} {t("logi.reservedOn")} {p.reservedOn.join(", ")}</small>}
                                  </td>
                                  <td>{fmtQty(p.available)}</td>
                                  <td>{p.available > 0 ? <input className={`${purch.input} ${styles.qtyInput}`} type="number" min="0" max={p.available} step="any" value={pick[pid]?.[key] ?? ""} placeholder="0" onChange={(e) => setQ(pid, key, e.target.value)} /> : "—"}</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={purch.formActions}>
                  <span className={s.muted}>{t("logi.toDeliver.selected").replace("{n}", fmtQty(lines.reduce((a, l) => a + l.quantity, 0)))}</span>
                  {can("logistics.notes.create") && <button type="button" className="btnPrimary" disabled={!lines.length} onClick={() => navigate("/logistics/delivery-notes/new", { state: { projectId: pid, lines } })}><Truck size={15} /> {t("logi.toDeliver.create")}</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
