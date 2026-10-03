import { useNavigate } from "react-router-dom";
import { Plus, AlertTriangle, GitMerge } from "lucide-react";
import NodeCanvas from "./NodeCanvas";
import { NODE_TYPES, VALUE_LABELS } from "./nodeGeometry";
import { fmtMm } from "../../../components/dxf/geometry";
import purch from "../../purchasing/Purchasing.module.css";
import s from "../../sales/Sales.module.css";
import styles from "../../production/Production.module.css";
import css from "./Nodes.module.css";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

/** The nodes a series needs, from the roles of its profiles (LogiKal-like guided set-up). */
export function expectedNodes(profiles) {
  const by = (role) => profiles.filter((p) => p.profileRole === role && p.seriesCode);
  const frames = by("frame");
  const sashes = by("sash");
  const mullions = by("mullion");
  const meetings = by("meeting");
  const out = [];
  for (const f of frames) out.push({ type: "frame", main: f });
  for (const r of [...frames, ...mullions]) for (const sh of sashes) out.push({ type: "frameSash", main: r, second: sh });
  for (const sh of sashes) out.push({ type: "sashGlazing", main: sh });
  for (const r of [...frames, ...mullions]) out.push({ type: "fixedGlazing", main: r });
  for (const m of mullions) out.push({ type: "mullion", main: m });
  for (const sh of sashes) out.push({ type: "meeting", main: sh, second: meetings[0] || null });
  return out;
}

/**
 * NODES of a series: each card shows the real DXF assembly and its
 * measured values; the missing combinations are proposed.
 */
export default function NodesPanel({ series, sections, nodes, canEdit }) {
  const navigate = useNavigate();
  const secOf = new Map((sections || []).map((x) => [String(x.product), x.section]));
  const exists = new Set(nodes.map((n) => `${n.type}|${idOf(n.main)}|${n.type === "meeting" ? "" : idOf(n.second)}`));
  const missing = expectedNodes(series.profiles).filter((x) => !exists.has(`${x.type}|${x.main._id}|${x.type === "meeting" ? "" : x.second?._id || ""}`));
  const open = (q) => navigate(`/technical/series/${series._id}/nodes/new?${new URLSearchParams(q).toString()}`);
  const noRoles = series.profiles.some((p) => p.seriesCode && !p.profileRole);

  return (
    <section className={purch.panel}>
      <div className={purch.sectionHeader}>
        <h3 className={purch.subTitle} style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}><GitMerge size={16} /> Nœuds — liaisons entre profilés ({nodes.length})</h3>
        {canEdit && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(NODE_TYPES).map(([k, d]) => <button key={k} type="button" className="btnEdit" onClick={() => open({ type: k })}><Plus size={13} /> {d.short}</button>)}
          </div>
        )}
      </div>
      <p className={s.muted}>
        Comme dans LogiKal : chaque nœud se règle une fois en plaçant les DXF des profilés l'un contre l'autre (recouvrement, prise de verre, parclose, cote / jour…). Les valeurs mesurées pilotent toutes les cotes de débit des châssis de la série — sans nœud, le CAD utilise une estimation et le signale.
      </p>
      {noRoles && <div className={purch.infoBanner}><AlertTriangle size={14} /> Donnez un rôle (dormant, ouvrant, meneau, parclose, battement) à chaque profilé de la bibliothèque pour que les nœuds manquants soient proposés.</div>}
      {canEdit && missing.length > 0 && (
        <div className={css.missing}>
          <span>À définir :</span>
          {missing.slice(0, 24).map((x, i) => (
            <button key={i} type="button" className={styles.chip} onClick={() => open({ type: x.type, main: x.main._id, ...(x.second ? { second: x.second._id } : {}) })}>
              <Plus size={11} /> {NODE_TYPES[x.type].short} · {x.main.seriesCode}{x.second ? ` / ${x.second.seriesCode}` : ""}
            </button>
          ))}
        </div>
      )}
      <div className={css.grid}>
        {nodes.map((n) => {
          const sec = { main: secOf.get(idOf(n.main)), second: n.second ? secOf.get(idOf(n.second)) : null, bead: n.bead ? secOf.get(idOf(n.bead)) : null };
          return (
            <button key={n._id} type="button" className={css.card} onClick={() => navigate(`/technical/nodes/${n._id}`)}>
              <div className={css.cardHead}>
                <strong>{n.name || NODE_TYPES[n.type]?.label}</strong>
                {n.stale && <span className={css.stale} title="Un DXF a changé depuis la mesure"><AlertTriangle size={11} /> à vérifier</span>}
              </div>
              <div className={s.muted} style={{ fontSize: "0.74rem" }}>{[n.main, n.second, n.bead].filter(Boolean).map((p) => p.seriesCode || p.name).join(" · ")}{n.glassThickness ? ` · verre ${n.glassThickness} mm` : ""}</div>
              {sec.main ? <NodeCanvas type={n.type} sections={sec} placements={n.placements} glassThickness={n.glassThickness || 24} height={150} compact /> : <div className={css.noDxf}>DXF manquant</div>}
              <div className={css.values}>
                {Object.entries(n.values || {}).map(([k, v]) => <span key={k}>{VALUE_LABELS[k]} <strong>{fmtMm(v)}</strong></span>)}
              </div>
            </button>
          );
        })}
        {!nodes.length && <p className={s.muted}>Aucun nœud : les cotes de débit sont estimées depuis la géométrie des profilés.</p>}
      </div>
    </section>
  );
}
