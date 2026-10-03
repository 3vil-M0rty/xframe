import { useMemo } from "react";
import st from "./Designer.module.css";

const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (v) => (Number.isInteger(r1(v)) ? String(r1(v)) : r1(v).toFixed(1)).replace(".", ",");

/**
 * Vue de face of the CAD: the regions computed by the server (mm, y down)
 * drawn to scale, with the dimension lines (cotes) and click-to-select.
 *   layout: [{ id, node, type: frame|jour|mullion|transom|cell|leaf|glass|panel, x, y, w, h, code, opening, slide }]
 */
export default function Elevation({ layout = [], L, H, selected, onSelect, codesMissing = [] }) {
  const frame = layout.find((r) => r.type === "frame");
  const jour = layout.find((r) => r.type === "jour");
  const geo = useMemo(() => {
    if (!frame) return null;
    const size = Math.max(frame.w, frame.h, 400);
    const M = size * 0.17;
    return { size, M, k: size / 700, vb: [frame.x - M, frame.y - M * 0.9, frame.w + 2 * M, frame.h + 1.9 * M] };
  }, [frame]);
  if (!frame || !geo) return <div className={st.empty}>—</div>;
  const { k, M } = geo;
  const cells = layout.filter((r) => r.type === "cell");
  const isSel = (r) => selected && (r.node === selected);
  const click = (id) => (e) => { e.stopPropagation(); onSelect?.(id); };

  // dimension line (horizontal or vertical) with end ticks and the value
  const dimH = (x1, x2, y, key, strong) => (
    <g key={key} className={strong ? st.dimStrong : st.dim}>
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={k * 1.1} />
      <line x1={x1} y1={y - 9 * k} x2={x1} y2={y + 9 * k} strokeWidth={k * 1.1} />
      <line x1={x2} y1={y - 9 * k} x2={x2} y2={y + 9 * k} strokeWidth={k * 1.1} />
      <text x={(x1 + x2) / 2} y={y - 6 * k} fontSize={14 * k} textAnchor="middle">{fmt(x2 - x1)}</text>
    </g>
  );
  const dimV = (y1, y2, x, key, strong) => (
    <g key={key} className={strong ? st.dimStrong : st.dim}>
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={k * 1.1} />
      <line x1={x - 9 * k} y1={y1} x2={x + 9 * k} y2={y1} strokeWidth={k * 1.1} />
      <line x1={x - 9 * k} y1={y2} x2={x + 9 * k} y2={y2} strokeWidth={k * 1.1} />
      <text x={x - 6 * k} y={(y1 + y2) / 2} fontSize={14 * k} textAnchor="middle" transform={`rotate(-90 ${x - 6 * k} ${(y1 + y2) / 2})`}>{fmt(y2 - y1)}</text>
    </g>
  );
  // chains: widths of the cells along the bottom of the opening, heights along its right side
  const eps = 1;
  const bottom = jour ? [...new Map(cells.filter((c) => Math.abs(c.y + c.h - (jour.y + jour.h)) < eps).map((c) => [`${c.x}|${c.w}`, c])).values()].sort((a, b) => a.x - b.x) : [];
  const right = jour ? [...new Map(cells.filter((c) => Math.abs(c.x + c.w - (jour.x + jour.w)) < eps).map((c) => [`${c.y}|${c.h}`, c])).values()].sort((a, b) => a.y - b.y) : [];
  const yb = frame.y + frame.h + M * 0.35;
  const xr = frame.x + frame.w + M * 0.35;

  const leafSymbol = (r) => {
    const l = r.x; const t = r.y; const rr = r.x + r.w; const b = r.y + r.h; const cx = (l + rr) / 2; const cy = (t + b) / 2;
    const o = String(r.opening || "");
    const lines = [];
    if (r.slide) {
      const a = Math.min(r.w * 0.2, 120);
      lines.push([cx - a, cy, cx + a, cy], [cx + a, cy, cx + a - 30 * k, cy - 18 * k], [cx + a, cy, cx + a - 30 * k, cy + 18 * k]);
    } else {
      if (o.endsWith("left") || o.endsWith("right")) {
        const hinge = o.endsWith("left") ? l : rr;
        const free = o.endsWith("left") ? rr : l;
        lines.push([free, t, hinge, cy], [free, b, hinge, cy]);
      }
      if (o.startsWith("tilt") || o === "bottom") lines.push([l, t, cx, b], [rr, t, cx, b]);
      if (o === "top") lines.push([l, b, cx, t], [rr, b, cx, t]);
    }
    return lines.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={st.opening} strokeWidth={k * 1.4} strokeDasharray={`${10 * k} ${6 * k}`} />);
  };

  return (
    <svg className={st.canvas} viewBox={geo.vb.join(" ")} preserveAspectRatio="xMidYMid meet" onClick={() => onSelect?.(null)} role="img" aria-label="Vue de face">
      {/* frame (dormant) */}
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} className={`${st.profile} ${selected === "frame" ? st.sel : ""}`} strokeWidth={k * 1.6} onClick={click("frame")} />
      {jour && <rect x={jour.x} y={jour.y} width={jour.w} height={jour.h} className={st.jour} strokeWidth={k} pointerEvents="none" />}
      {/* cells (clickable background) */}
      {cells.map((c) => <rect key={c.id} x={c.x} y={c.y} width={c.w} height={c.h} className={`${st.cell} ${isSel(c) ? st.cellSel : ""}`} onClick={click(c.node)} />)}
      {/* fixed infill (glass / panels that are not in a leaf) and leaves */}
      {layout.filter((r) => (r.type === "glass" || r.type === "panel") && !r.id.includes("_l")).map((g) => (
        <rect key={g.id} x={g.x} y={g.y} width={g.w} height={g.h} className={g.type === "glass" ? st.glass : st.panel} strokeWidth={k * 0.8} onClick={click(g.node)} />
      ))}
      {layout.filter((r) => r.type === "leaf").map((r) => (
        <g key={r.id} onClick={click(r.node)}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} className={`${st.leaf} ${isSel(r) ? st.sel : ""}`} strokeWidth={k * 1.4} />
          {layout.filter((g) => (g.type === "glass" || g.type === "panel") && g.id.startsWith(`${r.id}_`)).map((g) => (
            <rect key={g.id} x={g.x} y={g.y} width={g.w} height={g.h} className={g.type === "glass" ? st.glass : st.panel} strokeWidth={k * 0.8} />
          ))}
          {leafSymbol(r)}
        </g>
      ))}
      {/* meneaux / traverses */}
      {layout.filter((r) => r.type === "mullion" || r.type === "transom").map((m) => (
        <rect key={m.id} x={m.x} y={m.y} width={m.w} height={m.h} className={`${st.profile} ${isSel(m) ? st.sel : ""}`} strokeWidth={k * 1.2} onClick={click(m.node)} />
      ))}
      {/* cell numbers (Case 1, 2… as in the labels and the débit) */}
      {cells.map((c) => <text key={`n${c.id}`} x={c.x + 14 * k} y={c.y + 24 * k} fontSize={15 * k} className={st.cellNo} pointerEvents="none">{c.no}</text>)}
      {/* glass sizes */}
      {layout.filter((r) => r.type === "glass" || r.type === "panel").map((g) => (
        <text key={`t${g.id}`} x={g.x + g.w / 2} y={g.y + g.h / 2} fontSize={13 * k} textAnchor="middle" className={st.label} pointerEvents="none">{fmt(g.w)} × {fmt(g.h)}</text>
      ))}
      {/* profile codes */}
      <text x={frame.x + frame.w / 2} y={frame.y + 26 * k} fontSize={12 * k} textAnchor="middle" className={`${st.code} ${codesMissing.includes(frame.code) ? st.codeMissing : ""}`} pointerEvents="none">{frame.code}</text>
      {layout.filter((r) => r.type === "mullion" || r.type === "transom").map((m) => (
        <text key={`c${m.id}`} x={m.x + m.w / 2} y={m.y + m.h / 2} fontSize={11 * k} textAnchor="middle" className={`${st.code} ${codesMissing.includes(m.code) ? st.codeMissing : ""}`} pointerEvents="none"
          transform={m.type === "mullion" ? `rotate(-90 ${m.x + m.w / 2} ${m.y + m.h / 2})` : undefined}>{m.code}</text>
      ))}
      {/* cotes: ordered size (cote tableau) and the chains */}
      {dimH(0, L, frame.y - M * 0.42, "L", true)}
      {dimV(0, H, frame.x - M * 0.42, "H", true)}
      {bottom.length > 1 && bottom.map((c, i) => dimH(c.x, c.x + c.w, yb, `b${i}`))}
      {right.length > 1 && right.map((c, i) => dimV(c.y, c.y + c.h, xr, `r${i}`))}
    </svg>
  );
}
