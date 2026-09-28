import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Plus, X, Copy, Trash2, Library, Layers, Download, Pencil, AlertTriangle } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchBar from "../../components/useful/SearchBar";
import {
  getChassisModels, getSeries, createSeries, updateSeries, deleteSeries, getCatalog,
  importTemplate, createChassisModel, duplicateChassisModel, deleteChassisModel,
} from "../../services/productionService";
import ChassisDrawing from "./ChassisDrawing";
import { useCompanyPicker, familyLabel } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";

/**
 * Chassis catalogue of the company: its MODELS (what it can build, with
 * formulas), its SERIES (profile systems and their variables) and the
 * LIBRARY of standard templates to start from.
 */
export default function Catalog() {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [tab, setTab] = useState("models");
  const [catalog, setCatalog] = useState({ families: [], templates: [] });
  const [series, setSeries] = useState([]);
  const [models, setModels] = useState([]);
  const [filters, setFilters] = useState({ family: "", series: "", search: "", active: "true" });
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSeries = useCallback(async () => { if (companyId) setSeries(await getSeries(companyId)); }, [companyId]);
  const loadModels = useCallback(async () => {
    if (!companyId) return;
    try {
      setModels(await getChassisModels({ companyId, ...filters }));
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [companyId, filters, t]);
  useEffect(() => { getCatalog().then(setCatalog).catch(() => {}); }, []);
  useEffect(() => { loadSeries().catch(() => {}); }, [loadSeries]);
  useEffect(() => { loadModels(); }, [loadModels]);

  const familyOptions = [{ value: "", label: t("sales.all") }, ...catalog.families.map((f) => ({ value: f.key, label: familyLabel(catalog.families, f.key, language) }))];
  const seriesOptions = [{ value: "", label: t("sales.all") }, ...series.map((x) => ({ value: x._id, label: x.name }))];

  const doImport = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const m = await importTemplate({ company: companyId, templateKey: importing.template.key, series: importing.series || null, name: importing.name || undefined });
      navigate(`/production/catalog/models/${m._id}`);
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const newBlank = async () => {
    try {
      const m = await createChassisModel({ company: companyId, name: t("prod.catalog.newModelName"), family: "autre" });
      navigate(`/production/catalog/models/${m._id}`);
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const duplicate = async (m) => {
    try { const copy = await duplicateChassisModel(m._id); navigate(`/production/catalog/models/${copy._id}`); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const remove = async (m) => {
    if (!window.confirm(t("prod.catalog.deleteModel"))) return;
    try { const r = await deleteChassisModel(m._id); setNotice(r.message || t("prod.deleted")); loadModels(); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/workshops" }, { label: t("prod.catalog.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Boxes size={20} /><h1>{t("prod.catalog.title")}</h1></div>
          <p className="pageSubtitle">{t("prod.catalog.subtitle")}</p>
        </div>
        {companyId && tab === "models" && (
          <div className={purch.headerActions}>
            <button type="button" className="btnEdit" onClick={newBlank}><Plus size={15} /> {t("prod.catalog.blankModel")}</button>
            <button type="button" className="btnPrimary" onClick={() => setTab("library")}><Library size={15} /> {t("prod.catalog.fromLibrary")}</button>
          </div>
        )}
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>
      <div className={s.tabs}>
        <button type="button" className={tab === "models" ? s.tabActive : s.tab} onClick={() => setTab("models")}><Boxes size={14} /> {t("prod.catalog.tabs.models")} <span className={s.count}>{models.length}</span></button>
        <button type="button" className={tab === "series" ? s.tabActive : s.tab} onClick={() => setTab("series")}><Layers size={14} /> {t("prod.catalog.tabs.series")} <span className={s.count}>{series.length}</span></button>
        <button type="button" className={tab === "library" ? s.tabActive : s.tab} onClick={() => setTab("library")}><Library size={14} /> {t("prod.catalog.tabs.library")} <span className={s.count}>{catalog.templates.length}</span></button>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}

      {tab === "models" && (
        <>
          <div className={purch.toolbar}>
            <div className="filterGroup"><label>{t("prod.family")}</label><CustomSelect value={filters.family} onSelect={(v) => setFilters({ ...filters, family: v })} options={familyOptions} /></div>
            <div className="filterGroup"><label>{t("prod.series")}</label><CustomSelect value={filters.series} onSelect={(v) => setFilters({ ...filters, series: v })} options={seriesOptions} /></div>
            <div className="filterGroup"><label>{t("prod.config.status")}</label><CustomSelect value={filters.active} onSelect={(v) => setFilters({ ...filters, active: v })} options={[{ value: "true", label: t("prod.active") }, { value: "false", label: t("prod.inactive") }, { value: "all", label: t("sales.all") }]} /></div>
            <SearchBar onSearch={(v) => setFilters({ ...filters, search: v })} onClear={() => setFilters({ ...filters, search: "" })} placeholder={t("prod.catalog.searchModels")} />
          </div>
          {models.length === 0 ? (
            <div className="emptyStateBlock">
              <div className="emptyStateIcon"><Boxes size={28} /></div>
              <h2>{t("prod.catalog.emptyTitle")}</h2>
              <p>{t("prod.catalog.emptyMessage")}</p>
              <button type="button" className="btnPrimary" onClick={() => setTab("library")}><Library size={15} /> {t("prod.catalog.fromLibrary")}</button>
            </div>
          ) : (
            <div className="dataTable">
              <div className="dataTableHead" style={{ gridTemplateColumns: "64px 2fr 1.2fr 1fr 1fr 90px" }}>
                <span /><span>{t("prod.model")}</span><span>{t("prod.family")}</span><span>{t("prod.series")}</span><span>{t("prod.catalog.components")}</span><span />
              </div>
              {models.map((m) => (
                <div key={m._id} className={`dataTableRow ${purch.clickableRow}`} style={{ gridTemplateColumns: "64px 2fr 1.2fr 1fr 1fr 90px", opacity: m.isActive ? 1 : 0.55 }}
                  role="button" tabIndex={0} onClick={() => navigate(`/production/catalog/models/${m._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/production/catalog/models/${m._id}`)}>
                  <span><ChassisDrawing drawing={m.drawing} image={m.image?.url} L={1200} H={1000} width={56} height={44} params={{}} /></span>
                  <span><strong>{m.name}</strong>{m.code && <small className={s.muted} style={{ display: "block" }}>{m.code}</small>}</span>
                  <span className="dataTableCellMuted">{familyLabel(catalog.families, m.family, language)}</span>
                  <span className="dataTableCellMuted">{m.series?.name || "—"}</span>
                  <span>{m.componentCount}{m.unmapped > 0 && <span className={`${s.tag} ${s.tagWarn}`} title={t("prod.catalog.unmappedHint")}><AlertTriangle size={11} /> {m.unmapped} {t("prod.catalog.unmapped")}</span>}</span>
                  <span className="dataTableActions" onClick={(e) => e.stopPropagation()} role="presentation">
                    <button type="button" className="tableActionBtn" onClick={() => duplicate(m)} title={t("prod.duplicate")}><Copy size={14} /></button>
                    <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => remove(m)} title={t("common.delete")}><Trash2 size={14} /></button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "series" && companyId && <SeriesTab companyId={companyId} series={series} families={catalog.families} reload={loadSeries} setError={setError} />}

      {tab === "library" && (
        <>
          <p className={s.muted}>{t("prod.catalog.libraryHint")}</p>
          {catalog.families.map((f) => {
            const list = catalog.templates.filter((tp) => tp.family === f.key);
            if (!list.length) return null;
            return (
              <section key={f.key} className={purch.section}>
                <h2>{familyLabel(catalog.families, f.key, language)}</h2>
                <div className={styles.templateGrid}>
                  {list.map((tp) => (
                    <div key={tp.key} className={styles.templateCard}>
                      <div className={styles.drawing}><ChassisDrawing drawing={tp.drawing} L={tp.drawing?.type === "railing" ? 3000 : 1200} H={1000} width={120} height={84} /></div>
                      <h4>{language === "fr" || language === "ar" ? tp.name : tp.name_en || tp.name}</h4>
                      <p>{tp.description}</p>
                      <div className={styles.templateMeta}><span>{tp.components} {t("prod.catalog.components").toLowerCase()}</span><span>{tp.parameters} {t("prod.catalog.parameters").toLowerCase()}</span></div>
                      <button type="button" className="btnEdit" onClick={() => setImporting({ template: tp, series: filters.series || "", name: "" })}><Download size={14} /> {t("prod.catalog.import")}</button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      {importing && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <form className={purch.modalCard} onSubmit={doImport}>
            <h3>{t("prod.catalog.importTitle")}</h3>
            <p className={s.muted}>{importing.template.name}</p>
            <label className={purch.field}>{t("prod.series")}
              <CustomSelect value={importing.series} onSelect={(v) => setImporting({ ...importing, series: v })} options={[{ value: "", label: t("prod.catalog.noSeries") }, ...series.map((x) => ({ value: x._id, label: x.name }))]} />
            </label>
            <label className={purch.field}>{t("prod.catalog.modelName")}
              <input className={purch.input} value={importing.name} placeholder={importing.template.name} onChange={(e) => setImporting({ ...importing, name: e.target.value })} />
            </label>
            <p className={s.muted}>{t("prod.catalog.importHint")}</p>
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setImporting(null)}>{t("common.cancel")}</button>
              <button type="submit" className="btnPrimary">{t("prod.catalog.import")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SeriesTab({ companyId, series, families, reload, setError }) {
  const { t, language } = useI18n();
  const [form, setForm] = useState(null);
  const edit = (x) => setForm(x ? { _id: x._id, name: x.name, supplier: x.supplier || "", description: x.description || "", families: x.families || [], variables: (x.variables || []).map((v) => ({ ...v })) } : { name: "", supplier: "", description: "", families: [], variables: [] });
  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { ...form, company: companyId, variables: form.variables.filter((v) => v.key).map((v) => ({ ...v, value: Number(v.value) })) };
      if (form._id) await updateSeries(form._id, body); else await createSeries(body);
      setForm(null);
      reload();
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const remove = async (x) => {
    if (!window.confirm(t("prod.catalog.deleteSeries"))) return;
    try { await deleteSeries(x._id); reload(); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const famLabel = useMemo(() => (k) => familyLabel(families, k, language), [families, language]);
  return (
    <>
      <p className={s.muted}>{t("prod.catalog.seriesHint")}</p>
      <div className={purch.sectionHeader}><span /><button type="button" className="btnPrimary" onClick={() => edit(null)}><Plus size={15} /> {t("prod.catalog.newSeries")}</button></div>
      {form && (
        <form className={purch.panel} onSubmit={save}>
          <div className={purch.sectionHeader}><h3>{form._id ? form.name : t("prod.catalog.newSeries")}</h3><button type="button" className="tableActionBtn" onClick={() => setForm(null)}><X size={14} /></button></div>
          <div className={purch.formGrid}>
            <label className={purch.field}>{t("prod.config.name")}<input className={purch.input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Coulissant 67" /></label>
            <label className={purch.field}>{t("prod.catalog.supplier")}<input className={purch.input} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></label>
            <label className={purch.field}>{t("prod.config.description")}<input className={purch.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          </div>
          <div className={purch.field}>{t("prod.catalog.families")}
            <div className={styles.chips}>
              {families.map((f) => {
                const on = form.families.includes(f.key);
                return <button key={f.key} type="button" className={styles.chip} style={on ? { borderColor: "#6ea8fe", color: "var(--color-text-primary)" } : undefined} onClick={() => setForm({ ...form, families: on ? form.families.filter((x) => x !== f.key) : [...form.families, f.key] })}>{famLabel(f.key)}</button>;
              })}
            </div>
          </div>
          <h4 className={purch.subTitle}>{t("prod.catalog.variables")}</h4>
          <p className={s.muted}>{t("prod.catalog.variablesHint")}</p>
          <VariablesEditor rows={form.variables} onChange={(variables) => setForm({ ...form, variables })} />
          <div className={purch.formActions}>
            <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary">{t("common.save")}</button>
          </div>
        </form>
      )}
      <div className="dataTable">
        <div className="dataTableHead" style={{ gridTemplateColumns: "1.4fr 1.2fr 2fr 90px 80px" }}>
          <span>{t("prod.series")}</span><span>{t("prod.catalog.supplier")}</span><span>{t("prod.catalog.variables")}</span><span>{t("prod.catalog.tabs.models")}</span><span />
        </div>
        {series.map((x) => (
          <div key={x._id} className="dataTableRow" style={{ gridTemplateColumns: "1.4fr 1.2fr 2fr 90px 80px" }}>
            <span><strong>{x.name}</strong><small className={s.muted} style={{ display: "block" }}>{(x.families || []).map(famLabel).join(", ")}</small></span>
            <span className="dataTableCellMuted">{x.supplier || "—"}</span>
            <span className={styles.chips}>{(x.variables || []).slice(0, 10).map((v) => <span key={v.key} className={styles.chip} title={v.label}><span className={styles.chipCode}>{v.key}</span> = {v.value}</span>)}{(x.variables || []).length > 10 && <span className={styles.chip}>+{x.variables.length - 10}</span>}</span>
            <span>{x.modelCount || 0}</span>
            <span className="dataTableActions">
              <button type="button" className="tableActionBtn" onClick={() => edit(x)} title={t("common.edit")}><Pencil size={14} /></button>
              <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => remove(x)} title={t("common.delete")}><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Editable list of { key, label, value } variables. */
export function VariablesEditor({ rows, onChange }) {
  const { t } = useI18n();
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={styles.tableRows}>
      {rows.map((v, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className={`${styles.gridRow} ${styles.varRow}`}>
          <label>{i === 0 ? t("prod.editor.key") : ""}<input className={`${purch.input} ${styles.formula}`} value={v.key} onChange={(e) => set(i, { key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })} placeholder="jl" /></label>
          <label>{i === 0 ? t("prod.editor.label") : ""}<input className={purch.input} value={v.label || ""} onChange={(e) => set(i, { label: e.target.value })} /></label>
          <label>{i === 0 ? t("prod.editor.value") : ""}<input className={purch.input} type="number" step="any" value={v.value} onChange={(e) => set(i, { value: e.target.value })} /></label>
          <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" className="btnEdit" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...rows, { key: "", label: "", value: 0 }])}><Plus size={14} /> {t("prod.editor.addVariable")}</button>
    </div>
  );
}
