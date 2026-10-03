import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layers, Plus, Trash2, Save, Search, AlertTriangle, PenTool, Pencil, X, Upload, Box } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import { useDialog } from "../../components/useful/DialogProvider";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import {
  getSeriesDetail, updateSeries, getSeriesCandidates, addSeriesProfiles, updateSeriesProfile, removeSeriesProfile, getCatalog, getSeriesSections, getSeriesNodes,
} from "../../services/productionService";
import { familyLabel, fmtMm } from "../production/prodShared";
import SectionViewer from "../../components/dxf/SectionViewer";
import DxfImportModal from "../../components/dxf/DxfImportModal";
import NodesPanel from "./nodes/NodesPanel";
import { ROLES } from "./ProfilePage";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "../production/Production.module.css";

const GEO = [["barLength", "bar"]];
const PROPS = ["ch", "ae", "ai", "hp", "lp", "bar", "kgm", "per"];
const numIn = { width: 64, padding: "5px 6px", fontSize: "0.8rem", textAlign: "right" };

/**
 * Technique › Catalogue châssis › une série (AWS 60):
 *  - its PROFILE LIBRARY: the inventory articles of the series, each with a
 *    short code (DOR, OUV, PAR…) and its geometry — edited here or in the
 *    inventory, it is the same article;
 *  - its VARIABLES: numbers or formulas over the profiles (rec = OUV.ae - 2),
 *    with their current value;
 *  - each profile's DXF section (fiche profilé: dimensions, kg/m, rules);
 *  - its NODES: how its profiles meet, measured on the DXF → CAD deductions;
 *  - its models (catalogue / CAD).
 */
export default function SeriesPage() {
  const { id } = useParams();
  const { t, language } = useI18n();
  const can = useCan();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [families, setFamilies] = useState([]);
  const [info, setInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [vars, setVars] = useState([]);
  const [adding, setAdding] = useState(false);
  const [sections, setSections] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [dxfFor, setDxfFor] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const focusRef = useRef(null);
  const canEdit = can("production.catalog.edit") || can("inventory.articles.edit");

  const load = useCallback(async () => {
    try {
      const d = await getSeriesDetail(id);
      setSeries(d);
      setInfo({ name: d.name, supplier: d.supplier || "", description: d.description || "", families: d.families || [] });
      setRows(d.profiles.map((p) => ({ ...p, edit: { code: p.seriesCode || "", role: p.profileRole || "", ...Object.fromEntries(GEO.map(([f]) => [f, p[f] ?? ""])) }, dirty: false })));
      setVars((d.variables || []).map((v) => ({ key: v.key, label: v.label || "", formula: v.formula || String(v.value ?? ""), current: v.current, error: v.error })));
      const [secs, nds] = await Promise.all([getSeriesSections(id), getSeriesNodes(id)]);
      setSections(secs);
      setNodes(nds);
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getCatalog().then((c) => setFamilies(c.families || [])).catch(() => {}); }, []);

  if (!series) return <div className="pageShell">{error ? <div className="errorMessage">{error}</div> : <p className={s.muted}>{t("common.loading")}</p>}</div>;

  const codes = rows.filter((r) => r.seriesCode).map((r) => r.seriesCode);
  const run = async (fn, okMsg) => {
    setError(""); setNotice("");
    try { await fn(); if (okMsg) setNotice(okMsg); await load(); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, edit: { ...r.edit, ...patch }, dirty: true } : r)));
  const saveRow = (r) => run(() => updateSeriesProfile(id, r._id, { code: r.edit.code, ...(r.edit.role ? { role: r.edit.role } : {}), ...Object.fromEntries(GEO.map(([f]) => [f, r.edit[f]])) }), t("slib.saved"));
  const secOf = new Map(sections.map((x) => [String(x.product), x.section]));
  const removeRow = async (r) => {
    if (!(await dialog.confirm(t("slib.removeConfirm").replace("{name}", r.name)))) return;
    run(() => removeSeriesProfile(id, r._id));
  };
  const saveInfo = () => run(() => updateSeries(id, info), t("slib.saved"));
  const saveVars = () => run(() => updateSeries(id, { variables: vars.filter((v) => v.key.trim()).map((v) => ({ key: v.key.trim(), label: v.label, formula: v.formula })) }), t("slib.varsSaved"));
  const insert = (text) => {
    const f = focusRef.current;
    if (!f) return;
    setVars((list) => list.map((v, j) => (j === f.index ? { ...v, formula: `${v.formula}${v.formula && !/[\s(+\-*/]$/.test(v.formula) ? " " : ""}${text}` } : v)));
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.technical"), href: "/technical/catalog" }, { label: t("prod.catalog.title"), href: "/technical/catalog" }, { label: series.name }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Layers size={20} /><h1>{series.name}</h1></div>
          <p className="pageSubtitle">{t("slib.subtitle")}</p>
        </div>
        <div className="pageHeaderActions">
          <button type="button" className="btnPrimary" onClick={() => navigate(`/technical/designer/new?series=${id}`)}><PenTool size={15} /> {t("cad.newInSeries")}</button>
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}

      {/* ---------- informations ---------- */}
      <section className={purch.panel}>
        <h3 className={purch.subTitle} style={{ marginTop: 0 }}>{t("slib.info")}</h3>
        <div className={purch.formGrid}>
          <label className={purch.field}>{t("prod.config.name")}<input className={purch.input} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} disabled={!canEdit} /></label>
          <label className={purch.field}>{t("prod.catalog.supplier")}<input className={purch.input} value={info.supplier} onChange={(e) => setInfo({ ...info, supplier: e.target.value })} disabled={!canEdit} /></label>
          <label className={purch.field}>{t("prod.config.description")}<input className={purch.input} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} disabled={!canEdit} /></label>
        </div>
        <div className={styles.chips} style={{ marginBottom: 8 }}>
          {families.filter((f) => !["vitrage", "remplissage"].includes(f.key)).map((f) => {
            const on = info.families.includes(f.key);
            return <button key={f.key} type="button" disabled={!canEdit} className={styles.chip} style={on ? { borderColor: "var(--tone-6ea8fe)", color: "var(--color-text-primary)" } : undefined} onClick={() => setInfo({ ...info, families: on ? info.families.filter((x) => x !== f.key) : [...info.families, f.key] })}>{familyLabel(families, f.key, language)}</button>;
          })}
        </div>
        {canEdit && <button type="button" className="btnEdit" onClick={saveInfo}><Save size={14} /> {t("common.save")}</button>}
      </section>

      {/* ---------- profile library ---------- */}
      <section className={purch.panel}>
        <div className={purch.sectionHeader}>
          <h3 className={purch.subTitle} style={{ margin: 0 }}>{t("slib.profiles")} ({rows.length})</h3>
          {canEdit && <button type="button" className="btnPrimary" onClick={() => setAdding(true)}><Plus size={15} /> {t("slib.addProfiles")}</button>}
        </div>
        <p className={s.muted}>{t("slib.profilesHint")}</p>
        {series.missingCodes?.length > 0 && (
          <div className={purch.infoBanner} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <AlertTriangle size={14} /> {t("slib.missingCodes").replace("{codes}", series.missingCodes.join(", "))}
          </div>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.needTable}>
            <thead>
              <tr>
                <th style={{ width: 92 }}>DXF</th>
                <th>{t("slib.code")}</th>
                <th>{t("prod.editor.article")}</th>
                <th>Rôle</th>
                <th className={styles.num} title="Largeur vue de face (lue sur le DXF)">Larg.</th>
                <th className={styles.num} title="Profondeur (lue sur le DXF)">Prof.</th>
                <th className={styles.num}>kg/m</th>
                <th className={styles.num} title={t("slib.props.bar")}>bar</th>
                <th className={styles.num}>{t("slib.stock")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const sec = secOf.get(String(r._id));
                return (
                  <tr key={r._id}>
                    <td>
                      <button type="button" onClick={() => (sec ? navigate(`/technical/profiles/${r._id}`) : canEdit && setDxfFor(r))} title={sec ? "Ouvrir la fiche profilé" : "Importer le DXF"}
                        style={{ width: 84, height: 56, padding: 0, background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, cursor: "pointer", color: "var(--color-text-tertiary)" }}>
                        {sec ? <SectionViewer section={sec} mini height={54} /> : <span style={{ fontSize: "0.68rem", display: "inline-flex", gap: 3, alignItems: "center" }}><Upload size={11} /> DXF</span>}
                      </button>
                    </td>
                    <td><input value={r.edit.code} disabled={!canEdit} onChange={(e) => setRow(i, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} style={{ width: 70, padding: "5px 6px", fontSize: "0.8rem", fontWeight: 700, fontFamily: "monospace" }} /></td>
                    <td><button type="button" className="linkButton" style={{ background: "none", border: "none", padding: 0, color: "var(--color-text-primary)", cursor: "pointer", textAlign: "left" }} onClick={() => navigate(`/technical/profiles/${r._id}`)}>{r.name}</button>{r.internalReference && <small>{r.internalReference}</small>}</td>
                    <td>
                      <select value={r.edit.role} disabled={!canEdit} onChange={(e) => setRow(i, { role: e.target.value })} style={{ padding: "5px 6px", fontSize: "0.8rem" }}>
                        <option value="">—</option>
                        {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td className={styles.num}>{r.profileHeight ? fmtMm(r.profileHeight) : "—"}</td>
                    <td className={styles.num}>{r.profileWidth ? fmtMm(r.profileWidth) : "—"}</td>
                    <td className={styles.num}>{r.weightPerMeter ? Number(r.weightPerMeter).toFixed(3) : "—"}</td>
                    {GEO.map(([f, k]) => <td key={k} className={styles.num}><input type="number" min="0" step="any" disabled={!canEdit} value={r.edit[f]} onChange={(e) => setRow(i, { [f]: e.target.value })} style={{ ...numIn, width: 74 }} /></td>)}
                    <td className={styles.num}>{r.quantity ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {canEdit && r.dirty && <button type="button" className="tableActionBtn" title={t("common.save")} onClick={() => saveRow(r)}><Save size={13} /></button>}
                      <button type="button" className="tableActionBtn" title="Fiche profilé" onClick={() => navigate(`/technical/profiles/${r._id}`)}><Box size={13} /></button>
                      {canEdit && <button type="button" className="tableActionBtn" title={sec ? "Remplacer le DXF" : "Importer le DXF"} onClick={() => setDxfFor(r)}><Upload size={13} /></button>}
                      {canEdit && <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("slib.remove")} onClick={() => removeRow(r)}><Trash2 size={13} /></button>}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={10} className={s.muted}>{t("slib.noProfiles")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- variables ---------- */}
      <section className={purch.panel}>
        <div className={purch.sectionHeader}>
          <h3 className={purch.subTitle} style={{ margin: 0 }}>{t("slib.variables")}</h3>
          {canEdit && <button type="button" className="btnEdit" onClick={() => setVars([...vars, { key: "", label: "", formula: "", current: null }])}><Plus size={14} /> {t("slib.addVariable")}</button>}
        </div>
        <p className={s.muted}>{t("slib.variablesHint")}</p>
        {codes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            {codes.map((c) => (
              <span key={c} className={styles.chips} style={{ gap: 3 }}>
                <strong style={{ fontFamily: "monospace", fontSize: "0.78rem", alignSelf: "center" }}>{c}</strong>
                {PROPS.map((p) => <button key={p} type="button" className={styles.chip} title={t(`slib.props.${p}`)} onClick={() => insert(`${c}.${p}`)}><span className={styles.chipCode}>.{p}</span></button>)}
              </span>
            ))}
          </div>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.needTable}>
            <thead><tr><th>{t("prod.editor.key")}</th><th>{t("prod.editor.label")}</th><th>{t("slib.formula")}</th><th className={styles.num}>{t("slib.current")}</th><th /></tr></thead>
            <tbody>
              {vars.map((v, i) => (
                <tr key={i}>
                  <td><input value={v.key} disabled={!canEdit} onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") } : x)))} style={{ width: 90, padding: "5px 6px", fontFamily: "monospace", fontSize: "0.8rem" }} placeholder="rec" /></td>
                  <td><input value={v.label} disabled={!canEdit} onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={{ width: "100%", minWidth: 200, padding: "5px 6px", fontSize: "0.8rem" }} placeholder={t("slib.labelPlaceholder")} /></td>
                  <td><input value={v.formula} disabled={!canEdit} onFocus={() => { focusRef.current = { index: i }; }} onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, formula: e.target.value } : x)))} style={{ width: "100%", minWidth: 220, padding: "5px 6px", fontFamily: "monospace", fontSize: "0.8rem" }} placeholder="OUV.ae - 2" /></td>
                  <td className={styles.num}>{v.error ? <span style={{ color: "var(--tone-f87171)" }} title={v.error}><AlertTriangle size={12} /></span> : <strong>{v.current !== null && v.current !== undefined ? fmtMm(v.current) : "—"}</strong>}</td>
                  <td>{canEdit && <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => setVars(vars.filter((_, j) => j !== i))}><Trash2 size={13} /></button>}</td>
                </tr>
              ))}
              {!vars.length && <tr><td colSpan={5} className={s.muted}>{t("slib.noVariables")}</td></tr>}
            </tbody>
          </table>
        </div>
        {canEdit && <button type="button" className="btnPrimary" style={{ marginTop: 10 }} onClick={saveVars}><Save size={14} /> {t("slib.saveVariables")}</button>}
      </section>

      {/* ---------- nodes ---------- */}
      <NodesPanel series={series} sections={sections} nodes={nodes} canEdit={canEdit} />

      {/* ---------- models ---------- */}
      <section className={purch.panel}>
        <h3 className={purch.subTitle} style={{ marginTop: 0 }}>{t("slib.models")} ({series.models.length})</h3>
        <div className={styles.tableWrap}>
          <table className={styles.needTable}>
            <tbody>
              {series.models.map((m) => (
                <tr key={m._id}>
                  <td><strong>{m.name}</strong>{m.code && <small>{m.code}</small>}</td>
                  <td className={s.muted}>{familyLabel(families, m.family, language)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="btnEdit" onClick={() => navigate(`/technical/designer/${m._id}`)}><PenTool size={13} /> {t("cad.open")}</button>{" "}
                    <button type="button" className="btnEdit" onClick={() => navigate(`/technical/catalog/models/${m._id}`)}><Pencil size={13} /> {t("slib.formulas")}</button>
                  </td>
                </tr>
              ))}
              {!series.models.length && <tr><td className={s.muted}>{t("slib.noModels")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {dxfFor && <DxfImportModal productId={dxfFor._id} productName={dxfFor.name} onClose={() => setDxfFor(null)} onDone={() => { setDxfFor(null); run(async () => {}, "Coupe DXF enregistrée."); }} />}
      {adding && <AddProfilesModal seriesId={id} onClose={() => setAdding(false)} onDone={(n) => { setAdding(false); run(async () => {}, t("slib.added").replace("{n}", n)); }} />}
    </div>
  );
}

/** Picks inventory profiles to put in the series, each with a suggested code. */
function AddProfilesModal({ seriesId, onClose, onDone }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [list, setList] = useState(null);
  const [picked, setPicked] = useState({});
  const [error, setError] = useState("");
  useEffect(() => {
    const h = setTimeout(() => getSeriesCandidates(seriesId, search).then(setList).catch((err) => setError(err.response?.data?.message || t("prod.errors.load"))), 250);
    return () => clearTimeout(h);
  }, [seriesId, search, t]);
  const toggle = (p) => setPicked((prev) => { const n = { ...prev }; if (n[p._id]) delete n[p._id]; else n[p._id] = p.suggestedCode; return n; });
  const confirm = async () => {
    setError("");
    try {
      const r = await addSeriesProfiles(seriesId, Object.entries(picked).map(([product, code]) => ({ product, code })));
      onDone(r.added);
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={purch.modalCard} style={{ maxWidth: 760 }}>
        <div className={purch.sectionHeader}><h3 style={{ margin: 0 }}>{t("slib.addProfiles")}</h3><button type="button" className="tableActionBtn" onClick={onClose}><X size={14} /></button></div>
        <p className={s.muted}>{t("slib.addHint")}</p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }} />
          <input className={purch.input} style={{ paddingLeft: 30 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("tech.searchPlaceholder")} autoFocus />
        </div>
        {error && <div className="errorMessage">{error}</div>}
        <div className={styles.tableWrap} style={{ maxHeight: 380, overflow: "auto" }}>
          <table className={styles.needTable}>
            <tbody>
              {(list || []).map((p) => (
                <tr key={p._id}>
                  <td style={{ width: 28 }}><input type="checkbox" checked={!!picked[p._id]} onChange={() => toggle(p)} aria-label={p.name} /></td>
                  <td>{p.name}{p.internalReference && <small>{p.internalReference}</small>}{p.profileSeries?.name && <small>{t("slib.inOtherSeries").replace("{name}", p.profileSeries.name)}</small>}</td>
                  <td style={{ width: 110 }}>
                    {picked[p._id] !== undefined
                      ? <input value={picked[p._id]} onChange={(e) => setPicked({ ...picked, [p._id]: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} style={{ width: 80, padding: "5px 6px", fontFamily: "monospace", fontWeight: 700 }} />
                      : <span className={s.muted} style={{ fontFamily: "monospace" }}>{p.suggestedCode}</span>}
                  </td>
                </tr>
              ))}
              {list && !list.length && <tr><td className={s.muted}>{t("slib.noCandidates")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btnPrimary" disabled={!Object.keys(picked).length} onClick={confirm}><Plus size={14} /> {t("slib.addN").replace("{n}", Object.keys(picked).length)}</button>
        </div>
      </div>
    </div>
  );
}
