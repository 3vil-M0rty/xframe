import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import NodeCanvas from "../nodes/NodeCanvas";
import { NODE_TYPES } from "../nodes/nodeGeometry";
import { useI18n } from "../../../hooks/useI18n";
import { getLinkOverride } from "./designTree";
import st from "./Designer.module.css";

const r05 = (v) => Math.round(v * 2) / 2;
const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? "—" : String(Math.round(v * 10) / 10).replace(".", ","));

/**
 * COUPES — each liaison of the design drawn as a section: the profiles of
 * the series side by side (from their geometry: ailette externe, chambre,
 * ailette interne, largeur), the part you position (ouvrant, verre, jour)
 * is dragged with the mouse and the measured value becomes the liaison.
 */
const NODE_OF_KIND = { frameClear: "frame", frameCover: "frame", sashOverlap: "frameSash", sashGlass: "sashGlazing", sashClear: "sashGlazing", fixedBite: "fixedGlazing", fixedBead: "fixedGlazing", splitClear: "mullion", splitEnd: "mullion", meeting: "meeting" };

/** Query to create the node a liaison is missing (type + profiles of the series). */
function nodeQuery(link, idByCode) {
  const type = NODE_OF_KIND[link.kind];
  const [a, b] = link.codes || [];
  const pairs = {
    frame: { main: a }, frameSash: { main: b, second: a }, sashGlazing: { main: a }, fixedGlazing: { main: a }, mullion: { main: a }, meeting: { main: a, second: b },
  }[type] || {};
  const q = { type };
  if (pairs.main && idByCode[pairs.main]) q.main = idByCode[pairs.main];
  if (pairs.second && idByCode[pairs.second]) q.second = idByCode[pairs.second];
  return new URLSearchParams(q).toString();
}

/**
 * COUPES — every liaison of the design. Measured by a NODE of the series
 * (the real DXF of the profiles, placed once in the node editor) or, if
 * the node is missing, estimated from the profile geometry — draggable
 * here, and a link creates the node. A value can be overridden per design.
 */
export default function Sections({ links = [], design, profiles, onChange, nodes = new Map(), sections = new Map(), seriesId, idByCode = {} }) {
  const { t } = useI18n();
  const jd = links.find((l) => l.key === "x_jd")?.value ?? 0;
  if (!links.length) return <p className={st.muted}>{t("cad.noLinks")}</p>;
  // links measured by the same node are shown together, on its drawing
  const groups = [];
  const byNode = new Map();
  for (const l of links) {
    if (l.profileNode && nodes.get(l.profileNode)) {
      if (!byNode.has(l.profileNode)) { const g = { node: nodes.get(l.profileNode), links: [] }; byNode.set(l.profileNode, g); groups.push(g); }
      byNode.get(l.profileNode).links.push(l);
    } else groups.push({ link: l });
  }
  const estimated = links.filter((l) => l.source !== "node").length;
  return (
    <>
      {estimated > 0 && (
        <div className={st.warnBanner}>
          {estimated} liaison(s) estimée(s) depuis la géométrie simplifiée : définissez les nœuds de la série pour des cotes mesurées sur les DXF.
          {seriesId && <Link to={`/technical/series/${seriesId}`}>Nœuds de la série</Link>}
        </div>
      )}
      <div className={st.sections}>
        {groups.map((g, i) => (g.node
          ? <NodeGroupCard key={g.node._id + i} node={g.node} links={g.links} design={design} sections={sections} onChange={onChange} />
          : <SectionCard key={g.link.key} link={g.link} jd={jd} override={getLinkOverride(design, g.link)} profiles={profiles} onChange={(v) => onChange(g.link, v)}
              create={seriesId ? `/technical/series/${seriesId}/nodes/new?${nodeQuery(g.link, idByCode)}` : null} />))}
      </div>
    </>
  );
}

/** Liaisons measured by a node: its real DXF drawing, the values, per-design overrides. */
function NodeGroupCard({ node, links, design, sections, onChange }) {
  const { t } = useI18n();
  const sec = { main: sections.get(String(node.main?._id || node.main)), second: node.second ? sections.get(String(node.second?._id || node.second)) : null, bead: node.bead ? sections.get(String(node.bead?._id || node.bead)) : null };
  return (
    <div className={st.sectionCard}>
      <div className={st.sectionHead}>
        <strong>{node.name || NODE_TYPES[node.type]?.label}</strong>
        <span className={st.nodeBadge}>{node.stale ? "nœud à vérifier" : "nœud mesuré"}</span>
      </div>
      {sec.main ? <NodeCanvas type={node.type} sections={sec} placements={node.placements} glassThickness={node.glassThickness || 24} height={210} compact /> : <p className={st.muted}>DXF manquant</p>}
      {links.map((l) => {
        const override = getLinkOverride(design, l);
        return (
          <div key={l.key} className={st.sectionFoot} style={{ marginTop: 6 }}>
            <span style={{ flex: 1 }}>{l.label}</span>
            <strong className={st.sectionValue}>{fmt(l.value)} mm</strong>
            <label className={st.overrideField} style={{ marginLeft: 0 }}>
              <input defaultValue={override} key={override} placeholder={t("cad.auto")} onBlur={(e) => { if (e.target.value !== override) onChange(l, e.target.value.trim()); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} title="Valeur forcée pour ce dessin seulement" />
            </label>
            {override && <button type="button" className="tableActionBtn" title={t("cad.reset")} onClick={() => onChange(l, "")}><RotateCcw size={13} /></button>}
          </div>
        );
      })}
      <Link to={`/technical/nodes/${node._id}`} className={st.nodeLink}>Modifier le nœud (série) →</Link>
    </div>
  );
}

function SectionCard({ link, jd, override, profiles, onChange, create }) {
  const { t } = useI18n();
  const [drag, setDrag] = useState(null); // live value while dragging
  const svgRef = useRef(null);
  const value = drag ?? link.value ?? 0;
  const [c1, c2] = link.codes || [];
  const P = (code) => profiles.get(code) || null;
  const missing = (link.codes || []).filter((c) => !profiles.get(c));

  // Scene: x = in the plane of the window (mm), y = depth (mm)
  const pA = P(c1);
  const depth = Math.max(pA?.lp || 60, P(c2)?.lp || 0, 40);
  const fin = Math.max(2, depth * 0.12);
  const scene = sceneFor(link.kind, { value, jd, A: pA, B: P(c2) });
  const minX = Math.min(...scene.xs) - 25;
  const maxX = Math.max(...scene.xs) + 25;
  const vb = [minX, -30, maxX - minX, depth + 70];
  // text / strokes scaled to the drawing so they read the same in every card
  const k = Math.max(maxX - minX, depth + 70) / 260;

  const toMm = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  };
  const onDown = (e) => {
    if (!scene.drag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = toMm(e);
    const startValue = value;
    const move = (ev) => setDrag(Math.max(-500, r05(startValue + scene.drag * (toMm(ev) - start))));
    const up = (ev) => {
      ev.currentTarget.removeEventListener("pointermove", move);
      ev.currentTarget.removeEventListener("pointerup", up);
      const final = r05(startValue + scene.drag * (toMm(ev) - start));
      setDrag(null);
      if (final !== startValue) onChange(String(final));
    };
    e.currentTarget.addEventListener("pointermove", move);
    e.currentTarget.addEventListener("pointerup", up);
  };

  const profile = (p, x0, dir, cls, y0 = 0, key = "") => {
    if (!p) return null;
    const ae = p.ae || 0; const ch = p.ch || 0; const ai = p.ai || 0; const lp = p.lp || depth;
    const seg = (a, len, y, h, c) => (len > 0 ? <rect key={`${key}${c}${a}`} x={dir > 0 ? a : a - len} y={y} width={len} height={h} className={cls} strokeWidth={k * 0.8} /> : null);
    return [
      seg(x0, ae, y0, fin, "ae"),
      seg(x0 + dir * ae, ch, y0, lp, "ch"),
      seg(x0 + dir * (ae + ch), ai, y0 + lp - fin, fin, "ai"),
    ];
  };

  return (
    <div className={st.sectionCard}>
      <div className={st.sectionHead}>
        <strong>{link.label}</strong>
        <span className={st.sectionValue}>{fmt(value)} mm</span>
      </div>
      <div className={st.estimateRow}>
        <span className={st.estimateBadge}>estimation</span>
        {create && <Link to={create} className={st.nodeLink}>Définir le nœud sur les DXF →</Link>}
      </div>
      {missing.length > 0 && <p className={st.warn}>{t("cad.codeMissing").replace("{codes}", missing.join(", "))}</p>}
      {scene.parts && (
        <svg ref={svgRef} className={st.sectionSvg} viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid meet">
          {scene.wall && <rect x={minX} y={-10} width={-minX} height={depth + 20} className={st.wall} />}
          {scene.parts.map((part, i) => {
            if (part.t === "profile") {
              const g = profile(P(part.code), part.x, part.dir, part.moving ? st.secMoving : st.secProfile, 0, `p${i}`);
              return part.moving ? <g key={i} className={st.draggable} onPointerDown={onDown}>{g}</g> : <g key={i}>{g}</g>;
            }
            if (part.t === "glass") {
              const gx = part.dir > 0 ? part.x : part.x - 60;
              return <rect key={i} x={gx} y={depth * 0.3} width={60} height={depth * 0.4} className={`${st.secGlass} ${part.moving ? st.draggable : ""}`} onPointerDown={part.moving ? onDown : undefined} />;
            }
            if (part.t === "line") {
              return <line key={i} x1={part.x} y1={-18} x2={part.x} y2={depth + 18} className={part.moving ? `${st.secMarker} ${st.draggable}` : st.secRef} strokeWidth={k * (part.moving ? 3 : 1.2)} strokeDasharray={part.moving ? undefined : `${6 * k} ${4 * k}`} onPointerDown={part.moving ? onDown : undefined} />;
            }
            return null;
          })}
          {/* the measured dimension */}
          {scene.dim && (
            <g className={st.secDim}>
              <line x1={scene.dim[0]} y1={depth + 32} x2={scene.dim[1]} y2={depth + 32} strokeWidth={k * 1.2} />
              <line x1={scene.dim[0]} y1={depth + 24} x2={scene.dim[0]} y2={depth + 40} strokeWidth={k * 1.2} />
              <line x1={scene.dim[1]} y1={depth + 24} x2={scene.dim[1]} y2={depth + 40} strokeWidth={k * 1.2} />
              <text x={(scene.dim[0] + scene.dim[1]) / 2} y={depth + 30 - 3 * k} fontSize={11 * k} textAnchor="middle">{fmt(value)}</text>
            </g>
          )}
          {scene.labels?.map((lb, i) => <text key={`l${i}`} x={lb.x} y={-14} fontSize={9 * k} textAnchor="middle" className={st.secLabel}>{lb.text}</text>)}
        </svg>
      )}
      <div className={st.sectionFoot}>
        <span className={st.muted}>{t("cad.defaultFormula")} <code>{link.formula}</code></span>
        <label className={st.overrideField}>
          {t("cad.override")}
          <input defaultValue={override} key={override} placeholder={t("cad.auto")} onBlur={(e) => { if (e.target.value !== override) onChange(e.target.value.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        </label>
        {override && <button type="button" className="tableActionBtn" title={t("cad.reset")} onClick={() => onChange("")}><RotateCcw size={13} /></button>}
      </div>
    </div>
  );
}

/**
 * Where everything sits for one liaison. drag = +1 if dragging to the
 * right increases the value, -1 if it decreases it.
 */
function sceneFor(kind, { value, jd, A, B }) {
  const hp = (p) => (p ? (p.ae || 0) + (p.ch || 0) + (p.ai || 0) : 0);
  switch (kind) {
    case "frameClear": // cote (wall edge) at 0, jour face dragged
      return { wall: true, drag: 1, xs: [-(A?.ae || 0), value, hp(A)], dim: [0, value], parts: [
        { t: "profile", code: A?.code, x: -(A?.ae || 0), dir: 1 }, { t: "line", x: 0 }, { t: "line", x: value, moving: true },
      ], labels: [{ x: 0, text: "cote" }, { x: value, text: "jour" }] };
    case "splitClear": // axis at 0, jour face dragged
      return { drag: 1, xs: [-hp(A) / 2, value, hp(A) / 2], dim: [0, value], parts: [
        { t: "profile", code: A?.code, x: -hp(A) / 2, dir: 1 }, { t: "line", x: 0 }, { t: "line", x: value, moving: true },
      ], labels: [{ x: 0, text: "axe" }, { x: value, text: "jour" }] };
    case "fixedBite": // frame + jour, glass edge dragged (bite = jour − glass edge)
      return { wall: true, drag: -1, xs: [-(A?.ae || 0), jd - value, jd - value + 60], dim: [jd - value, jd], parts: [
        { t: "profile", code: A?.code, x: -(A?.ae || 0), dir: 1 }, { t: "line", x: jd }, { t: "glass", x: jd - value, dir: 1, moving: true },
      ], labels: [{ x: jd, text: "jour" }] };
    case "sashOverlap": // frame + jour, sash outer edge dragged (overlap = jour − sash edge)
      return { wall: true, drag: -1, xs: [-(A?.ae || 0), jd - value, jd - value + hp(B || A), jd + 20], dim: [jd - value, jd], parts: [
        { t: "profile", code: B?.code, x: -(B?.ae || 0), dir: 1 }, { t: "line", x: jd },
        { t: "profile", code: A?.code, x: jd - value, dir: 1, moving: true },
      ], labels: [{ x: jd, text: "jour" }] };
    case "sashGlass": // sash outer edge at 0, glass edge dragged
      return { drag: 1, xs: [0, value + 60, hp(A) + 20], dim: [0, value], parts: [
        { t: "profile", code: A?.code, x: 0, dir: 1 }, { t: "glass", x: value, dir: 1, moving: true },
      ], labels: [{ x: 0, text: "bord ouvrant" }] };
    case "sashClear": // sash outer edge at 0, its jour dragged
      return { drag: 1, xs: [0, value, hp(A) + 20], dim: [0, value], parts: [
        { t: "profile", code: A?.code, x: 0, dir: 1 }, { t: "line", x: value, moving: true },
      ], labels: [{ x: 0, text: "bord ouvrant" }, { x: value, text: "jour" }] };
    case "meeting": // leaf A ends at 0, leaf B starts at −value
      return { drag: -1, xs: [-hp(A) - value, hp(A) + 10, -value], dim: [-value, 0], parts: [
        { t: "profile", code: A?.code, x: 0, dir: -1 }, { t: "profile", code: A?.code, x: -value, dir: 1, moving: true },
      ], labels: [] };
    default:
      return { xs: [0, 100], parts: null };
  }
}
