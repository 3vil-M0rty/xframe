import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Plus, Pencil, Trash2, X, Package, FolderKanban, AlertTriangle } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import { getGlassTypes, createGlassType, updateGlassType, deleteGlassType, getCatalogArticles } from "../../services/productionService";
import { getProjects } from "../../services/projectService";
import CuttingPlans from "./CuttingPlans";
import { useCompanyPicker, fmtQty, fmtMm, articleLabel } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";
import { useDialog } from "../../components/useful/DialogProvider";

/**
 * VITRAGES — one clear place for glass:
 *   compositions  "44.2 / 10 / 6": its layers (2 × 4 mm, 10 mm, 6 mm…),
 *                 the plateaux each layer may be cut from (the optimiser
 *                 picks among them from the stock), film / spacer extras.
 *                 Chosen on a chassis line wherever a glass unit is asked.
 *   débit         a project's panes, plateaux to take and cutting layouts.
 */
const EXTRA_MEASURES = ["area", "perimeter", "count"];
const emptyType = () => ({ name: "", code: "", description: "", workshop: "VIT", labourPerPane: 0, labourPerM2: 0, layers: [{ label: "", thickness: 4, count: 1, sheets: [] }], extras: [], isActive: true });

export default function Glazing() {
  const { t } = useI18n();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/workshops" }, { label: t("tech.glassCuttingTitle") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Layers size={20} /><h1>{t("tech.glassCuttingTitle")}</h1></div>
          <p className="pageSubtitle">{t("tech.glassCuttingSubtitle")}</p>
        </div>
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>
      {companyId && <GlassCuttingTab companyId={companyId} />}
    </div>
  );
}

/** Small cross-section of a composition: glass sheets, films, gaps. */
function GlassStack({ type }) {
  const parts = [];
  (type.layers || []).forEach((l, i) => {
    if (i) parts.push(<i key={`g${i}`} className={styles.gap} />);
    for (let k = 0; k < (l.count || 1); k += 1) {
      if (k) parts.push(<i key={`f${i}-${k}`} className={styles.film} />);
      parts.push(<i key={`l${i}-${k}`} style={{ width: Math.max(4, Math.min(14, (l.thickness || 4) * 1.2)) }} />);
    }
  });
  return <span className={styles.glassStack} aria-hidden="true">{parts}</span>;
}

function sheetText(p) {
  if (!p) return "";
  return `${p.name}${p.sheetWidth ? ` — ${fmtMm(p.sheetWidth)}×${fmtMm(p.sheetHeight)}` : ""} · stock ${fmtQty(p.quantity ?? 0)}`;
}

// ------------------------------------------------------------------
export function GlassTypesTab({ companyId }) {
  const dialog = useDialog();
  const { t } = useI18n();
  const can = useCan();
  const [types, setTypes] = useState([]);
  const [glass, setGlass] = useState([]);
  const [others, setOthers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setTypes(await getGlassTypes(companyId)); } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [companyId, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getCatalogArticles(companyId, { materialType: "glass" }).then(setGlass).catch(() => {});
    getCatalogArticles(companyId, { materialType: "consumable,gasket,accessory,panel,profile" }).then(setOthers).catch(() => {});
  }, [companyId]);

  const glassById = useMemo(() => new Map(glass.map((g) => [g._id, g])), [glass]);
  const glassOptions = glass.map((g) => ({ value: g._id, label: `${articleLabel(g)}${g.stockMode === "sheet" && g.sheetWidth ? ` — ${fmtMm(g.sheetWidth)}×${fmtMm(g.sheetHeight)}` : ` — ${t("glazing.noFormat")}`}`, searchText: `${g.name} ${g.internalReference || ""} ${g.sheetWidth || ""}x${g.sheetHeight || ""}` }));
  const otherOptions = others.map((p) => ({ value: p._id, label: articleLabel(p) }));

  const save = async () => {
    setError("");
    const body = {
      ...editing, company: companyId,
      layers: editing.layers.map((l) => ({ ...l, sheets: l.sheets.map((x) => x._id || x) })),
      extras: editing.extras.map((x) => ({ ...x, product: x.product?._id || x.product || null })),
    };
    try {
      if (editing._id) await updateGlassType(editing._id, body); else await createGlassType(body);
      setEditing(null);
      setNotice(t("prod.saved"));
      load();
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const remove = async (gt) => {
    if (!(await dialog.confirm(t("glazing.deleteConfirm")))) return;
    try {
      const r = await deleteGlassType(gt._id);
      setNotice(r.deactivated ? t("glazing.deactivated") : t("prod.deleted"));
      load();
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };

  const setLayer = (i, patch) => setEditing({ ...editing, layers: editing.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setExtra = (i, patch) => setEditing({ ...editing, extras: editing.extras.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const idOf = (x) => (x && typeof x === "object" ? x._id : x);

  return (
    <>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      <div className={purch.sectionHeader}>
        <p className={s.muted} style={{ margin: 0 }}>{t("glazing.typesHint")}</p>
        {can("production.catalog.edit") && <button type="button" className="btnPrimary" onClick={() => setEditing(emptyType())}><Plus size={15} /> {t("glazing.newType")}</button>}
      </div>
      {types.length === 0 ? <p className={s.muted}>{t("glazing.noTypes")}</p> : (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: "70px 1.2fr 2.6fr 1fr 80px" }}>
            <span /><span>{t("glazing.name")}</span><span>{t("glazing.layers")}</span><span>{t("glazing.extras")}</span><span />
          </div>
          {types.map((gt) => (
            <div key={gt._id} className="dataTableRow" style={{ gridTemplateColumns: "70px 1.2fr 2.6fr 1fr 80px", opacity: gt.isActive ? 1 : 0.55 }}>
              <span><GlassStack type={gt} /></span>
              <span><strong>{gt.name}</strong>{gt.code && <small className={s.muted} style={{ display: "block" }}>{gt.code}</small>}{!gt.isActive && <small className={s.muted} style={{ display: "block" }}>{t("prod.inactive")}</small>}</span>
              <span>
                {gt.layers.map((l, i) => (
                  <small key={i} style={{ display: "block" }}>
                    <strong>{l.count > 1 ? `${l.count} × ` : ""}{l.label || (l.thickness ? `${l.thickness} mm` : `#${i + 1}`)}</strong>
                    <span className={s.muted}> — {l.sheets.length ? l.sheets.map((p) => (p.sheetWidth ? `${fmtMm(p.sheetWidth)}×${fmtMm(p.sheetHeight)} (${fmtQty(p.quantity ?? 0)})` : p.name)).join(" · ") : t("glazing.noSheet")}</span>
                  </small>
                ))}
              </span>
              <span className={s.muted}>{gt.extras.map((x) => x.label || x.product?.name).filter(Boolean).join(", ") || "—"}</span>
              <span className="dataTableActions">
                {can("production.catalog.edit") && <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => setEditing({ ...gt, layers: gt.layers.map((l) => ({ ...l, sheets: [...l.sheets] })), extras: gt.extras.map((x) => ({ ...x })) })}><Pencil size={14} /></button>}
                {can("production.catalog.delete") && <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => remove(gt)}><Trash2 size={14} /></button>}
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalWide}>
            <h3>{editing._id ? t("glazing.editType") : t("glazing.newType")}</h3>
            <div className={purch.formGrid}>
              <label className={purch.field}>{t("glazing.name")}<input className={purch.input} value={editing.name} placeholder="44.2 / 10 / 6" onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
              <label className={purch.field}>{t("glazing.code")}<input className={purch.input} value={editing.code || ""} placeholder="442-10-6" onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></label>
              <label className={purch.field}>{t("glazing.workshop")}<input className={purch.input} value={editing.workshop || "VIT"} onChange={(e) => setEditing({ ...editing, workshop: e.target.value.toUpperCase() })} /></label>
              <label className={purch.field}>{t("glazing.labourPerPane")} (min)<input className={purch.input} type="number" min="0" step="any" value={editing.labourPerPane ?? 0} onChange={(e) => setEditing({ ...editing, labourPerPane: e.target.value })} /></label>
              <label className={purch.field}>{t("glazing.labourPerM2")} (min)<input className={purch.input} type="number" min="0" step="any" value={editing.labourPerM2 ?? 0} onChange={(e) => setEditing({ ...editing, labourPerM2: e.target.value })} /></label>
              <label className={purch.field} style={{ gridColumn: "1 / -1" }}>{t("glazing.description")}<input className={purch.input} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
            </div>

            <h4 style={{ margin: "14px 0 4px" }}>{t("glazing.layers")}</h4>
            <p className={s.muted} style={{ fontSize: "0.76rem", margin: "0 0 8px" }}>{t("glazing.layersHint")}</p>
            <div className={styles.tableRows}>
              {editing.layers.map((l, i) => (
                <div key={i} className={styles.layerRow}>
                  <label>{t("glazing.layerLabel")}<input className={purch.input} value={l.label} placeholder={i === 0 ? "Feuilleté 44.2 (2 × 4 mm)" : `Verre ${l.thickness || ""} mm`} onChange={(e) => setLayer(i, { label: e.target.value })} /></label>
                  <label>{t("glazing.thickness")} (mm)<input className={purch.input} type="number" min="0" step="any" value={l.thickness ?? ""} onChange={(e) => setLayer(i, { thickness: e.target.value })} /></label>
                  <label>{t("glazing.count")}<input className={purch.input} type="number" min="1" max="6" step="1" value={l.count} onChange={(e) => setLayer(i, { count: e.target.value })} /></label>
                  <label>{t("glazing.sheets")}
                    <span className={styles.sheetPick}>
                      {l.sheets.map((x) => {
                        const p = typeof x === "object" ? x : glassById.get(x);
                        const noFormat = p && !(p.stockMode === "sheet" && p.sheetWidth);
                        return (
                          <span key={idOf(x)} className={styles.chip} title={noFormat ? t("glazing.noFormatHint") : ""}>
                            {noFormat && <AlertTriangle size={11} className={styles.unmapped} />}{sheetText(p) || idOf(x)}
                            <button type="button" className="tableActionBtn" style={{ padding: 0, minWidth: 0, height: "auto" }} onClick={() => setLayer(i, { sheets: l.sheets.filter((y) => idOf(y) !== idOf(x)) })}><X size={11} /></button>
                          </span>
                        );
                      })}
                    </span>
                    <SearchSelect value="" onSelect={(v) => v && !l.sheets.some((y) => idOf(y) === v) && setLayer(i, { sheets: [...l.sheets, glassById.get(v) || v] })} options={glassOptions.filter((o) => !l.sheets.some((y) => idOf(y) === o.value))} icon={Package} placeholder={t("glazing.addSheet")} noResultsLabel={t("common.noResults")} />
                  </label>
                  <button type="button" className="tableActionBtn tableActionBtnDanger" disabled={editing.layers.length < 2} onClick={() => setEditing({ ...editing, layers: editing.layers.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btnEdit" style={{ marginTop: 6 }} onClick={() => setEditing({ ...editing, layers: [...editing.layers, { label: "", thickness: 6, count: 1, sheets: [] }] })}><Plus size={14} /> {t("glazing.addLayer")}</button>

            <h4 style={{ margin: "14px 0 4px" }}>{t("glazing.extras")}</h4>
            <p className={s.muted} style={{ fontSize: "0.76rem", margin: "0 0 8px" }}>{t("glazing.extrasHint")}</p>
            <div className={styles.tableRows}>
              {editing.extras.map((x, i) => (
                <div key={i} className={styles.extraRow}>
                  <label>{t("prod.editor.article")}<SearchSelect value={idOf(x.product) || ""} onSelect={(v) => setExtra(i, { product: v })} options={otherOptions} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} /></label>
                  <label>{t("glazing.layerLabel")}<input className={purch.input} value={x.label} placeholder="Film PVB" onChange={(e) => setExtra(i, { label: e.target.value })} /></label>
                  <label>{t("glazing.measure")}<CustomSelect value={x.measure} onSelect={(v) => setExtra(i, { measure: v })} options={EXTRA_MEASURES.map((m) => ({ value: m, label: t(`glazing.measures.${m}`) }))} /></label>
                  <label>{t("prod.quantity")}<input className={purch.input} type="number" min="0" step="any" value={x.qty} onChange={(e) => setExtra(i, { qty: e.target.value })} /></label>
                  <label>{t("glazing.inset")}<input className={purch.input} type="number" min="0" step="any" disabled={x.measure !== "perimeter"} value={x.inset ?? 0} onChange={(e) => setExtra(i, { inset: e.target.value })} /></label>
                  <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setEditing({ ...editing, extras: editing.extras.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btnEdit" style={{ marginTop: 6 }} onClick={() => setEditing({ ...editing, extras: [...editing.extras, { product: "", label: "", measure: "area", qty: 1, inset: 0 }] })}><Plus size={14} /> {t("glazing.addExtra")}</button>

            <label className={purch.inlineCheck} style={{ marginTop: 12 }}><input type="checkbox" checked={editing.isActive !== false} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> {t("prod.active")}</label>
            {error && <div className="errorMessage">{error}</div>}
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" disabled={!editing.name.trim()} onClick={save}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------
function GlassCuttingTab({ companyId }) {
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  useEffect(() => {
    setProjectId("");
    getProjects({ companyId }).then((rows) => setProjects(rows.filter((p) => !["cancelled"].includes(p.status) && (p.items?.length ?? 1) > 0))).catch(() => setProjects([]));
  }, [companyId]);
  const options = projects.map((p) => ({ value: p._id, label: `${p.number} — ${p.name}`, searchText: `${p.number} ${p.name} ${p.customer?.name || ""}` }));
  return (
    <>
      <div className={purch.toolbar}>
        <div className="filterGroup" style={{ minWidth: 320 }}>
          <label>{t("glazing.project")}</label>
          <SearchSelect value={projectId} onSelect={setProjectId} options={options} icon={FolderKanban} placeholder={t("glazing.pickProject")} noResultsLabel={t("common.noResults")} />
        </div>
      </div>
      {!projectId ? <p className={s.muted}>{t("glazing.cuttingHint")}</p> : <CuttingPlans key={projectId} projectId={projectId} sections={["glass"]} initialTab="glass" />}
    </>
  );
}
