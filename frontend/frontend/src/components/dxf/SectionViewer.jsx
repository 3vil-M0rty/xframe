import { useMemo, useRef, useState } from "react";
import { Maximize2, Ruler, X } from "lucide-react";
import useWorldView from "./useWorldView";
import { sectionPathData, sectionVertices, pointIndex, fmtMm } from "./geometry";
import { DimH, DimV } from "./Dims";
import css from "./Dxf.module.css";

/**
 * A profile section (DXF) drawn to scale with its overall dimensions —
 * zoom (wheel), pan (drag), fit, and a MEASURE tool snapping on the
 * vertices: click two points → distance, ΔX (in-plane), ΔY (depth).
 *   mini  thumbnail: no tools, no dimensions
 */
export default function SectionViewer({ section, height = 300, mini = false, dims = true, title, extra }) {
  const svgRef = useRef(null);
  const m = section?.metrics;
  const bounds = useMemo(() => (m ? { x0: 0, y0: 0, x1: m.width, y1: m.height } : { x0: 0, y0: 0, x1: 100, y1: 60 }), [m]);
  const v = useWorldView(svgRef, bounds, { margin: mini ? 0.06 : 0.22, interactive: !mini });
  const path = useMemo(() => sectionPathData(section), [section]);
  const index = useMemo(() => (mini ? null : pointIndex(sectionVertices(section), 2)), [section, mini]);
  const [measure, setMeasure] = useState(false);
  const [pts, setPts] = useState([]);
  const [hover, setHover] = useState(null);
  const moved = useRef(false);

  if (!section) return <div className={css.empty} style={{ height }}>{title || "—"}</div>;
  const snap = (e) => {
    const [x, y] = v.toWorld(e);
    const hit = index?.nearest(x, y, 12 * v.px);
    return hit ? hit.p : [x, y];
  };
  const onDown = (e) => { moved.current = false; if (!mini) v.startPan(e); };
  const onMove = (e) => {
    if (v.movePan(e)) { moved.current = true; return; }
    if (measure) setHover(snap(e));
  };
  const onUp = (e) => {
    v.endPan();
    if (!measure || moved.current) return;
    const p = snap(e);
    setPts((list) => (list.length >= 2 ? [p] : [...list, p]));
  };
  const px = v.px;
  const [a, b] = pts.length === 2 ? pts : pts.length === 1 && hover ? [pts[0], hover] : [null, null];

  return (
    <div className={`${css.viewer} ${mini ? css.mini : ""}`} style={{ height }}>
      {!mini && (
        <div className={css.tools}>
          {title && <span className={css.title}>{title}</span>}
          <button type="button" className={measure ? css.toolOn : ""} onClick={() => { setMeasure(!measure); setPts([]); }} title="Mesurer (cliquez deux points)"><Ruler size={13} /> Mesurer</button>
          {pts.length > 0 && <button type="button" onClick={() => setPts([])} title="Effacer la mesure"><X size={13} /></button>}
          <button type="button" onClick={v.fit} title="Ajuster"><Maximize2 size={13} /></button>
          {extra}
        </div>
      )}
      <svg ref={svgRef} className={css.svg} viewBox={v.viewBox} preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setHover(null)}
        style={{ cursor: measure ? "crosshair" : mini ? "default" : "grab" }}>
        <g transform="scale(1,-1)">
          <path d={path.closed} className={css.matter} fillRule="evenodd" strokeWidth={mini ? 0.6 * px : 1 * px} />
          {path.open && <path d={path.open} className={css.open} strokeWidth={1 * px} fill="none" />}
        </g>
        {!mini && dims && m && (
          <>
            <DimH x1={0} x2={m.width} y={-14 * px} px={px} below />
            <DimV y1={0} y2={m.height} x={m.width + 14 * px} px={px} />
          </>
        )}
        {a && b && (
          <g pointerEvents="none">
            <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} stroke="var(--dxf-measure)" strokeWidth={1.6 * px} />
            {[a, b].map((p, i) => <circle key={i} cx={p[0]} cy={-p[1]} r={3.5 * px} fill="var(--dxf-measure)" />)}
            <text x={(a[0] + b[0]) / 2} y={-(a[1] + b[1]) / 2 - 8 * px} fontSize={12 * px} fill="var(--dxf-measure)" fontWeight={800} textAnchor="middle" paintOrder="stroke" stroke="var(--dxf-bg)" strokeWidth={3 * px}>
              {fmtMm(Math.hypot(b[0] - a[0], b[1] - a[1]), 2)} mm  (ΔX {fmtMm(Math.abs(b[0] - a[0]), 2)} · ΔY {fmtMm(Math.abs(b[1] - a[1]), 2)})
            </text>
          </g>
        )}
        {measure && hover && pts.length < 2 && <circle cx={hover[0]} cy={-hover[1]} r={4 * px} fill="none" stroke="var(--dxf-measure)" strokeWidth={1.4 * px} pointerEvents="none" />}
      </svg>
    </div>
  );
}
