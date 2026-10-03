import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ruler, Pencil, Search, AlertTriangle, Save } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import CustomSelect from "../../components/useful/CustomSelect";
import { getProducts, updateProduct } from "../../services/productService";
import { getSeries } from "../../services/productionService";
import ProductTechFields, { techToForm, techFromForm } from "../production/ProductTechFields";
import { MATERIAL_TYPES, fmtMm } from "../production/prodShared";
import TechShell from "./TechShell";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "../production/Production.module.css";
import inv from "../production/Inventory.module.css";

const PAGE = 50;

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
 * A profile belongs to a series with a code (AWS 60 · OUV): formulas
 * read its values as OUV.ae, OUV.ch… (see Technique › Catalogue › Séries).
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
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canEdit = can("inventory.articles.edit");
  const seriesName = useMemo(() => new Map(seriesList.map((x) => [String(x._id), x.name])), [seriesList]);
  const seriesOptions = seriesList.map((x) => ({ value: x._id, label: x.name }));

  useEffect(() => { getSeries(companyId).then(setSeriesList).catch(() => setSeriesList([])); }, [companyId]);
  // search as you type, without one request per key
  useEffect(() => { const id = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async (nextPage = 1) => {
    setError("");
    try {
      const { products, pagination } = await getProducts({ companyId, materialType: type, profileSeries: seriesFilter || undefined, search: query, page: nextPage, limit: PAGE });
      setRows((prev) => (nextPage === 1 ? products : [...prev, ...products]));
      setTotal(pagination.total || 0);
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.load"));
    }
  }, [companyId, type, seriesFilter, query, t]);
  useEffect(() => { load(1); }, [load]);

  const open = (p) => { setEditing(p); setForm(techToForm(p)); };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateProduct(editing._id, techFromForm(form));
      setRows((list) => list.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)));
      setEditing(null);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const filters = ["any", ...MATERIAL_TYPES, "none"];
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
          <label>{t("slib.seriesField")}</label>
          <CustomSelect value={seriesFilter} onSelect={setSeriesFilter} options={[{ value: "", label: t("slib.allSeries") }, { value: "none", label: t("slib.noSeries") }, ...seriesOptions]} />
        </div>
      </div>
      {type === "none" && <div className={purch.infoBanner}>{t("tech.noTypeHint")}</div>}
      {error && <div className="errorMessage">{error}</div>}
      <p className={s.muted}>{t("tech.count").replace("{n}", total)}</p>
      <div className={styles.tableWrap}>
        <table className={styles.needTable}>
          <thead>
            <tr>
              <th>{t("prod.editor.article")}</th>
              <th>{t("prod.tech.materialType")}</th>
              <th>{t("slib.seriesCode")}</th>
              <th>{t("tech.technicalData")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const gaps = missing(p);
              const sid = p.profileSeries && typeof p.profileSeries === "object" ? p.profileSeries._id : p.profileSeries;
              return (
                <tr key={p._id}>
                  <td>{p.name}{p.internalReference && <small>{p.internalReference}</small>}</td>
                  <td>{p.materialType ? t(`prod.materialTypes.${p.materialType}`) : <span className={s.muted}>—</span>}<small>{t(`prod.stockModes.${p.stockMode || "unit"}`)}</small></td>
                  <td>{sid ? <>{seriesName.get(String(sid)) || "—"} {p.seriesCode && <span className={styles.chip} style={{ marginLeft: 4 }}><span className={styles.chipCode}>{p.seriesCode}</span></span>}</> : <span className={s.muted}>—</span>}</td>
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
            {!rows.length && <tr><td colSpan={5} className={s.muted}>{t("tech.empty")}</td></tr>}
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
            <ProductTechFields value={form} onChange={setForm} fieldClass={inv.formField} inputClass={inv.textInput} gridClass={inv.formGrid} seriesOptions={seriesOptions} productId={editing._id} productName={editing.name} />
            <p className={s.muted} style={{ fontSize: "0.78rem", marginTop: 10 }}>{t("tech.editHint")}</p>
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setEditing(null)} disabled={saving}>{t("common.cancel")}</button>
              <button type="button" className="btnPrimary" onClick={save} disabled={saving}><Save size={14} /> {saving ? t("common.loading") : t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
