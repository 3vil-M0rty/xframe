import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GitMerge, Save, Trash2, AlertTriangle, RotateCcw } from "lucide-react";

import { useI18n } from "../../../hooks/useI18n";
import { useCan } from "../../../hooks/useCan";
import { useDialog } from "../../../components/useful/DialogProvider";
import Breadcrumbs from "../../../components/useful/Breadcrumbs";
import CustomSelect from "../../../components/useful/CustomSelect";
import {
  getNode, createNode, updateNode, deleteNode, getSeriesDetail, getSeriesSections,
} from "../../../services/productionService";
import NodeCanvas from "./NodeCanvas";
import FabRulesPanels from "../FabRules";
import { NODE_TYPES, VALUE_LABELS, REF_LABELS, defaultPlacements, measure } from "./nodeGeometry";
import { fmtMm } from "../../../components/dxf/geometry";
import css from "./Nodes.module.css";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";
const ELEMENT_LABELS = { second: "Profilé placé", bead: "Parclose", glass: "Vitrage", bat: "Battement", cote: "Ligne de cote", jour: "Ligne de jour", axis: "Axe" };
const NODE_TRIGGERS = { frame: ["chassis", "piece"], frameSash: ["leaf", "piece"], sashGlazing: ["pane"], fixedGlazing: ["pane"], mullion: ["joint", "piece"], meeting: ["leaf"] };

/**
 * NODE EDITOR — the section of two profiles of a series, drawn from their
 * DXF: drag the placed profile, the glass, the bead and the reference
 * lines; they snap on the vertices of the others (Alt = no snapping,
 * arrows = 0.1 mm, Shift + arrows = 1 mm). The measured values become
 * the CAD deductions of every chassis using this combination.
 */
export default function NodeEditorPage() {
  const { nodeId, id: seriesParam } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const can = useCan();
  const dialog = useDialog();
  const isNew = !nodeId;
  const [series, setSeries] = useState(null);
  const [sections, setSections] = useState([]);
  const [node, setNode] = useState(null);
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = can("production.catalog.edit");

  const load = useCallback(async () => {
    try {
      let n = null;
      let sid = seriesParam;
      if (!isNew) { n = await getNode(nodeId); sid = idOf(n.series); setNode(n); }
      const [sd, secs] = await Promise.all([getSeriesDetail(sid), getSeriesSections(sid)]);
      setSeries(sd);
      setSections(secs);
      if (n) {
        setForm({ type: n.type, name: n.name || "", main: idOf(n.main), second: idOf(n.second), bead: idOf(n.bead), glassThickness: n.glassThickness || 24, placements: n.placements || {} });
      } else {
        const type = NODE_TYPES[query.get("type")] ? query.get("type") : "frameSash";
        const byRole = (roles) => sd.profiles.find((p) => roles.includes(p.profileRole))?._id || "";
        const def = NODE_TYPES[type];
        const main = query.get("main") || byRole(def.main);
        const second = query.get("second") || (def.second ? byRole(def.second) : "");
        const bead = def.bead ? byRole(["bead"]) : "";
        setForm({ type, name: "", main, second, bead, glassThickness: 24, placements: null });
      }
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [nodeId, seriesParam, isNew, query, t]);
  useEffect(() => { load(); }, [load]);

  const secOf = useMemo(() => new Map(sections.map((x) => [String(x.product), x.section])), [sections]);
  const sec = form ? { main: secOf.get(form.main) || null, second: form.second ? secOf.get(form.second) || null : null, bead: form.bead ? secOf.get(form.bead) || null : null } : {};
  // first placements once the sections are known
  useEffect(() => {
    if (form && !form.placements && sec.main) setForm((f) => ({ ...f, placements: defaultPlacements(f.type, sec) }));
  }, [form, sec.main]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard nudge of the selected element
  useEffect(() => {
    const onKey = (e) => {
      if (!selected || !form?.placements || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const step = e.shiftKey ? 1 : 0.1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (!d) return;
      e.preventDefault();
      setForm((f) => {
        const pl = { ...f.placements };
        if (typeof pl[selected] === "number") pl[selected] = Math.round((pl[selected] + d[0]) * 100) / 100;
        else if (pl[selected]) pl[selected] = { ...pl[selected], x: Math.round(((pl[selected].x || 0) + d[0]) * 100) / 100, y: Math.round(((pl[selected].y || 0) + d[1]) * 100) / 100 };
        return { ...f, placements: pl };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, form?.placements]);

  if (!series || !form) return <div className="pageShell">{error ? <div className="errorMessage">{error}</div> : <p className={css.hint}>{t("common.loading")}</p>}</div>;
  const def = NODE_TYPES[form.type];
  const values = form.placements ? measure(form.type, form.placements) : {};
  const profileOptions = (roles) => {
    const list = series.profiles.filter((p) => p.seriesCode);
    const preferred = list.filter((p) => roles.includes(p.profileRole));
    return [...preferred, ...list.filter((p) => !roles.includes(p.profileRole))].map((p) => ({ value: p._id, label: `${p.seriesCode} — ${p.name}${secOf.get(String(p._id)) ? "" : " (sans DXF)"}` }));
  };
  const missingDxf = [["main", form.main], ["second", def.second && !def.optionalSecond ? form.second : null], ["bead", def.bead ? form.bead : null]].filter(([, id]) => id && !secOf.get(id));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setPl = (pl) => setForm((f) => ({ ...f, placements: pl }));
  const selPl = selected && form.placements ? form.placements[selected] : null;

  const save = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const body = { type: form.type, name: form.name, main: form.main, second: form.second || null, bead: form.bead || null, glassThickness: def.glass ? Number(form.glassThickness) || 24 : null, placements: form.placements, values };
      if (isNew) {
        const n = await createNode(series._id, body);
        navigate(`/technical/nodes/${n._id}`, { replace: true });
      } else {
        await updateNode(nodeId, body);
        setNotice("Nœud enregistré : les châssis de la série utilisent ces cotes.");
        await load();
      }
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await dialog.confirm("Supprimer ce nœud ? Les châssis reviendront aux cotes estimées."))) return;
    await deleteNode(nodeId);
    navigate(`/technical/series/${series._id}`);
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.technical"), href: "/technical/catalog" }, { label: series.name, href: `/technical/series/${series._id}` }, { label: def.label }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><GitMerge size={20} /><h1>{form.name || def.label}</h1></div>
          <p className="pageSubtitle">{def.hint}</p>
        </div>
        <div className="pageHeaderActions">
          {!isNew && canEdit && <button type="button" className="btnCancel" onClick={remove}><Trash2 size={14} /> Supprimer</button>}
          {canEdit && <button type="button" className="btnPrimary" disabled={busy || !form.placements || missingDxf.length > 0} onClick={save}><Save size={14} /> {t("common.save")}</button>}
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className="successMessage" style={{ marginBottom: 10 }}>{notice}</div>}
      {node?.stale && <div className="errorMessage" style={{ display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} /> Un DXF de ce nœud a changé depuis la mesure : vérifiez les positions puis enregistrez.</div>}

      <div className={css.editor}>
        <aside className={css.side}>
          {isNew && (
            <label>Type de nœud
              <CustomSelect value={form.type} onSelect={(type) => set({ type, placements: null, second: NODE_TYPES[type].second ? form.second : "", bead: NODE_TYPES[type].bead ? form.bead : "" })}
                options={Object.entries(NODE_TYPES).map(([k, d]) => ({ value: k, label: d.label }))} />
            </label>
          )}
          <label>Nom (facultatif)<input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={def.label} style={{ padding: "6px 8px" }} /></label>
          <label>{form.type === "meeting" ? "Profilé d'ouvrant" : form.type === "sashGlazing" ? "Ouvrant" : form.type === "mullion" ? "Meneau / traverse" : "Dormant / meneau"}
            <CustomSelect value={form.main} onSelect={(v) => set({ main: v, placements: null })} options={profileOptions(def.main)} />
          </label>
          {def.second && (
            <label>{form.type === "meeting" ? "Battement (facultatif)" : "Ouvrant"}
              <CustomSelect value={form.second || ""} onSelect={(v) => set({ second: v, placements: null })} options={[...(def.optionalSecond ? [{ value: "", label: "Aucun" }] : []), ...profileOptions(def.second)]} />
            </label>
          )}
          {def.bead && (
            <label>Parclose
              <CustomSelect value={form.bead || ""} onSelect={(v) => set({ bead: v })} options={[{ value: "", label: "Aucune" }, ...profileOptions(["bead"])]} />
            </label>
          )}
          {def.glass && <label>Épaisseur du vitrage (mm)<input type="number" min="1" step="0.5" value={form.glassThickness} onChange={(e) => set({ glassThickness: e.target.value })} style={{ padding: "6px 8px" }} /></label>}
          {(def.numeric || []).map((k) => (
            <label key={k}>{VALUE_LABELS[k]} (mm)<input type="number" step="0.1" value={form.placements?.[k] ?? 0} onChange={(e) => setPl({ ...form.placements, [k]: Number(e.target.value) || 0 })} style={{ padding: "6px 8px" }} /></label>
          ))}

          <div className={css.result}>
            {def.values.map((k) => <div key={k}><span>{VALUE_LABELS[k]}</span><strong>{fmtMm(values[k], 2)} mm</strong></div>)}
          </div>

          {selected && selPl !== null && selPl !== undefined && (
            <div>
              <div className={css.selName}>{ELEMENT_LABELS[selected] || selected}</div>
              {typeof selPl === "number" ? (
                <div className={css.xy}><span>X</span><input type="number" step="0.1" value={selPl} onChange={(e) => setPl({ ...form.placements, [selected]: Number(e.target.value) || 0 })} /><span /></div>
              ) : (
                <div className={css.xy}>
                  <span>X / Y</span>
                  <input type="number" step="0.1" value={selPl.x ?? 0} onChange={(e) => setPl({ ...form.placements, [selected]: { ...selPl, x: Number(e.target.value) || 0 } })} />
                  <input type="number" step="0.1" value={selPl.y ?? 0} onChange={(e) => setPl({ ...form.placements, [selected]: { ...selPl, y: Number(e.target.value) || 0 } })} />
                </div>
              )}
            </div>
          )}
          <p className={css.hint}>Glissez les éléments à la souris : ils s'aimantent coin sur coin ou dans l'alignement des sommets des autres profilés (Alt = sans aimant). Flèches : 0,1 mm, Maj + flèches : 1 mm. Molette : zoom, glisser le fond : déplacer la vue.</p>
          <button type="button" className="btnEdit" onClick={() => setPl(defaultPlacements(form.type, sec))} disabled={!sec.main}><RotateCcw size={13} /> Positions de départ</button>
        </aside>

        <div>
          {missingDxf.length > 0 ? (
            <div className="errorMessage">
              Importez d'abord la coupe DXF de : {missingDxf.map(([, id]) => series.profiles.find((p) => p._id === id)?.name).join(", ")}{" "}
              {missingDxf.map(([, id]) => <Link key={id} to={`/technical/profiles/${id}`} style={{ marginLeft: 6 }}>ouvrir la fiche</Link>)}
            </div>
          ) : form.placements && (
            <>
              <NodeCanvas type={form.type} sections={sec} placements={form.placements} onChange={canEdit ? setPl : undefined} glassThickness={Number(form.glassThickness) || 24}
                selected={selected} onSelect={setSelected} height={560} />
              <div className={css.legend}>
                <span><i style={{ background: "rgba(var(--overlay-rgb),0.3)" }} />Profilé principal (fixe)</span>
                <span><i style={{ background: "#4c8dff" }} />Profilé placé</span>
                {def.bead && <span><i style={{ background: "#3fb27f" }} />Parclose</span>}
                {def.glass && <span><i style={{ background: "#6ea8fe55", border: "1px solid #6ea8fe" }} />Vitrage</span>}
                {def.refs.map((k) => <span key={k}><i style={{ background: "#f87171" }} />{REF_LABELS[k]}</span>)}
              </div>
            </>
          )}
        </div>
      </div>

      {!isNew && (
        <div style={{ marginTop: 16 }}>
          <FabRulesPanels
            rules={node?.rules || []} machining={null} companyId={series.company} canEdit={canEdit} triggers={NODE_TRIGGERS[form.type]}
            accessoriesHint="Articles qui vont avec cette liaison, pour chaque élément où elle sert : joint central sur chaque vantail d'un dormant / ouvrant, cales et joint de vitrage pour chaque vitrage, connecteurs pour un meneau…"
            onSaveRules={async (rules) => {
              try { await updateNode(nodeId, { rules }); setNotice("Accessoires du nœud enregistrés."); await load(); return true; } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); return false; }
            }} />
        </div>
      )}
    </div>
  );
}
