import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ruler, Pencil, Search, AlertTriangle, Save, WandSparkles, Link2, Unlink, RotateCcw, CornerDownRight } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import CustomSelect from "../../components/useful/CustomSelect";
import { getProducts, updateProduct } from "../../services/productService";
import { getSeries, getProfileTypeSuggestions, attachProfileTypes, detachProfileTypes } from "../../services/productionService";
import ProductTechFields, { techToForm, techFromForm } from "../production/ProductTechFields";
import { MATERIAL_TYPES, fmtMm } from "../production/prodShared";
import TechShell from "./TechShell";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "../production/Production.module.css";
import inv from "../production/Inventory.module.css";

const PAGE = 50;
// article fields a profile type gives (services/profileTypes.js FIELD_MAP)
const TYPE_FIELDS = { profileChamber: "ch", profileOuterFin: "ae", profileInnerFin: "ai", profileWidth: "lp", barLength: "barLength", weightPerMeter: "weightPerMeter", perimeter: "perimeter" };

/** What the catalogue formulas and the débit still need for this article. */
function missing(p) {
  const out = [];
  if (p.materialType === "profile") {
    if (!p.barLength) out.push("barLength");
    if (p.profileChamber == null && p.profileOuterFin == null && p.profileInnerFin == null) out.push("profileHeight");
    if (!p.profileWidth) out.push("profileWidth");
  }
  if (p.stockMode === "sheet" && (!p.sheetWidth || !p.sheetHeight)) out.push("sheetSize");
  if (p.materialType === "glass" && !p.thickness) out.push("thickness");
  if (p.materialType === "powder" && !p.coverage) out.push("coverage");
  return out;
}

/** One-line summary of the technical data of an article. */
function summary(p, t) {
  const parts = [];
  if (p.stockMode === "bar" && p.barLength) parts.push(`${t("tech.bar")} ${fmtMm(p.barLength)}`);
  if (p.materialType === "profile") {
    const fins = [p.profileChamber, p.profileOuterFin, p.profileInnerFin];
    if (fins.some((v) => v != null)) {
      const h = fins.reduce((a, v) => a + (Number(v) || 0), 0);
      parts.push(`H ${fmtMm(h)} (${fins.map((v) => fmtMm(v || 0)).join(" + ")})`);
    }
    if (p.profileWidth) parts.push(`L ${fmtMm(p.profileWidth)}`);
    if (p.weightPerMeter) parts.push(`${p.weightPerMeter} kg/m`);
  }
  if (p.stockMode === "sheet" && p.sheetWidth && p.sheetHeight) parts.push(`${t("tech.sheet")} ${fmtMm(p.sheetWidth)} × ${fmtMm(p.sheetHeight)}`);
  if (p.thickness) parts.push(`${p.thickness} mm`);
  if (p.materialType === "powder" && p.coverage) parts.push(`${p.coverage} kg/m²`);
  if (p.stockMode === "unit" && p.packSize) parts.push(`${t("tech.pack")} ${p.packSize}`);
  return parts.join("   ·   ") || "—";
}

/**
 * Technique → Données techniques des articles: every article the
 * catalogue uses with the sizes the formulas and the débit need.
 * Profiles are attached to a TYPE of their series (AWS 60 › Ouvrant):
 * the geometry is typed once on the type, every attached article gets it.
 */
export default function TechDataPage() {
  const { t } = useI18n();
  return (
    <TechShell icon={Ruler} title={t("tech.dataTitle")} subtitle={t("tech.dataSubtitle")}>
      {(companyId) => <TechDataBody companyId={companyId} />}
    </TechShell>
  );
}

function TechDataBody({ companyId }) {
  const { t } = useI18n();
  const can = useCan();
  const [params] = useSearchParams();
  const [type, setType] = useState(params.get("series") ? "profile" : "any");
  const [seriesFilter, setSeriesFilter] = useState(params.get("series") || "");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [seriesList, setSeriesList] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [target, setTarget] = useState({ series: "", type: "", keepOwn: false });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const canEdit = can("inventory.articles.edit") || can("production.catalog.edit");
  const seriesById = useMemo(() => new Map(seriesList.map((x) => [String(x._id), x])), [seriesList]);
  const typeLabel = (p) => {
    const ser = seriesById.get(String(p.profileSeries));
    const ty = ser?.profileTypes?.find((x) => x.key === p.profileType);
    return ser ? `${ser.name} › ${ty?.label || p.profileType}` : "";
  };

  const loadSeries = useCallback(() => getSeries(companyId).then(setSeriesList).catch(() => setSeriesList([])), [companyId]);
  useEffect(() => { loadSeries(); }, [loadSeries]);

  // search as you type, without one request per key
  useEffect(() => { const id = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async (nextPage = 1) => {
    setError("");
    try {
      const { products, pagination } = await getProducts({ companyId, materialType: type, profileSeries: seriesFilter || undefined, search: query, page: nextPage, limit: PAGE });
      setRows((prev) => (nextPage === 1 ? products : [...prev, ...products]));
      setTotal(pagination.total || 0);
      setPage(nextPage);
      if (nextPage === 1) setSelected(new Set());
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.load"));
    }
  }, [companyId, type, seriesFilter, query, t]);
  useEffect(() => { load(1); }, [load]);

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r._id)));

  const attachSelected = async () => {
    setError(""); setNotice("");
    try {
      const r = await attachProfileTypes({ company: companyId, series: target.series, type: target.type, products: [...selected], keepOwn: target.keepOwn });
      setNotice(t("ptypes.attached").replace("{n}", r.attached));
      await Promise.all([load(1), loadSeries()]);
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const detachSelected = async () => {
    setError(""); setNotice("");
    try {
      const r = await detachProfileTypes({ company: companyId, products: [...selected] });
      setNotice(t("ptypes.detached").replace("{n}", r.detached));
      await Promise.all([load(1), loadSeries()]);
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };

  const open = (p) => { setEditing(p); setForm(techToForm(p)); };
  const saveEdit = async (extra = {}) => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateProduct(editing._id, extra.resetToType ? { resetToType: true } : techFromForm(form));
      setRows((list) => list.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)));
      if (extra.resetToType) { setEditing({ ...editing, ...updated }); setForm(techToForm(updated)); } else setEditing(null);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const filters = ["any", ...MATERIAL_TYPES, "none"];
  const targetSeries = seriesById.get(target.series);
  const editingType = editing?.profileSeries ? seriesById.get(String(editing.profileSeries))?.profileTypes?.find((x) => x.key === editing.profileType) : null;

  return (
    <>
      <div className={s.tabs} style={{ flexWrap: "wrap" }}>
        {filters.map((f) => (
          <button key={f} type="button" className={type === f ? s.tabActive : s.tab} onClick={() => setType(f)}>
            {f === "any" ? t("tech.allTechnical") : f === "none" ? t("tech.noType") : t(`prod.materialTypes.${f}`)}
          </button>
        ))}
      </div>

      <div className={purch.toolbar}>
        <div className="filterGroup" style={{ minWidth: 300 }}>
          <label>{t("tech.search")}</label>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }} />
            <input className={purch.input} style={{ paddingLeft: 30 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("tech.searchPlaceholder")} />
          </div>
        </div>
        <div className="filterGroup">
          <label>{t("ptypes.seriesFilter")}</label>
          <CustomSelect value={seriesFilter} onSelect={setSeriesFilter}
            options={[{ value: "", label: t("ptypes.allSeries") }, { value: "none", label: t("ptypes.notAttached") }, ...seriesList.map((x) => ({ value: x._id, label: x.name }))]} />
        </div>
        {canEdit && (
          <div className="filterGroup" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <button type="button" className="btnEdit" onClick={() => setAutoOpen(true)}><WandSparkles size={14} /> {t("ptypes.auto")}</button>
          </div>
        )}
      </div>

      {type === "none" && <div className={purch.infoBanner}>{t("tech.noTypeHint")}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      {error && <div className="errorMessage">{error}</div>}

      {canEdit && selected.size > 0 && (
        <div className={purch.panel} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, padding: "10px 12px", marginBottom: 10 }}>
          <strong style={{ alignSelf: "center" }}>{t("ptypes.selected").replace("{n}", selected.size)}</strong>
          <div className="filterGroup" style={{ minWidth: 180 }}>
            <label>{t("prod.series")}</label>
            <CustomSelect value={target.series} onSelect={(v) => setTarget({ ...target, series: v, type: "" })}
              options={[{ value: "", label: t("ptypes.pickSeries") }, ...seriesList.filter((x) => (x.profileTypes || []).length).map((x) => ({ value: x._id, label: x.name }))]} />
          </div>
          <div className="filterGroup" style={{ minWidth: 180 }}>
            <label>{t("ptypes.type")}</label>
            <CustomSelect value={target.type} onSelect={(v) => setTarget({ ...target, type: v })}
              options={[{ value: "", label: t("ptypes.pickType") }, ...(targetSeries?.profileTypes || []).map((x) => ({ value: x.key, label: x.label }))]} />
          </div>
          <label className={purch.inlineCheck} style={{ alignSelf: "center" }}>
            <input type="checkbox" checked={target.keepOwn} onChange={(e) => setTarget({ ...target, keepOwn: e.target.checked })} /> {t("ptypes.keepOwn")}
          </label>
          <button type="button" className="btnPrimary" disabled={!target.series || !target.type} onClick={attachSelected}><Link2 size={14} /> {t("ptypes.attach")}</button>
          <button type="button" className="btnCancel" onClick={detachSelected}><Unlink size={14} /> {t("ptypes.detach")}</button>
        </div>
      )}

      <p className={s.muted}>{t("tech.count").replace("{n}", total)}</p>
      <div className={styles.tableWrap}>
        <table className={styles.needTable}>
          <thead>
            <tr>
              {canEdit && <th style={{ width: 28 }}><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label={t("ptypes.selectAll")} /></th>}
              <th>{t("prod.editor.article")}</th>
              <th>{t("prod.tech.materialType")}</th>
              <th>{t("ptypes.seriesType")}</th>
              <th>{t("tech.technicalData")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const gaps = missing(p);
              const attachedTo = typeLabel(p);
              const own = (p.geometryOwn || []).map((f) => TYPE_FIELDS[f]).filter(Boolean);
              return (
                <tr key={p._id}>
                  {canEdit && <td><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggle(p._id)} aria-label={p.name} /></td>}
                  <td>{p.name}{p.internalReference && <small>{p.internalReference}</small>}</td>
                  <td>{p.materialType ? t(`prod.materialTypes.${p.materialType}`) : <span className={s.muted}>—</span>}<small>{t(`prod.stockModes.${p.stockMode || "unit"}`)}</small></td>
                  <td>
                    {attachedTo
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CornerDownRight size={12} style={{ opacity: 0.6 }} />{attachedTo}</span>
                      : p.baseProduct ? <span className={s.muted} title={t("ptypes.followsBaseHint")}>{t("ptypes.followsBase")}</span> : <span className={s.muted}>—</span>}
                    {own.length > 0 && <small title={t("ptypes.ownHint")}>{t("ptypes.own")} : {own.join(", ")}</small>}
                  </td>
                  <td>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{summary(p, t)}</span>
                    {gaps.length > 0 && (
                      <small style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--tone-e8b93f)" }}>
                        <AlertTriangle size={12} /> {t("tech.missing")} : {gaps.map((g) => t(`tech.gaps.${g}`)).join(", ")}
                      </small>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {canEdit && <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => open(p)}><Pencil size={13} /></button>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={canEdit ? 6 : 5} className={s.muted}>{t("tech.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length < total && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <button type="button" className="btnEdit" onClick={() => load(page + 1)}>{t("tech.more")}</button>
        </div>
      )}

      {editing && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <div className={purch.modalCard} style={{ maxWidth: 720 }}>
            <h3><Ruler size={16} /> {editing.name}</h3>
            {editing.internalReference && <p className={s.muted} style={{ marginTop: -6 }}>{editing.internalReference}</p>}
            {editingType && (
              <div className={purch.infoBanner} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 240 }}>
                  {t("ptypes.inherits").replace("{type}", typeLabel(editing))}
                  {(editing.geometryOwn || []).length > 0 && <><br /><strong>{t("ptypes.own")} :</strong> {(editing.geometryOwn || []).map((f) => TYPE_FIELDS[f]).filter(Boolean).join(", ")}</>}
                </span>
                {(editing.geometryOwn || []).length > 0 && (
                  <button type="button" className="btnEdit" disabled={saving} onClick={() => saveEdit({ resetToType: true })}><RotateCcw size={13} /> {t("ptypes.reset")}</button>
                )}
              </div>
            )}
            <ProductTechFields value={form} onChange={setForm} fieldClass={inv.formField} inputClass={inv.textInput} gridClass={inv.formGrid} />
            <p className={s.muted} style={{ fontSize: "0.78rem", marginTop: 10 }}>{t("tech.editHint")}</p>
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setEditing(null)} disabled={saving}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" onClick={() => saveEdit()} disabled={saving}><Save size={14} /> {saving ? t("common.loading") : t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      {autoOpen && <AutoAttachModal companyId={companyId} onClose={() => setAutoOpen(false)} onDone={async (n) => { setAutoOpen(false); setNotice(t("ptypes.attached").replace("{n}", n)); await Promise.all([load(1), loadSeries()]); }} />}
    </>
  );
}

const SHORT = { profileChamber: "ch", profileOuterFin: "ae", profileInnerFin: "ai", profileWidth: "lp", barLength: "barre", weightPerMeter: "kg/m", perimeter: "dév." };

/**
 * "Rattachement automatique": series › type proposed for each profile from
 * its name, reference and category; the user unticks what is wrong and
 * confirms. One click instead of a number per profile.
 */
function AutoAttachModal({ companyId, onClose, onDone }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [keepOwn, setKeepOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getProfileTypeSuggestions(companyId)
      .then((d) => { setData(d); setChecked(new Set(d.suggestions.map((x) => x.product._id))); })
      .catch((err) => setError(err.response?.data?.message || t("prod.errors.load")));
  }, [companyId, t]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const groups = new Map();
      for (const sug of data.suggestions) {
        if (!checked.has(sug.product._id)) continue;
        const k = `${sug.series._id}|${sug.type.key}`;
        if (!groups.has(k)) groups.set(k, { series: sug.series._id, type: sug.type.key, products: [] });
        groups.get(k).products.push(sug.product._id);
      }
      const r = await attachProfileTypes({ company: companyId, groups: [...groups.values()], keepOwn });
      onDone(r.attached);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.save"));
      setBusy(false);
    }
  };

  const list = data?.suggestions || [];
  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={purch.modalCard} style={{ maxWidth: 860 }}>
        <h3><WandSparkles size={16} /> {t("ptypes.auto")}</h3>
        <p className={s.muted}>{t("ptypes.autoHint")}</p>
        {error && <div className="errorMessage">{error}</div>}
        {!data && !error && <p className={s.muted}>{t("common.loading")}</p>}
        {data && data.seriesWithoutTypes.length > 0 && (
          <div className={purch.infoBanner}>{t("ptypes.noTypesYet").replace("{list}", data.seriesWithoutTypes.join(", "))}</div>
        )}
        {data && !list.length && <p className={s.muted}>{t("ptypes.nothingToSuggest")}</p>}
        {list.length > 0 && (
          <div className={styles.tableWrap} style={{ maxHeight: 420, overflow: "auto" }}>
            <table className={styles.needTable}>
              <thead>
                <tr>
                  <th style={{ width: 28 }}><input type="checkbox" checked={checked.size === list.length} onChange={() => setChecked(checked.size === list.length ? new Set() : new Set(list.map((x) => x.product._id)))} aria-label={t("ptypes.selectAll")} /></th>
                  <th>{t("prod.editor.article")}</th>
                  <th>{t("ptypes.seriesType")}</th>
                  <th>{t("ptypes.changes")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((sug) => (
                  <tr key={sug.product._id}>
                    <td><input type="checkbox" checked={checked.has(sug.product._id)} onChange={() => setChecked((prev) => { const n = new Set(prev); if (n.has(sug.product._id)) n.delete(sug.product._id); else n.add(sug.product._id); return n; })} aria-label={sug.product.name} /></td>
                    <td>{sug.product.name}{sug.product.internalReference && <small>{sug.product.internalReference}</small>}</td>
                    <td><strong>{sug.series.name} › {sug.type.label}</strong>{sug.current && <small>{t("ptypes.wasAttached")}</small>}</td>
                    <td className={s.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
                      {Object.entries(sug.changes).map(([f, [from, to]]) => (from === null || from === undefined ? `${SHORT[f] || f} ${to}` : `${SHORT[f] || f} ${from} → ${to}`)).join("  ·  ") || t("ptypes.noChange")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.length > 0 && (
          <label className={purch.inlineCheck} style={{ marginTop: 10 }}>
            <input type="checkbox" checked={keepOwn} onChange={(e) => setKeepOwn(e.target.checked)} /> {t("ptypes.keepOwn")}
          </label>
        )}
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose} disabled={busy}>{t("common.cancel")}</button>
          {list.length > 0 && (
            <button type="button" className="btnPrimary" disabled={busy || !checked.size} onClick={confirm}>
              <Link2 size={14} /> {busy ? t("common.loading") : t("ptypes.attachN").replace("{n}", checked.size)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
