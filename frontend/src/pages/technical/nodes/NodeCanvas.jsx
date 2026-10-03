import { useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import useWorldView from "../../../components/dxf/useWorldView";
import { sectionPathData, sectionVertices, pointIndex, axisValues, fmtMm } from "../../../components/dxf/geometry";
import { DimH, RefLine } from "../../../components/dxf/Dims";
import { NODE_TYPES, VALUE_LABELS, REF_LABELS, elementsOf, sceneBounds, dimsOf } from "./nodeGeometry";
import css from "../../../components/dxf/Dxf.module.css";

const pathCache = new WeakMap();
const pathOf = (section) => {
  if (!section) return null;
  if (!pathCache.has(section)) pathCache.set(section, sectionPathData(section));
  return pathCache.get(section);
};
const localVerts = (e) => {
  if (e.glass) return [[0, 0], [0, e.t], [e.w, 0], [e.w, e.t], [0, e.t / 2]];
  return sectionVertices(e.section, 1500);
};
const worldOf = (e, pl = e.pl) => localVerts(e).map(([x, y]) => [(pl.flipX ? -x : x) + (pl.x || 0), y + (pl.y || 0)]);

/**
 * The section of a node: the real DXF of each profile placed against the
 * others, the glass, the reference lines and the measured dimensions.
 * With onChange: drag the elements / lines with the mouse — they SNAP on
 * the vertices of the other profiles (corner to corner, or aligned on X / Y).
 */
export default function NodeCanvas({ type, sections, placements, onChange, glassThickness = 24, selected, onSelect, height = 460, compact = false }) {
  const svgRef = useRef(null);
  const def = NODE_TYPES[type];
  const pl = placements || {};
  const elements = useMemo(() => elementsOf(type, pl, sections, glassThickness), [type, pl, sections, glassThickness]);
  const bounds = useMemo(() => sceneBounds(elements, pl), [elements]); // eslint-disable-line react-hooks/exhaustive-deps
  // room above for the dimension rows, below for the reference labels
  const viewBounds = useMemo(() => {
    const h = Math.max(20, bounds.y1 - bounds.y0);
    return { ...bounds, y1: bounds.y1 + h * (compact ? 0.42 : 0.55), y0: bounds.y0 - h * 0.14 };
  }, [bounds, compact]);
  // while editing, the view does not jump as things move (re-fitted when the profiles change)
  const frozenBounds = useRef(null);
  const frozenKey = useRef("");
  const secKey = [sections.main, sections.second, sections.bead].map((x) => x?.metrics?.width ?? "-").join("|") + type;
  if (!frozenBounds.current || !onChange || frozenKey.current !== secKey) { frozenBounds.current = viewBounds; frozenKey.current = secKey; }
  const v = useWorldView(svgRef, onChange ? frozenBounds.current : viewBounds, { margin: compact ? 0.04 : 0.12, interactive: !compact });
  const paths = new Map(elements.filter((e) => e.section).map((e) => [e.key, pathOf(e.section)]));
  const drag = useRef(null);
  const [snapAt, setSnapAt] = useState(null);
  const px = v.px;
  const top = bounds.y1;
  const tol = 9 * px;

  const begin = (e, key) => {
    if (!onChange) return;
    e.stopPropagation();
    onSelect?.(key);
    const isRef = ["cote", "jour", "axis"].includes(key);
    const others = elements.filter((x) => x.key !== key);
    const fixedPts = others.flatMap((x) => worldOf(x));
    drag.current = {
      key, isRef, start: v.toWorld(e), startPl: JSON.parse(JSON.stringify(pl)),
      index: pointIndex(fixedPts, 2), xs: axisValues(fixedPts, 0), ys: axisValues(fixedPts, 1),
      el: elements.find((x) => x.key === key),
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) { v.movePan(e); return; }
    const [wx, wy] = v.toWorld(e);
    const dx = wx - d.start[0];
    const dy = wy - d.start[1];
    if (d.isRef) {
      let x = d.startPl[d.key] + dx;
      const s = e.altKey ? null : d.xs.nearest(x, tol);
      if (s !== null) x = s;
      setSnapAt(s !== null ? [x, null] : null);
      onChange({ ...pl, [d.key]: Math.round(x * 100) / 100 });
      return;
    }
    const base = d.startPl[d.key] || { x: 0, y: 0 };
    let nx = (base.x || 0) + dx;
    let ny = (base.y || 0) + dy;
    let mark = null;
    if (!e.altKey) {
      // 1) corner on corner
      const pts = worldOf(d.el, { ...d.el.pl, x: nx, y: ny });
      let best = null;
      for (const p of pts) {
        const hit = d.index.nearest(p[0], p[1], tol);
        if (hit && (!best || hit.d < best.d)) best = { d: hit.d, ox: hit.p[0] - p[0], oy: hit.p[1] - p[1], at: hit.p };
      }
      if (best) { nx += best.ox; ny += best.oy; mark = best.at; } else {
        // 2) aligned on X and / or Y with a vertex of the others
        let bx = null; let by = null;
        for (const p of pts) {
          const sx = d.xs.nearest(p[0], tol);
          if (sx !== null && (bx === null || Math.abs(sx - p[0]) < Math.abs(bx))) bx = sx - p[0];
          const sy = d.ys.nearest(p[1], tol);
          if (sy !== null && (by === null || Math.abs(sy - p[1]) < Math.abs(by))) by = sy - p[1];
        }
        if (bx !== null) nx += bx;
        if (by !== null) ny += by;
      }
    }
    setSnapAt(mark);
    onChange({ ...pl, [d.key]: { ...base, x: Math.round(nx * 100) / 100, y: Math.round(ny * 100) / 100 } });
  };
  const onUp = () => { drag.current = null; v.endPan(); setSnapAt(null); };

  const cls = (e) => (e.kind === "fixed" ? css.fixed : e.kind === "bead" ? css.bead : e.kind === "glass" ? css.glass : selected === e.key ? css.movingSel : css.moving);
  const dims = dimsOf(type, pl, sections);

  return (
    <div className={css.canvasWrap} style={{ height }}>
      {!compact && <div className={css.tools}><button type="button" onClick={v.fit} title="Ajuster"><Maximize2 size={13} /></button></div>}
      <svg ref={svgRef} className={css.svg} viewBox={v.viewBox} preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => { if (!compact) { onSelect?.(null); v.startPan(e); } }} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ cursor: compact ? "default" : "grab" }}>
        <g transform="scale(1,-1)">
          {elements.map((e) => (
            e.glass ? (
              <rect key={e.key} x={e.pl.x} y={e.pl.y} width={e.w} height={e.t} className={cls(e)} strokeWidth={1.2 * px}
                onPointerDown={e.draggable && onChange ? (ev) => begin(ev, e.key) : undefined} />
            ) : (
              <g key={e.key} transform={`translate(${e.pl.x || 0} ${e.pl.y || 0}) scale(${e.pl.flipX ? -1 : 1} 1)`}
                onPointerDown={e.draggable && onChange ? (ev) => begin(ev, e.key) : undefined}>
                <path d={paths.get(e.key)?.closed} fillRule="evenodd" className={cls(e)} strokeWidth={1 * px} />
                {paths.get(e.key)?.open && <path d={paths.get(e.key).open} fill="none" className={css.open} strokeWidth={1 * px} />}
              </g>
            )
          ))}
        </g>
        {/* reference lines */}
        {(def?.refs || []).map((k) => Number.isFinite(pl[k]) && (
          <RefLine key={k} x={pl[k]} y0={bounds.y0 - 6 * px} y1={top + 6 * px} px={px} label={REF_LABELS[k]} active={selected === k}
            onPointerDown={onChange ? (ev) => begin(ev, k) : undefined} />
        ))}
        {/* measured dimensions, stacked above the drawing */}
        {dims.map((d, i) => (
          <DimH key={d.key} x1={d.x1} x2={d.x2} y={top + (compact ? 12 + i * 18 : 26 + i * 26) * px} px={px} strong
            label={compact ? fmtMm(d.value) : `${VALUE_LABELS[d.key]} : ${fmtMm(d.value)}`} />
        ))}
        {snapAt && <circle cx={snapAt[0]} cy={snapAt[1] === null ? -top : -snapAt[1]} r={5 * px} className={css.snapDot} strokeWidth={2 * px} pointerEvents="none" />}
      </svg>
    </div>
  );
}
