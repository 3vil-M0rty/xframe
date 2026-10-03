import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { PenTool, Save, AlertTriangle, Ruler, Scissors, LayoutPanelTop, FileCode2, Factory, Layers, Undo2, Redo2, Trash2, MousePointer2 } from "lucide-react";

import { useI18n } from "../../../hooks/useI18n";
import { useCan } from "../../../hooks/useCan";
import Breadcrumbs from "../../../components/useful/Breadcrumbs";
import CustomSelect from "../../../components/useful/CustomSelect";
import {
  getChassisModel, createChassisModel, updateChassisModel, getSeriesDetail, previewDesign, getGlassTypes, getCatalog, downloadFabricationPdf, getSeriesSections, getSeriesNodes,
} from "../../../services/productionService";
import { familyLabel } from "../../production/prodShared";
import { defaultDesign, usedCodes, setLink, dropDivider, dropOnCell, moveDivider, setPartSize, deleteElement, template, rolesOf } from "./designTree";
import DrawingCanvas from "./DrawingCanvas";
import Palette from "./Palette";
import Inspector from "./Inspector";
import ProfilesStep from "./ProfilesStep";
import Sections from "./Sections";
import CutList from "./CutList";
import Fabrication from "./Fabrication";
import st from "./Designer.module.css";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";
const ROLE_LABEL = { frame: "dormant", sash: "ouvrant", mullion: "meneau", transom: "traverse", bead: "parclose", meeting: "battement" };
const STEPS = [
  ["face", LayoutPanelTop, "Dessin"], ["profiles", Layers, "Profilés"], ["sections", Ruler, "Coupes"], ["cut", Scissors, "Débit"], ["fab", Factory, "Fabrication"],
];

/**
 * CONCEPTION (CAD), LogiKal-like and quick:
 *   1 Dessin      drag & drop: meneaux, traverses, ouvrants, remplissages,
 *                 gabarits; move dividers and frame edges; type dimensions
 *   2 Profilés    attribute a profile of the series to each kind of element
 *   3 Coupes      the liaisons, from the series' nodes (real DXF)
 *   4 Débit       bars (optimised) and glass at L × H × quantity
 *   5 Fabrication pieces, machining, accessories, dossier PDF
 * Saved as a catalogue model, reloaded and resized any time.
 */
export default function DesignerPage() {
  const { id } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const can = useCan();
  const isNew = id === "new";
  const [model, setModel] = useState(null);
  const [series, setSeries] = useState(null);
  // the drawing with its undo / redo history (pure updates)
  const [doc, setDoc] = useState({ design: null, past: [], future: [] });
  const design = doc.design;
  const setDesign = (d) => setDoc({ design: d, past: [], future: [] });
  const [meta, setMeta] = useState({ name: query.get("name") || "", family: "ouvrant" });
  const [families, setFamilies] = useState([]);
  const [glassTypes, setGlassTypes] = useState([]);
  const [glassId, setGlassId] = useState("");
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("face");
  const [selected, setSelected] = useState(null);
  const [armed, setArmed] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sections, setSections] = useState([]);
  const [nodeList, setNodeList] = useState([]);
  const reqId = useRef(0);
  const canEdit = can("production.catalog.edit") || can("production.catalog.create");

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      try {
        getCatalog().then((c) => setFamilies(c.families || [])).catch(() => {});
        let m = null;
        let seriesId = query.get("series");
        let startDesign = null;
        if (!isNew) {
          m = await getChassisModel(id);
          seriesId = idOf(m.series);
          startDesign = m.design;
          setMeta({ name: m.name, family: m.family });
        } else if (query.get("from")) {
          const src = await getChassisModel(query.get("from"));
          seriesId = seriesId || idOf(src.series);
          startDesign = src.design ? { ...src.design, layout: undefined } : null;
          setMeta((x) => ({ ...x, family: src.family, name: x.name || `${src.name} (copie)` }));
        }
        if (!seriesId) { setError(t("cad.noSeries")); return; }
        const sd = await getSeriesDetail(seriesId);
        setSeries(sd);
        setModel(m);
        getSeriesSections(seriesId).then(setSections).catch(() => {});
        getSeriesNodes(seriesId).then(setNodeList).catch(() => {});
        setDesign(startDesign ? { profiles: {}, ...startDesign, layout: undefined } : defaultDesign());
        getGlassTypes(sd.company, { active: "true" }).then((g) => { setGlassTypes(g); if (g[0]) setGlassId(g[0]._id); }).catch(() => {});
      } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
    })();
  }, [id, isNew, query, t]);

  const library = useMemo(() => (series?.profiles || []).filter((p) => p.seriesCode)
    .map((p) => ({ code: p.seriesCode, name: p.name, role: p.profileRole, ...p.props }))
    .sort((a, b) => a.code.localeCompare(b.code)), [series]);
  const profiles = useMemo(() => new Map(library.map((p) => [p.code, p])), [library]);
  const sectionByProduct = useMemo(() => new Map(sections.filter((x) => x.section).map((x) => [String(x.product), x.section])), [sections]);
  const sectionByCode = useMemo(() => new Map(sections.filter((x) => x.section && x.code).map((x) => [x.code, x.section])), [sections]);
  const nodeById = useMemo(() => new Map(nodeList.map((n) => [String(n._id), n])), [nodeList]);
  const idByCode = useMemo(() => Object.fromEntries((series?.profiles || []).filter((p) => p.seriesCode).map((p) => [p.seriesCode, p._id])), [series]);
  const missing = design ? usedCodes(design).filter((c) => !profiles.has(c)) : [];

  // ---------- live calculation (debounced) ----------
  const L = design?.preview?.L || 1200;
  const H = design?.preview?.H || 1400;
  const qty = design?.preview?.quantity || 1;
  useEffect(() => {
    if (!design || !series) return undefined;
    const my = ++reqId.current;
    const h = setTimeout(async () => {
      try {
        const r = await previewDesign({ company: series.company, series: series._id, design, L, H, quantity: qty, params: glassId ? { vitrage: glassId } : {}, model: isNew ? undefined : id });
        if (my === reqId.current) { setPreview(r); setError(""); }
      } catch (err) { if (my === reqId.current) setError(err.response?.data?.message || t("prod.errors.load")); }
    }, 120);
    return () => clearTimeout(h);
  }, [design, series, L, H, qty, glassId, isNew, id, t]);

  // ---------- editing with undo / redo ----------
  const change = useCallback((d) => {
    setDoc((s) => (d === s.design ? s : { design: d, past: [...s.past.slice(-60), s.design], future: [] }));
    setDirty(true);
    setNotice("");
  }, []);
  const undo = useCallback(() => { setDoc((s) => (s.past.length ? { design: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.design, ...s.future] } : s)); setDirty(true); }, []);
  const redo = useCallback(() => { setDoc((s) => (s.future.length ? { design: s.future[0], past: [...s.past, s.design], future: s.future.slice(1) } : s)); setDirty(true); }, []);
  const remove = useCallback(() => {
    if (!design || !selected) return;
    change(deleteElement(design, selected));
    setSelected(null);
  }, [design, selected, change]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || tab !== "face") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (e.key === "Delete" || e.key === "Backspace") { if (selected) { e.preventDefault(); remove(); } }
      else if (e.key === "Escape") { setArmed(null); setSelected(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, undo, redo, remove, selected]);

  const setSize = (patch) => change({ ...design, preview: { ...design.preview, ...patch } });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        if (!meta.name.trim()) throw new Error(t("cad.nameRequired"));
        const m = await createChassisModel({ company: series.company, series: series._id, name: meta.name.trim(), family: meta.family, design });
        setDirty(false);
        navigate(`/technical/designer/${m._id}`, { replace: true });
      } else {
        await updateChassisModel(id, { design, name: meta.name.trim(), family: meta.family });
        setDirty(false);
        setNotice(t("cad.saved"));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("prod.errors.save"));
    } finally {
      setSaving(false);
    }
  };
  const downloadPdf = async (sectionsWanted) => {
    setPdfBusy(true);
    setError("");
    try {
      await downloadFabricationPdf(
        { company: series.company, series: series._id, design, L, H, quantity: qty, params: glassId ? { vitrage: glassId } : {}, model: isNew ? undefined : id, name: meta.name || undefined, sections: sectionsWanted },
        `Fabrication ${meta.name || "dessin"} ${Math.round(L)}x${Math.round(H)}`,
      );
    } catch (err) { setError(err.response?.data?.message || err.message || t("prod.errors.load")); }
    finally { setPdfBusy(false); }
  };

  if (!design || !series) {
    return <div className="pageShell">{error ? <div className="errorMessage">{error}</div> : <p className={st.muted}>{t("common.loading")}</p>}</div>;
  }

  const incomplete = preview?.incomplete || [];
  const noComposition = preview && !preview.hasGlassTypes && (preview.panes || []).some((x) => x.type === "glass");
  const issues = preview ? [
    ...(noComposition ? [{ message: t("cad.noComposition") }] : []),
    ...[...preview.errors, ...preview.warnings].filter((e) => !(noComposition && /Vitrage/.test(e.message) && /aucun modèle choisi/.test(e.message))),
  ] : [];
  const familyOptions = families.filter((f) => !["vitrage", "remplissage"].includes(f.key)).map((f) => ({ value: f.key, label: familyLabel(families, f.key, language) }));
  const needsProfiles = incomplete.length > 0 && ["sections", "cut", "fab"].includes(tab);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.technical"), href: "/technical/catalog" }, { label: t("cad.title"), href: "/technical/designer" }, { label: meta.name || t("cad.newDesign") }]} />
      <div className={st.topbar}>
        <div className={st.titleBlock}>
          <PenTool size={18} />
          <input className={st.nameInput} value={meta.name} placeholder={t("cad.namePlaceholder")} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setDirty(true); }} />
          <Link to={`/technical/series/${series._id}`} className={st.seriesTag} title={t("cad.openSeries")}>{series.name}</Link>
        </div>
        <div className={st.dims}>
          <label>L<input type="number" min="200" step="1" value={L} onChange={(e) => setSize({ L: Number(e.target.value) || 0 })} /></label>
          <span>×</span>
          <label>H<input type="number" min="200" step="1" value={H} onChange={(e) => setSize({ H: Number(e.target.value) || 0 })} /></label>
          <label>{t("cad.qtyShort")}<input type="number" min="1" step="1" value={qty} onChange={(e) => setSize({ quantity: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 56 }} /></label>
        </div>
        <div className={st.topActions}>
          {glassTypes.length > 0 && <CustomSelect value={glassId} onSelect={setGlassId} options={glassTypes.map((g) => ({ value: g._id, label: g.name }))} />}
          <CustomSelect value={meta.family} onSelect={(v) => { setMeta({ ...meta, family: v }); setDirty(true); }} options={familyOptions} />
          {!isNew && <button type="button" className="btnEdit" onClick={() => navigate(`/technical/catalog/models/${id}`)} title={t("cad.formulasHint")}><FileCode2 size={14} /> {t("cad.formulas")}</button>}
          {canEdit && <button type="button" className="btnPrimary" disabled={saving || (!dirty && !isNew)} onClick={save}><Save size={14} /> {saving ? t("common.loading") : t("common.save")}</button>}
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={st.notice}>{notice}</div>}
      {model && !model.design && <div className={st.warnBanner}><AlertTriangle size={14} /> {t("cad.noDesignYet")}</div>}
      {missing.length > 0 && (
        <div className={st.warnBanner}>
          <AlertTriangle size={14} /> {t("cad.missingCodes").replace("{codes}", missing.join(", "))}{" "}
          <Link to={`/technical/series/${series._id}`}>{t("cad.openSeries")}</Link>
        </div>
      )}

      <div className={st.steps}>
        {STEPS.map(([k, Icon, label], i) => (
          <button key={k} type="button" className={`${st.step} ${tab === k ? st.stepOn : ""} ${k === "profiles" && incomplete.length ? st.stepTodo : ""}`} onClick={() => setTab(k)}>
            <span className={st.stepNo}>{i + 1}</span><Icon size={14} /> {label}
            {k === "profiles" && incomplete.length > 0 && <span className={st.stepBadge}>{incomplete.length}</span>}
          </button>
        ))}
      </div>

      {needsProfiles && (
        <div className={st.warnBanner}>
          <AlertTriangle size={14} /> Profilés à attribuer : {incomplete.map((r) => ROLE_LABEL[r] || r).join(", ")} — les cotes ci-dessous sont provisoires.
          <button type="button" className={st.linkBtn} onClick={() => setTab("profiles")}>Étape Profilés →</button>
        </div>
      )}

      {tab === "face" && (
        <div className={st.drawSpace}>
          <aside className={st.paletteCol}>
            <Palette armed={armed} onArm={setArmed} onTemplate={(key) => { change(template(key, design)); setSelected(null); }} />
          </aside>
          <div className={st.stage}>
            <div className={st.toolbar}>
              <button type="button" onClick={undo} disabled={!doc.past.length} title="Annuler (Ctrl+Z)"><Undo2 size={15} /></button>
              <button type="button" onClick={redo} disabled={!doc.future.length} title="Rétablir (Ctrl+Y)"><Redo2 size={15} /></button>
              <button type="button" onClick={remove} disabled={!selected || selected === "frame"} title="Supprimer l'élément (Suppr)"><Trash2 size={15} /></button>
              <span className={st.toolSep} />
              {armed ? <span className={st.armedTag}><MousePointer2 size={13} /> Cliquez une case pour placer l'élément (Maj : en placer plusieurs) · Échap pour annuler</span>
                : <span className={st.muted}>{rolesOf(design).length} type(s) d'éléments · {incomplete.length ? `profilés à attribuer : ${incomplete.map((r) => ROLE_LABEL[r]).join(", ")}` : "profilés attribués"}</span>}
            </div>
            <DrawingCanvas
              layout={preview?.layout || []} design={design} L={L} H={H} selected={selected} onSelect={setSelected} armed={armed} onPlaced={() => setArmed(null)}
              onDropItem={(cellId, item) => { change(dropOnCell(design, cellId, item)); setSelected(cellId); }}
              onDropDivider={(cellId, dir, offset, size) => {
                const width = (preview?.layout || []).find((r) => r.type === (dir === "v" ? "mullion" : "transom"))?.[dir === "v" ? "w" : "h"] || 60;
                change(dropDivider(design, cellId, dir, offset, size, width));
              }}
              onMoveDivider={(splitId, index, delta, parts) => change(moveDivider(design, splitId, index, delta, parts))}
              onSetPart={(splitId, index, size, parts) => change(setPartSize(design, splitId, index, size, parts))}
              onResize={(size) => setSize(size)} />
            {issues.length > 0 && (
              <ul className={st.issues}>
                {issues.slice(0, 6).map((e, i) => <li key={i}><AlertTriangle size={12} /> {e.message}</li>)}
              </ul>
            )}
          </div>
          <aside className={st.side}>
            <Inspector design={design} selected={selected} library={library} onChange={change} onSelect={setSelected} sectionByCode={sectionByCode} />
          </aside>
        </div>
      )}
      {tab === "profiles" && <ProfilesStep design={design} onChange={change} library={library} sectionByCode={sectionByCode} seriesId={series._id} />}
      {tab === "sections" && (
        <Sections links={preview?.links || []} design={design} profiles={profiles} onChange={(link, v) => change(setLink(design, link, v))}
          nodes={nodeById} sections={sectionByProduct} seriesId={series._id} idByCode={idByCode} />
      )}
      {tab === "fab" && <Fabrication preview={preview} quantity={qty} seriesId={series._id} onPdf={downloadPdf} pdfBusy={pdfBusy} />}
      {tab === "cut" && <CutList report={preview?.report} lines={preview?.lines} panes={preview?.panes} hasGlassTypes={preview?.hasGlassTypes} quantity={qty} />}
    </div>
  );
}
