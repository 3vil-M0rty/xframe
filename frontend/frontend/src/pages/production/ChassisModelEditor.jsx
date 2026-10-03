import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Boxes, Save, Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Copy, FlaskConical, AlertTriangle, Package, ImagePlus, X,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import { canSeeFinancials } from "../../utils/permissions";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import {
  getChassisModel, updateChassisModel, getSeries, getWorkshops, getFinishes, getCatalogArticles,
  getChassisModels, getGlassTypes, getCatalog, testChassisModel, uploadChassisModelImage, deleteChassisModelImage,
} from "../../services/productionService";
import { check, isValidVariableName } from "../../utils/formula";
import ChassisDrawing from "./ChassisDrawing";
import { DRAWING_TYPES, OPENINGS } from "../../utils/chassisSketch";
import { VariablesEditor } from "./Catalog";
import {
  COMPONENT_KINDS, PARAM_TYPES, FINISH_MODES, ANGLES, PRICING_MODES, KIND_MATERIALS, DEFAULT_MEASURE,
  familyLabel, articleLabel, defaultParams, formatMoney, fmtQty, fmtMm,
} from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

/** Formula input with instant syntax / variable check. */
function FormulaInput({ value, onChange, known, placeholder, onFocusInsert, optional = false }) {
  const ref = useRef(null);
  const result = useMemo(() => (value && String(value).trim() ? check(String(value), known) : { ok: optional || !!value }), [value, known, optional]);
  return (
    <>
      <input ref={ref} className={`${purch.input} ${styles.formula} ${result.ok ? "" : styles.formulaBad}`} value={value ?? ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocusInsert?.((text) => {
          const el = ref.current;
          const v = String(value ?? "");
          const at = el?.selectionStart ?? v.length;
          onChange(v.slice(0, at) + text + v.slice(at));
        })} />
      {!result.ok && result.error && <span className={styles.formulaError}>{result.error}</span>}
    </>
  );
}

/** A titled block of the editor (module level so inputs keep their focus). */
function Section({ title, hint, children, action }) {
  return (
    <section className={styles.box} style={{ marginBottom: 12 }}>
      <div className={purch.sectionHeader}><h3 style={{ margin: 0 }}>{title}</h3>{action}</div>
      {hint && <p className={s.muted} style={{ marginTop: 0 }}>{hint}</p>}
      {children}
    </section>
  );
}

/**
 * How the model looks on screen and in the devis PDF: a schematic
 * generated from L × H (type, leaves, opening…) — or a picture the
 * company uploads (photo, supplier catalogue drawing), which then
 * replaces the schematic everywhere.
 */
const LEAF_TYPES = ["sliding", "casement", "door", "folding"];
function VisualSection({ model, patch, onImage, onError }) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const d = model.drawing || {};
  const setD = (p) => patch({ drawing: { ...d, ...p } });
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { onImage(await uploadChassisModelImage(model._id, file)); } catch (err) { onError(err.response?.data?.message || t("prod.errors.save")); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const remove = async () => {
    setBusy(true);
    try { onImage(await deleteChassisModelImage(model._id)); } catch (err) { onError(err.response?.data?.message || t("prod.errors.save")); } finally { setBusy(false); }
  };
  const previewParams = { ...defaultParams(model) };
  return (
    <Section title={t("cv.visual")} hint={t("cv.visualHint")}>
      <div className={styles.visualGrid}>
        <div className={styles.visualBox}>
          <span className={s.muted}>{t("cv.schematic")}</span>
          <ChassisDrawing drawing={d} L={d.type === "railing" ? 3000 : 1200} H={1000} params={previewParams} width={170} height={120} />
        </div>
        <div className={styles.visualBox}>
          <span className={s.muted}>{t("cv.picture")}</span>
          {model.image?.url
            ? <img src={model.image.url} alt={model.name} className={styles.visualImg} />
            : <div className={styles.visualEmpty}><ImagePlus size={26} /><small>{t("cv.noPicture")}</small></div>}
          <div style={{ display: "flex", gap: 6 }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0])} />
            <button type="button" className="btnEdit" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> {model.image?.url ? t("cv.changePicture") : t("cv.uploadPicture")}</button>
            {model.image?.url && <button type="button" className="tableActionBtn tableActionBtnDanger" disabled={busy} onClick={remove} title={t("common.delete")}><X size={14} /></button>}
          </div>
        </div>
      </div>
      <div className={purch.formGrid}>
        <label className={purch.field}>{t("cv.drawingType")}
          <CustomSelect value={d.type || "generic"} onSelect={(v) => setD({ type: v })} options={DRAWING_TYPES.map((k) => ({ value: k, label: t(`cv.drawingTypes.${k}`) }))} />
        </label>
        {LEAF_TYPES.includes(d.type) && (
          <label className={purch.field}>{t("cv.leaves")}<input className={purch.input} type="number" min="1" max="12" value={d.leaves ?? 1} onChange={(e) => setD({ leaves: Number(e.target.value) || 1 })} /></label>
        )}
        {["casement", "door", "folding"].includes(d.type) && (
          <label className={purch.field}>{t("cv.opening")}
            <CustomSelect value={d.opening || ""} onSelect={(v) => setD({ opening: v })} options={OPENINGS.map((k) => ({ value: k, label: t(`cv.openings.${k || "side"}`) }))} />
          </label>
        )}
        {d.type === "glass" && (
          <label className={purch.field}>{t("cv.layers")}<input className={purch.input} type="number" min="1" max="4" value={d.layers ?? 1} onChange={(e) => setD({ layers: Number(e.target.value) || 1 })} /></label>
        )}
        {d.type === "grid" && ["nx", "ny"].map((k) => (
          <label key={k} className={purch.field}>{t(`cv.grid_${k}`)}<input className={purch.input} type="number" min="1" max="20" value={d[k] ?? (k === "nx" ? 2 : 1)} onChange={(e) => setD({ [k]: Number(e.target.value) || 1 })} /></label>
        ))}
      </div>
      {["casement", "door", "folding"].includes(d.type) && <label className={purch.inlineCheck}><input type="checkbox" checked={!!d.solid} onChange={(e) => setD({ solid: e.target.checked })} /> {t("cv.solidLeaf")}</label>}
      {d.type === "railing" && <label className={purch.inlineCheck}><input type="checkbox" checked={!!d.bars} onChange={(e) => setD({ bars: e.target.checked })} /> {t("cv.railingBars")}</label>}
      <p className={s.muted} style={{ marginBottom: 0 }}>{t("cv.drawingParamsHint")}</p>
    </Section>
  );
}

/**
 * Chassis model editor: parameters, series / model variables, derived
 * values, components (article + quantity / cut-length / size formulas,
 * colour, workshop, condition, waste), labour, pricing — and a test
 * panel that runs the saved model for any size.
 */
export default function ChassisModelEditor() {
  // Pricing and the test panel's costs / price are for people who see amounts.
  const money = canSeeFinancials(useAuth().user);
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const [model, setModel] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [series, setSeries] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [finishes, setFinishes] = useState([]);
  const [articles, setArticles] = useState([]);
  const [models, setModels] = useState([]);
  const [glassTypes, setGlassTypes] = useState([]);
  const [families, setFamilies] = useState([]);
  const [open, setOpen] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ L: 1200, H: 1000, quantity: 1, finish: "", params: {} });
  const [result, setResult] = useState(null);
  const insertRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const m = await getChassisModel(id);
      const companyId = m.company;
      const [sr, ws, fi, ar, ms, cat] = await Promise.all([
        getSeries(companyId), getWorkshops(companyId), getFinishes(companyId), getCatalogArticles(companyId), getChassisModels({ companyId, active: "all" }), getCatalog(),
      ]);
      setModel({ ...m, series: idOf(m.series), components: m.components.map((c) => ({ ...c, product: idOf(c.product), subModel: idOf(c.subModel) })) });
      setSeries(sr);
      setWorkshops(ws);
      setFinishes(fi);
      setArticles(ar);
      setModels(ms.filter((x) => String(x._id) !== String(id)));
      getGlassTypes(companyId, { active: "true" }).then(setGlassTypes).catch(() => setGlassTypes([]));
      setFamilies(cat.families);
      setTest((tst) => ({ ...tst, params: defaultParams(m) }));
      setDirty(false);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.load"));
    }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const patch = (p) => { setModel((m) => ({ ...m, ...p })); setDirty(true); };
  const seriesDoc = series.find((x) => String(x._id) === String(model?.series));
  const knownBase = useMemo(() => (model ? [...new Set(["L", "H", "cj", ...(seriesDoc?.variables || []).map((v) => v.key), ...(model.variables || []).map((v) => v.key), ...(model.parameters || []).map((p) => p.key),
    // Profile geometry of the articles (FPPRO-like): own ae/ai/ch/hp/lp and <g>_<role> of the other components.
    "ae", "ai", "ch", "hp", "lp",
    // Profiles of the series by their code: DOR.ae, OUV.ch…
    ...[...new Set([...(seriesDoc?.profileCodes || []), ...(model.components || []).map((c) => c.seriesCode).filter(Boolean)])].flatMap((code) => ["ch", "ae", "ai", "hp", "lp", "bar", "kgm", "per"].map((p) => `${code}.${p}`)),
    ...(model.components || []).filter((c) => c.role && c.kind !== "model").flatMap((c) => ["ae", "ai", "ch", "hp", "lp"].map((g) => `${g}_${String(c.role).replace(/[^A-Za-z0-9_]/g, "_")}`))])] : []), [model, seriesDoc]);
  const knownAll = useMemo(() => (model ? [...knownBase, ...(model.derived || []).map((d) => d.key)] : []), [knownBase, model]);
  const articleById = useMemo(() => new Map(articles.map((a) => [String(a._id), a])), [articles]);
  const workshopCodes = workshops.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }));

  if (!model) return <div className="pageShell">{error && <div className="errorMessage">{error}</div>}</div>;

  const setComp = (i, p) => patch({ components: model.components.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const moveComp = (i, d) => {
    const list = [...model.components];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patch({ components: list });
  };
  const productParams = (model.parameters || []).filter((p) => p.type === "product");
  const modelParams = (model.parameters || []).filter((p) => p.type === "model");
  const unmapped = model.components.filter((c) => c.kind !== "model" && !c.product && !c.productParam && !c.seriesCode).length;

  const body = () => ({
    name: model.name, code: model.code, family: model.family, series: model.series || null, defaultWorkshop: model.defaultWorkshop,
    unit: model.unit, vatRate: Number(model.vatRate), isActive: model.isActive, limits: model.limits, description: model.description, drawing: model.drawing || {},
    variables: (model.variables || []).filter((v) => v.key).map((v) => ({ ...v, value: Number(v.value) })),
    parameters: model.parameters, derived: model.derived, labour: model.labour, pricing: model.pricing,
    deliveryParts: (model.deliveryParts || []).filter((d) => d.label),
    components: model.components.map((c) => ({ ...c, product: c.product || null, subModel: c.subModel || null })),
  });
  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateChassisModel(id, body());
      setDirty(false);
      setNotice(t("prod.saved"));
      return true;
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.save"));
      return false;
    } finally { setSaving(false); }
  };
  const runTest = async () => {
    if (dirty && !(await save())) return;
    try {
      setResult(await testChassisModel(id, test));
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  };

  const varChips = (
    <div className={styles.chips} style={{ marginBottom: 8 }}>
      {["L", "H", ...knownAll.filter((k) => k !== "L" && k !== "H" && !k.includes("."))].map((k) => (
        <button key={k} type="button" className={styles.chip} onClick={() => insertRef.current?.(k)} title={t("prod.editor.insertHint")}><span className={styles.chipCode}>{k}</span></button>
      ))}
      {(seriesDoc?.profileCodes || []).map((code) => (
        <button key={`code-${code}`} type="button" className={styles.chip} onClick={() => insertRef.current?.(`${code}.`)} title={t("slib.codeChipHint")}><strong className={styles.chipCode}>{code}.</strong></button>
      ))}
      {["ceil()", "floor()", "round( , 1)", "max( , )", "min( , )", "if( , , )", " ? : "].map((f) => (
        <button key={f} type="button" className={styles.chip} onClick={() => insertRef.current?.(f)}><span className={styles.chipCode}>{f}</span></button>
      ))}
    </div>
  );

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.technical"), href: "/technical/catalog" }, { label: t("prod.catalog.title"), href: "/technical/catalog" }, { label: model.name }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Boxes size={20} /><h1>{model.name}</h1></div>
          <p className="pageSubtitle">{familyLabel(families, model.family, language)}{seriesDoc ? ` · ${t("prod.series")} ${seriesDoc.name}` : ""}{model.templateKey ? ` · ${t("prod.editor.fromTemplate")} ${model.templateKey}` : ""}</p>
        </div>
        <div className={purch.headerActions}>
          <button type="button" className="btnCancel" onClick={() => navigate("/technical/catalog")}>{t("common.back")}</button>
          <button type="button" className="btnPrimary" disabled={saving || !dirty} onClick={save}><Save size={15} /> {t("common.save")}</button>
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {notice && !dirty && <div className={purch.infoBanner}>{notice}</div>}
      {dirty && <div className={purch.infoBanner}>{t("prod.editor.unsaved")}</div>}
      {unmapped > 0 && <div className={purch.infoBanner}><AlertTriangle size={14} /> {t("prod.editor.unmappedBanner").replace("{n}", unmapped)}</div>}

      <div className={styles.split}>
        <div>
          <Section title={t("prod.editor.general")}>
            <div className={purch.formGrid}>
              <label className={purch.field}>{t("prod.config.name")}<input className={purch.input} value={model.name} onChange={(e) => patch({ name: e.target.value })} /></label>
              <label className={purch.field}>{t("prod.config.code")}<input className={purch.input} value={model.code || ""} onChange={(e) => patch({ code: e.target.value.toUpperCase() })} /></label>
              <label className={purch.field}>{t("prod.family")}<CustomSelect value={model.family} onSelect={(v) => patch({ family: v })} options={families.map((f) => ({ value: f.key, label: familyLabel(families, f.key, language) }))} /></label>
              <label className={purch.field}>{t("prod.series")}<CustomSelect value={model.series || ""} onSelect={(v) => patch({ series: v })} options={[{ value: "", label: t("prod.catalog.noSeries") }, ...series.map((x) => ({ value: x._id, label: x.name }))]} /></label>
              <label className={purch.field}>{t("prod.editor.defaultWorkshop")}<CustomSelect value={model.defaultWorkshop} onSelect={(v) => patch({ defaultWorkshop: v })} options={workshopCodes} /></label>
              <label className={purch.field}>{t("sales.lines.unit")}<input className={purch.input} value={model.unit || "u"} onChange={(e) => patch({ unit: e.target.value })} /></label>
              <label className={purch.field}>{t("sales.lines.vat")}<CustomSelect value={String(model.vatRate ?? 20)} onSelect={(v) => patch({ vatRate: Number(v) })} options={[20, 14, 10, 7, 0].map((r) => ({ value: String(r), label: `${r}%` }))} /></label>
              <label className={purch.field}>{t("prod.config.status")}<CustomSelect value={model.isActive ? "1" : "0"} onSelect={(v) => patch({ isActive: v === "1" })} options={[{ value: "1", label: t("prod.active") }, { value: "0", label: t("prod.inactive") }]} /></label>
              {["minL", "maxL", "minH", "maxH"].map((k) => (
                <label key={k} className={purch.field}>{t(`prod.editor.limits.${k}`)}<input className={purch.input} type="number" value={model.limits?.[k] ?? ""} onChange={(e) => patch({ limits: { ...model.limits, [k]: e.target.value === "" ? null : Number(e.target.value) } })} /></label>
              ))}
            </div>
            <label className={purch.field}>{t("prod.config.description")}<input className={purch.input} value={model.description || ""} onChange={(e) => patch({ description: e.target.value })} /></label>
          </Section>

          <VisualSection model={model} patch={patch} onImage={(m) => setModel((cur) => ({ ...cur, image: m.image }))} onError={setError} />

          <Section title={t("prod.catalog.variables")} hint={t("prod.editor.variablesHint")}>
            {seriesDoc && (
              <div className={styles.chips} style={{ marginBottom: 10 }}>
                {(seriesDoc.variables || []).map((v) => <span key={v.key} className={styles.chip} title={v.label}><span className={styles.chipCode}>{v.key}</span> = {v.value}{v.label ? ` · ${v.label}` : ""}</span>)}
              </div>
            )}
            <VariablesEditor rows={model.variables || []} onChange={(variables) => patch({ variables })} />
          </Section>

          <Section title={t("prod.catalog.parameters")} hint={t("prod.editor.parametersHint")}
            action={<button type="button" className="btnEdit" onClick={() => patch({ parameters: [...model.parameters, { key: "", label: "", type: "number", default: 0, min: null, max: null, unit: "", fixed: false, options: [] }] })}><Plus size={14} /> {t("prod.editor.addParameter")}</button>}>
            <div className={styles.tableRows}>
              {model.parameters.map((p, i) => {
                const setP = (q) => patch({ parameters: model.parameters.map((x, j) => (j === i ? { ...x, ...q } : x)) });
                const badKey = p.key && !isValidVariableName(p.key);
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i}>
                    <div className={`${styles.gridRow} ${styles.paramRow}`}>
                      <label>{t("prod.editor.key")}<input className={`${purch.input} ${styles.formula} ${badKey ? styles.formulaBad : ""}`} value={p.key} onChange={(e) => setP({ key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })} /></label>
                      <label>{t("prod.editor.label")}<input className={purch.input} value={p.label || ""} onChange={(e) => setP({ label: e.target.value })} /></label>
                      <label>{t("prod.editor.type")}<CustomSelect value={p.type} onSelect={(v) => setP({ type: v, default: v === "product" || v === "model" ? null : 0 })} options={PARAM_TYPES.map((x) => ({ value: x, label: t(`prod.paramTypes.${x}`) }))} /></label>
                      <label>{t("prod.editor.default")}
                        {p.type === "boolean" ? <CustomSelect value={String(Number(p.default) ? 1 : 0)} onSelect={(v) => setP({ default: Number(v) })} options={[{ value: "0", label: t("common.no") }, { value: "1", label: t("common.yes") }]} />
                          : p.type === "choice" ? <CustomSelect value={String(p.default ?? "")} onSelect={(v) => setP({ default: Number(v) })} options={(p.options || []).map((o) => ({ value: String(o.value), label: o.label }))} />
                            : p.type === "product" ? <SearchSelect value={p.default || ""} onSelect={(v) => setP({ default: v })} options={articles.filter((a) => !p.materialType || a.materialType === p.materialType).map((a) => ({ value: a._id, label: articleLabel(a) }))} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} />
                              : p.type === "model" ? <CustomSelect value={p.default || ""} onSelect={(v) => setP({ default: v })} options={[{ value: "", label: "—" }, ...models.filter((m) => !p.family || m.family === p.family).map((m) => ({ value: m._id, label: m.name })), ...(!p.family || p.family === "vitrage" ? glassTypes.map((g) => ({ value: g._id, label: `${t("glazing.composition")} ${g.name}` })) : [])]} />
                                : <input className={purch.input} type="number" step="any" value={p.default ?? ""} onChange={(e) => setP({ default: e.target.value === "" ? 0 : Number(e.target.value) })} />}
                      </label>
                      <label>{t("prod.editor.min")}<input className={purch.input} type="number" step="any" value={p.min ?? ""} disabled={p.type !== "number"} onChange={(e) => setP({ min: e.target.value === "" ? null : Number(e.target.value) })} /></label>
                      <label>{t("prod.editor.max")}<input className={purch.input} type="number" step="any" value={p.max ?? ""} disabled={p.type !== "number"} onChange={(e) => setP({ max: e.target.value === "" ? null : Number(e.target.value) })} /></label>
                      <label>{t("prod.editor.unit")}<input className={purch.input} value={p.unit || ""} onChange={(e) => setP({ unit: e.target.value })} /></label>
                      <label className={purch.inlineCheck} title={t("prod.editor.fixedHint")}><input type="checkbox" checked={!!p.fixed} onChange={(e) => setP({ fixed: e.target.checked })} /> {t("prod.editor.fixed")}</label>
                      <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => patch({ parameters: model.parameters.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                    </div>
                    {p.type === "choice" && (
                      <div style={{ margin: "0 0 10px 12px" }}>
                        {(p.options || []).map((o, k) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <div key={k} className={styles.optionRow}>
                            <input className={purch.input} type="number" value={o.value} onChange={(e) => setP({ options: p.options.map((x, z) => (z === k ? { ...x, value: Number(e.target.value) } : x)) })} />
                            <input className={purch.input} value={o.label} onChange={(e) => setP({ options: p.options.map((x, z) => (z === k ? { ...x, label: e.target.value } : x)) })} />
                            <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setP({ options: p.options.filter((_, z) => z !== k) })}><Trash2 size={12} /></button>
                          </div>
                        ))}
                        <button type="button" className="btnEdit" onClick={() => setP({ options: [...(p.options || []), { value: (p.options || []).length, label: "" }] })}><Plus size={13} /> {t("prod.editor.addOption")}</button>
                      </div>
                    )}
                    {(p.type === "product" || p.type === "model") && (
                      <div style={{ margin: "0 0 10px 12px", maxWidth: 360 }}>
                        {p.type === "product"
                          ? <label className={purch.field}>{t("prod.editor.materialFilter")}<CustomSelect value={p.materialType || ""} onSelect={(v) => setP({ materialType: v })} options={[{ value: "", label: t("sales.all") }, ...["glass", "panel", "profile", "accessory", "gasket", "consumable", "powder"].map((x) => ({ value: x, label: t(`prod.materialTypes.${x}`) }))]} /></label>
                          : <label className={purch.field}>{t("prod.editor.familyFilter")}<CustomSelect value={p.family || ""} onSelect={(v) => setP({ family: v })} options={[{ value: "", label: t("sales.all") }, ...families.map((f) => ({ value: f.key, label: familyLabel(families, f.key, language) }))]} /></label>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title={t("prod.editor.derived")} hint={t("prod.editor.derivedHint")}
            action={<button type="button" className="btnEdit" onClick={() => patch({ derived: [...model.derived, { key: "", label: "", formula: "" }] })}><Plus size={14} /> {t("prod.editor.addDerived")}</button>}>
            <div className={styles.tableRows}>
              {model.derived.map((d, i) => {
                const known = [...knownBase, ...model.derived.slice(0, i).map((x) => x.key)];
                const setD = (q) => patch({ derived: model.derived.map((x, j) => (j === i ? { ...x, ...q } : x)) });
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className={`${styles.gridRow} ${styles.derivedRow}`}>
                    <label>{t("prod.editor.key")}<input className={`${purch.input} ${styles.formula}`} value={d.key} onChange={(e) => setD({ key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })} /></label>
                    <label>{t("prod.editor.label")}<input className={purch.input} value={d.label || ""} onChange={(e) => setD({ label: e.target.value })} /></label>
                    <label>{t("prod.editor.formula")}<FormulaInput value={d.formula} onChange={(v) => setD({ formula: v })} known={known} onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                    <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => patch({ derived: model.derived.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title={`${t("prod.catalog.components")} (${model.components.length})`} hint={t("prod.editor.componentsHint")}
            action={(
              <div className={purch.headerActions}>
                <button type="button" className="btnEdit" onClick={() => setOpen(Object.fromEntries(model.components.map((_, i) => [i, !Object.values(open).some(Boolean)])))}>{t("prod.editor.toggleAll")}</button>
                <button type="button" className="btnEdit" onClick={() => { patch({ components: [...model.components, { role: `c${model.components.length + 1}`, label: "", kind: "accessory", measure: "count", product: "", subModel: "", productParam: "", modelParam: "", qty: "1", length: "", width: "", height: "", angle: "", finish: "none", workshop: "", condition: "", waste: 0 }] }); setOpen({ ...open, [model.components.length]: true }); }}><Plus size={14} /> {t("prod.editor.addComponent")}</button>
              </div>
            )}>
            {varChips}
            {model.components.map((c, i) => {
              const measure = c.kind === "model" ? "count" : c.measure || DEFAULT_MEASURE[c.kind];
              const article = c.product ? articleById.get(String(c.product)) : null;
              const sourceValue = c.kind === "model" ? (c.modelParam ? `param:${c.modelParam}` : "fixed") : c.seriesCode ? `series:${c.seriesCode}` : (c.productParam ? `param:${c.productParam}` : "article");
              const seriesCodes = [...new Set([...(seriesDoc?.profileCodes || []), ...(c.seriesCode ? [c.seriesCode] : [])])];
              const sourceOptions = c.kind === "model"
                ? [{ value: "fixed", label: t("prod.editor.fixedModel") }, ...modelParams.map((p) => ({ value: `param:${p.key}`, label: `${t("prod.editor.fromParam")} « ${p.label || p.key} »` }))]
                : [
                  ...seriesCodes.map((code) => ({ value: `series:${code}`, label: `${t("slib.fromSeries")} ${seriesDoc?.name || ""} · ${code}` })),
                  { value: "article", label: t("prod.editor.stockArticle") },
                  ...productParams.map((p) => ({ value: `param:${p.key}`, label: `${t("prod.editor.fromParam")} « ${p.label || p.key} »` })),
                ];
              const missing = c.kind !== "model" && !c.product && !c.productParam && !c.seriesCode;
              const summary = [`${t("prod.editor.qtyShort")} ${c.qty}`, measure === "length" && c.length ? `× ${c.length}` : "", measure === "area" ? `${c.width || "L"} × ${c.height || "H"}` : "", c.condition ? `${t("prod.editor.if")} ${c.condition}` : ""].filter(Boolean).join("  ");
              const materials = KIND_MATERIALS[c.kind] || [];
              const articleOptions = articles.filter((a) => !a.materialType || materials.includes(a.materialType)).map((a) => ({ value: a._id, label: articleLabel(a), searchText: `${a.name} ${a.internalReference || ""}` }));
              return (
                // eslint-disable-next-line react/no-array-index-key
                <div key={c._id || i} className={styles.compCard}>
                  <div className={styles.compHead} role="button" tabIndex={0} onClick={() => setOpen({ ...open, [i]: !open[i] })} onKeyDown={(e) => e.key === "Enter" && setOpen({ ...open, [i]: !open[i] })}>
                    {open[i] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span>
                      <span className={styles.kindBadge}>{t(`prod.kinds.${c.kind}`)}</span>
                      <strong>{c.label || t("prod.editor.untitled")}</strong>{" "}
                      {c.kind === "model"
                        ? <small>→ {c.modelParam ? `${t("prod.editor.fromParam")} ${c.modelParam}` : models.find((m) => String(m._id) === String(c.subModel))?.name || <span className={styles.unmapped}>{t("prod.editor.toDefine")}</span>}</small>
                        : missing ? <small className={styles.unmapped}><AlertTriangle size={11} /> {t("prod.editor.noArticle")}</small> : <small>→ {c.seriesCode ? `${seriesDoc?.name || ""} · ${c.seriesCode}` : c.productParam ? `${t("prod.editor.fromParam")} ${c.productParam}` : article?.name || "?"}</small>}
                      {c.generated && <small className={styles.kindBadge} style={{ marginLeft: 6 }} title={t("cad.generatedHint")}>CAD</small>}
                      <small style={{ display: "block" }} className={styles.formula}>{summary}</small>
                    </span>
                    <span className="dataTableActions" onClick={(e) => e.stopPropagation()} role="presentation">
                      <button type="button" className="tableActionBtn" onClick={() => moveComp(i, -1)} title={t("prod.editor.up")}><ArrowUp size={13} /></button>
                      <button type="button" className="tableActionBtn" onClick={() => moveComp(i, 1)} title={t("prod.editor.down")}><ArrowDown size={13} /></button>
                      <button type="button" className="tableActionBtn" onClick={() => { const { _id, ...copy } = c; patch({ components: [...model.components.slice(0, i + 1), { ...copy, role: `${c.role}_2`, label: `${c.label} (2)` }, ...model.components.slice(i + 1)] }); }} title={t("prod.duplicate")}><Copy size={13} /></button>
                      <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => patch({ components: model.components.filter((_, j) => j !== i) })} title={t("common.delete")}><Trash2 size={13} /></button>
                    </span>
                  </div>
                  {open[i] && (
                    <div className={styles.compBody}>
                      <label className={styles.wide}>{t("prod.editor.label")}<input className={purch.input} value={c.label} onChange={(e) => setComp(i, { label: e.target.value })} /></label>
                      <label>{t("prod.editor.role")}<input className={`${purch.input} ${styles.formula}`} value={c.role} onChange={(e) => setComp(i, { role: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })} /></label>
                      <label>{t("prod.editor.type")}<CustomSelect value={c.kind} onSelect={(v) => setComp(i, { kind: v, measure: DEFAULT_MEASURE[v], ...(v === "model" ? { product: "", productParam: "" } : { subModel: "", modelParam: "" }) })} options={COMPONENT_KINDS.map((k) => ({ value: k, label: t(`prod.kinds.${k}`) }))} /></label>
                      {c.kind !== "model" && <label>{t("prod.editor.measure")}<CustomSelect value={measure} onSelect={(v) => setComp(i, { measure: v })} options={["length", "area", "count"].map((m) => ({ value: m, label: t(`prod.measures.${m}`) }))} /></label>}
                      <label>{t("prod.editor.source")}<CustomSelect value={sourceValue} onSelect={(v) => {
                        const param = v.startsWith("param:") ? v.slice(6) : "";
                        const code = v.startsWith("series:") ? v.slice(7) : "";
                        setComp(i, c.kind === "model"
                          ? { modelParam: param, subModel: param ? "" : c.subModel }
                          : { productParam: param, seriesCode: code, product: param || code ? "" : c.product });
                      }} options={sourceOptions} /></label>
                      {c.kind === "model" && !c.modelParam && (
                        <label className={styles.wide}>{t("prod.editor.subModel")}<CustomSelect value={c.subModel || ""} onSelect={(v) => setComp(i, { subModel: v })} options={[{ value: "", label: "—" }, ...models.map((m) => ({ value: m._id, label: `${m.name} (${familyLabel(families, m.family, language)})` }))]} /></label>
                      )}
                      {c.kind !== "model" && !c.productParam && !c.seriesCode && (
                        <label className={styles.wide}>{t("prod.editor.article")}<SearchSelect value={c.product || ""} onSelect={(v) => setComp(i, { product: v })} options={articleOptions} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("prod.editor.noArticleFound")} /></label>
                      )}
                      <label>{t("prod.editor.qty")}<FormulaInput value={c.qty} onChange={(v) => setComp(i, { qty: v })} known={knownAll} placeholder="1" onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                      {measure === "length" && <label>{t("prod.editor.length")}<FormulaInput value={c.length} onChange={(v) => setComp(i, { length: v })} known={knownAll} placeholder="L - 20" onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>}
                      {(measure === "area" || c.kind === "model") && (
                        <>
                          <label>{t("prod.editor.widthF")}<FormulaInput value={c.width} onChange={(v) => setComp(i, { width: v })} known={knownAll} placeholder="L" optional onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                          <label>{t("prod.editor.heightF")}<FormulaInput value={c.height} onChange={(v) => setComp(i, { height: v })} known={knownAll} placeholder="H" optional onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                        </>
                      )}
                      {c.kind === "profile" && <label>{t("prod.editor.angle")}<CustomSelect value={c.angle || ""} onSelect={(v) => setComp(i, { angle: v })} options={ANGLES.map((a) => ({ value: a, label: a || "—" }))} /></label>}
                      {c.kind !== "model" && <label>{t("prod.editor.finish")}<CustomSelect value={c.finish || "none"} onSelect={(v) => setComp(i, { finish: v })} options={FINISH_MODES.map((f) => ({ value: f, label: t(`prod.finishModes.${f}`) }))} /></label>}
                      <label>{t("prod.editor.workshop")}<CustomSelect value={c.workshop || ""} onSelect={(v) => setComp(i, { workshop: v })} options={[{ value: "", label: `${t("prod.editor.modelDefault")} (${model.defaultWorkshop})` }, ...workshopCodes]} /></label>
                      <label>{t("prod.editor.condition")}<FormulaInput value={c.condition} onChange={(v) => setComp(i, { condition: v })} known={knownAll} placeholder={t("prod.editor.always")} optional onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                      {c.kind !== "model" && <label>{t("prod.editor.waste")}<input className={purch.input} type="number" min="0" max="100" step="any" value={c.waste ?? 0} onChange={(e) => setComp(i, { waste: Number(e.target.value) || 0 })} /></label>}
                    </div>
                  )}
                </div>
              );
            })}
          </Section>

          <Section title={t("prod.editor.delivery")} hint={t("prod.editor.deliveryHint")}
            action={<button type="button" className="btnEdit" onClick={() => patch({ deliveryParts: [...(model.deliveryParts || []), { key: "", label: "", kind: "other", qty: "1", condition: "" }] })}><Plus size={14} /> {t("prod.editor.addDeliveryPart")}</button>}>
            {!(model.deliveryParts || []).length && <p className={s.muted}>{t("prod.editor.deliveryDefault")}</p>}
            <div className={styles.tableRows}>
              {(model.deliveryParts || []).map((d, i) => {
                const setD = (q) => patch({ deliveryParts: model.deliveryParts.map((x, j) => (j === i ? { ...x, ...q } : x)) });
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className={styles.gridRow} style={{ gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1.2fr 34px" }}>
                    <label>{t("prod.editor.label")}<input className={purch.input} value={d.label} placeholder={t("prod.editor.deliveryPartPh")} onChange={(e) => setD({ label: e.target.value })} /></label>
                    <label>{t("prod.editor.type")}<CustomSelect value={d.kind || "other"} onSelect={(v) => setD({ kind: v })} options={["complete", "frame", "sash", "glass", "module", "screen", "panel", "accessory", "other"].map((k) => ({ value: k, label: t(`logi.kinds.${k}`) }))} /></label>
                    <label>{t("prod.editor.qty")}<FormulaInput value={d.qty} onChange={(v) => setD({ qty: v })} known={knownAll} placeholder="1" onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                    <label title={t("logi.sizeHint")}>{t("prod.editor.widthF")}<FormulaInput value={d.width} onChange={(v) => setD({ width: v })} known={knownAll} placeholder="L" optional onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                    <label title={t("logi.sizeHint")}>{t("prod.editor.heightF")}<FormulaInput value={d.height} onChange={(v) => setD({ height: v })} known={knownAll} placeholder="H" optional onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                    <label>{t("prod.editor.condition")}<FormulaInput value={d.condition} onChange={(v) => setD({ condition: v })} known={knownAll} placeholder={t("prod.editor.always")} optional onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                    <label title={t("logi.perPieceHint")}>
                      <span><input type="checkbox" checked={!!d.perPiece} onChange={(e) => setD({ perPiece: e.target.checked })} /> {t("logi.perPiece")}</span>
                      {d.perPiece && <input className={purch.input} value={d.pieceLabel || ""} placeholder={t("logi.pieceLabelPh")} onChange={(e) => setD({ pieceLabel: e.target.value })} />}
                    </label>
                    <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => patch({ deliveryParts: model.deliveryParts.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title={t("prod.editor.labour")} hint={t("prod.editor.labourHint")}
            action={<button type="button" className="btnEdit" onClick={() => patch({ labour: [...(model.labour || []), { workshop: model.defaultWorkshop, minutes: "30" }] })}><Plus size={14} /> {t("prod.editor.addLabour")}</button>}>
            <div className={styles.tableRows}>
              {(model.labour || []).map((l, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className={`${styles.gridRow} ${styles.labourRow}`}>
                  <label>{t("prod.editor.workshop")}<CustomSelect value={l.workshop} onSelect={(v) => patch({ labour: model.labour.map((x, j) => (j === i ? { ...x, workshop: v } : x)) })} options={workshopCodes} /></label>
                  <label>{t("prod.editor.minutes")}<FormulaInput value={l.minutes} onChange={(v) => patch({ labour: model.labour.map((x, j) => (j === i ? { ...x, minutes: v } : x)) })} known={knownAll} onFocusInsert={(fn) => { insertRef.current = fn; }} /></label>
                  <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => patch({ labour: model.labour.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </Section>

          {money && <Section title={t("prod.editor.pricing")} hint={t(`prod.editor.pricingHint.${model.pricing?.mode || "cost_plus"}`)}>
            <div className={purch.formGrid}>
              <label className={purch.field}>{t("prod.editor.pricingMode")}<CustomSelect value={model.pricing?.mode || "cost_plus"} onSelect={(v) => patch({ pricing: { ...model.pricing, mode: v } })} options={PRICING_MODES.map((m) => ({ value: m, label: t(`prod.pricingModes.${m}`) }))} /></label>
              <label className={purch.field}>{t("prod.editor.coefficient")}<input className={purch.input} type="number" step="any" min="0" value={model.pricing?.coefficient ?? 1.8} onChange={(e) => patch({ pricing: { ...model.pricing, coefficient: Number(e.target.value) } })} /></label>
              {model.pricing?.mode === "per_m2" && <label className={purch.field}>{t("prod.editor.pricePerM2")}<input className={purch.input} type="number" step="any" min="0" value={model.pricing?.pricePerM2 ?? 0} onChange={(e) => patch({ pricing: { ...model.pricing, pricePerM2: Number(e.target.value) } })} /></label>}
              {model.pricing?.mode === "per_m2" && <label className={purch.field}>{t("prod.editor.minArea")}<input className={purch.input} type="number" step="any" min="0" value={model.pricing?.minArea ?? 0} onChange={(e) => patch({ pricing: { ...model.pricing, minArea: Number(e.target.value) } })} /></label>}
              {model.pricing?.mode === "per_ml" && <label className={purch.field}>{t("prod.editor.pricePerMl")}<input className={purch.input} type="number" step="any" min="0" value={model.pricing?.pricePerMl ?? 0} onChange={(e) => patch({ pricing: { ...model.pricing, pricePerMl: Number(e.target.value) } })} /></label>}
              {model.pricing?.mode === "per_unit" && <label className={purch.field}>{t("prod.editor.pricePerUnit")}<input className={purch.input} type="number" step="any" min="0" value={model.pricing?.pricePerUnit ?? 0} onChange={(e) => patch({ pricing: { ...model.pricing, pricePerUnit: Number(e.target.value) } })} /></label>}
              <label className={purch.field}>{t("prod.editor.minPrice")}<input className={purch.input} type="number" step="any" min="0" value={model.pricing?.minPrice ?? 0} onChange={(e) => patch({ pricing: { ...model.pricing, minPrice: Number(e.target.value) } })} /></label>
            </div>
          </Section>}
        </div>

        {/* ---------------- test panel ---------------- */}
        <div className={styles.sticky}>
          <section className={styles.box}>
            <h3><FlaskConical size={15} /> {t("prod.editor.test")}</h3>
            <div className={styles.drawing}><ChassisDrawing drawing={model.drawing} image={model.image?.url} L={Number(test.L) || 1000} H={Number(test.H) || 1000} params={{ ...defaultParams(model), ...test.params }} width={200} height={150} /></div>
            <div className={purch.formGrid} style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label className={purch.field}>L<input className={purch.input} type="number" value={test.L} onChange={(e) => setTest({ ...test, L: Number(e.target.value) })} /></label>
              <label className={purch.field}>H<input className={purch.input} type="number" value={test.H} onChange={(e) => setTest({ ...test, H: Number(e.target.value) })} /></label>
              <label className={purch.field}>{t("prod.quantity")}<input className={purch.input} type="number" min="1" value={test.quantity} onChange={(e) => setTest({ ...test, quantity: Number(e.target.value) })} /></label>
            </div>
            <label className={purch.field}>{t("prod.finish")}<CustomSelect value={test.finish} onSelect={(v) => setTest({ ...test, finish: v })} options={[{ value: "", label: t("prod.noFinish") }, ...finishes.map((f) => ({ value: f._id, label: f.code }))]} /></label>
            {model.parameters.filter((p) => !p.fixed).map((p) => (
              <label key={p.key} className={purch.field}>{p.label || p.key}
                {p.type === "boolean" ? <CustomSelect value={String(Number(test.params[p.key]) ? 1 : 0)} onSelect={(v) => setTest({ ...test, params: { ...test.params, [p.key]: Number(v) } })} options={[{ value: "0", label: t("common.no") }, { value: "1", label: t("common.yes") }]} />
                  : p.type === "choice" ? <CustomSelect value={String(test.params[p.key] ?? "")} onSelect={(v) => setTest({ ...test, params: { ...test.params, [p.key]: Number(v) } })} options={(p.options || []).map((o) => ({ value: String(o.value), label: o.label }))} />
                    : p.type === "model" ? <CustomSelect value={test.params[p.key] || ""} onSelect={(v) => setTest({ ...test, params: { ...test.params, [p.key]: v } })} options={[{ value: "", label: "—" }, ...models.filter((m) => !p.family || m.family === p.family).map((m) => ({ value: m._id, label: m.name })), ...(!p.family || p.family === "vitrage" ? glassTypes.map((g) => ({ value: g._id, label: `${t("glazing.composition")} ${g.name}` })) : [])]} />
                      : p.type === "product" ? <SearchSelect value={test.params[p.key] || ""} onSelect={(v) => setTest({ ...test, params: { ...test.params, [p.key]: v } })} options={articles.filter((a) => !p.materialType || a.materialType === p.materialType).map((a) => ({ value: a._id, label: articleLabel(a) }))} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} />
                        : <input className={purch.input} type="number" step="any" value={test.params[p.key] ?? ""} onChange={(e) => setTest({ ...test, params: { ...test.params, [p.key]: Number(e.target.value) } })} />}
              </label>
            ))}
            <button type="button" className="btnPrimary" onClick={runTest}><FlaskConical size={15} /> {dirty ? t("prod.editor.saveAndTest") : t("prod.editor.run")}</button>
          </section>

          {result && (
            <section className={styles.box}>
              {result.errors.length > 0 && <ul className={styles.errList}>{result.errors.map((e, i) => <li key={i}>{e.where} — {e.message}</li>)}</ul>}
              {result.warnings.length > 0 && <ul className={styles.warnList}>{result.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
              {money && result.price && <div className={styles.priceBox} style={{ marginTop: 0 }}>
                <div><span>{t("prod.cost.materials")}</span><span>{formatMoney(result.price.cost.materials)}</span></div>
                <div><span>{t("prod.cost.lacquer")}</span><span>{formatMoney(result.price.cost.lacquer)}</span></div>
                <div><span>{t("prod.cost.labour")} ({Math.round(result.price.labourMinutes)} min)</span><span>{formatMoney(result.price.cost.labour)}</span></div>
                <div><strong>{t("prod.cost.total")}</strong><strong>{formatMoney(result.price.cost.total)}</strong></div>
                <div className={styles.big}><span>{t("prod.proposedPrice")}</span><span>{formatMoney(result.price.unitPrice)}</span></div>
                <small className={s.muted}>{result.price.basis}{result.price.marginPercent !== null ? ` · ${t("prod.margin")} ${result.price.marginPercent} %` : ""}</small>
                {result.price.missingPrices?.length > 0 && <small className={styles.unmapped}>{t("prod.missingPrices")}: {result.price.missingPrices.join(", ")}</small>}
              </div>}
              <h4 className={purch.subTitle}>{t("prod.editor.needs")}</h4>
              <div className={styles.tableWrap}>
                <table className={styles.needTable}>
                  <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.planned")}</th><th>{t("prod.workshop")}</th></tr></thead>
                  <tbody>
                    {result.needs.map((n, i) => (
                      <tr key={i}>
                        <td>{n.productName || <span className={styles.unmapped}>{n.label}</span>}{(n.barLength || n.measure === "area") && <small>{n.barLength ? t("prodPlan.barsOf").replace("{length}", fmtQty(n.barLength)) : `${fmtQty(n.area, 3)} m²`}</small>}</td>
                        <td className={styles.num}>{fmtQty(n.theoretical)} {n.unit}</td>
                        <td>{n.workshop}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className={purch.subTitle}>{t("prod.editor.lines")}</h4>
              <div className={styles.tableWrap}>
                <table className={styles.needTable}>
                  <thead><tr><th>{t("prod.editor.label")}</th><th className={styles.num}>{t("prod.editor.qtyShort")}</th><th className={styles.num}>{t("prod.editor.size")}</th></tr></thead>
                  <tbody>
                    {result.lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.label}<small>{l.path}{l.productName ? ` · ${l.productName}` : ""}</small></td>
                        <td className={styles.num}>{fmtQty(l.pieces)}</td>
                        <td className={styles.num}>{l.measure === "length" ? `${fmtMm(l.length)}${l.angle ? ` · ${l.angle}` : ""}` : l.measure === "area" ? `${fmtMm(l.width)} × ${fmtMm(l.height)}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details style={{ marginTop: 10 }}>
                <summary className={s.muted}>{t("prod.editor.values")}</summary>
                <div className={styles.chips} style={{ marginTop: 6 }}>
                  {Object.entries(result.variables).map(([k, v]) => <span key={k} className={styles.chip}><span className={styles.chipCode}>{k}</span> = {fmtQty(v, 2)}</span>)}
                </div>
              </details>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
