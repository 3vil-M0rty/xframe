import { useMemo, useRef, useState } from "react";
import { partExtents } from "./designTree";
import { dragging } from "./Palette";
import st from "./Designer.module.css";

const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (v) => (Number.isInteger(r1(v)) ? String(r1(v)) : r1(v).toFixed(1)).replace(".", ",");
const ITEM_LABEL = (it) => ({ mullion: "Meneau", transom: "Traverse", sash: "Ouvrant", fixed: "Fixe", infill: it.infill === "panel" ? "Panneau" : it.infill === "none" ? "Vide" : "Vitrage" }[it.t] || "");

/**
 * The DRAWING (vue de face), to scale, editable with the mouse:
 *  - drop palette items on a case (meneau / traverse where you drop it,
 *    ouvrant, fixe, remplissage), or click an item then a case;
 *  - drag a meneau / traverse to move it, drag the frame's edges to resize;
 *  - click a dimension to type it; click an element to select it.
 * layout = regions computed by the server (mm, y down).
 */
export default function DrawingCanvas({ layout = [], design, L, H, selected, onSelect, armed, onPlaced, onDropItem, onDropDivider, onMoveDivider, onResize, onSetPart }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { cell, pt, item }
  const [drag, setDrag] = useState(null); // divider / frame drag in progress
  const [edit, setEdit] = useState(null); // dimension being typed
  const frame = layout.find((r) => r.type === "frame");
  const jour = layout.find((r) => r.type === "jour");
  const cells = layout.filter((r) => r.type === "cell");
  const extents = useMemo(() => partExtents(design, layout), [design, layout]);
  const frozen = useRef(null);
  const geo = useMemo(() => {
    if (!frame) return null;
    const size = Math.max(frame.w, frame.h, 400);
    const M = size * 0.17;
    return { k: size / 700, M, vb: [frame.x - M, frame.y - M * 0.95, frame.w + 2 * M, frame.h + 1.95 * M] };
  }, [frame]);
  if (!frame || !geo) return <div className={st.empty}>…</div>;
  const g = drag && frozen.current ? frozen.current : geo;
  if (!drag) frozen.current = geo;
  const { k, M } = g;

  const toMm = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  };
  const toScreen = (x, y) => {
    const m = svgRef.current.getScreenCTM();
    const box = wrapRef.current.getBoundingClientRect();
    return [m.a * x + m.e - box.left, m.d * y + m.f - box.top];
  };
  const cellAt = ([x, y]) => cells.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) || null;
  const item = dragging.current || armed;

  // ---------- palette drop ----------
  const onDragOver = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const pt = toMm(e);
    setHover({ cell: cellAt(pt), pt, item: dragging.current });
  };
  const apply = (it, pt) => {
    const c = cellAt(pt);
    if (!c || !it) return false;
    if (it.t === "mullion" || it.t === "transom") {
      const v = it.t === "mullion";
      onDropDivider(c.node, v ? "v" : "h", v ? pt[0] - c.x : pt[1] - c.y, v ? c.w : c.h);
    } else onDropItem(c.node, it);
    return true;
  };
  const onDrop = (e) => {
    e.preventDefault();
    const it = dragging.current;
    dragging.current = null;
    setHover(null);
    apply(it, toMm(e));
  };

  // ---------- dragging dividers and frame edges ----------
  const startDivider = (e, r) => {
    e.stopPropagation();
    const [splitId, idx] = [r.node, Number(String(r.id).split("_m").pop())];
    const v = r.type === "mullion";
    const parts = (extents.get(splitId) || []).map((p) => (p ? (v ? p.x1 - p.x0 : p.y1 - p.y0) : 0));
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kind: "divider", r, splitId, idx, v, start: toMm(e), cur: toMm(e), parts });
  };
  const startFrame = (e, kind) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kind, start: toMm(e), cur: toMm(e) });
  };
  const onMove = (e) => {
    if (drag) { setDrag({ ...drag, cur: toMm(e) }); return; }
    if (armed) setHover({ cell: cellAt(toMm(e)), pt: toMm(e), item: armed });
  };
  const delta = drag ? (drag.kind === "divider" ? (drag.v ? drag.cur[0] - drag.start[0] : drag.cur[1] - drag.start[1]) : 0) : 0;
  const frameD = drag && drag.kind !== "divider" ? { dx: drag.kind !== "frameH" ? drag.cur[0] - drag.start[0] : 0, dy: drag.kind !== "frameW" ? drag.cur[1] - drag.start[1] : 0 } : { dx: 0, dy: 0 };
  const onUp = (e) => {
    if (drag) {
      const moved = Math.abs(delta) > 1.5 || Math.abs(frameD.dx) > 1.5 || Math.abs(frameD.dy) > 1.5;
      if (drag.kind === "divider") {
        if (moved) onMoveDivider(drag.splitId, drag.idx, Math.round(delta), drag.parts);
        else onSelect(drag.splitId);
      } else if (moved) onResize({ L: Math.max(300, Math.round(L + frameD.dx)), H: Math.max(300, Math.round(H + frameD.dy)) });
      setDrag(null);
      return;
    }
    if (armed && apply(armed, toMm(e))) { setHover(null); if (!e.shiftKey) onPlaced?.(); } // Shift: keep placing
  };

  // ---------- dimensions ----------
  const openEdit = (e, d) => {
    e.stopPropagation();
    const [sx, sy] = toScreen(d.x, d.y);
    setEdit({ ...d, sx, sy, value: String(Math.round(d.value)) });
  };
  const commit = () => {
    if (!edit) return;
    const v = Math.round(Number(String(edit.value).replace(",", ".")));
    if (Number.isFinite(v) && v > 0 && v !== Math.round(edit.value0)) {
      if (edit.kind === "L") onResize({ L: v, H });
      else if (edit.kind === "H") onResize({ L, H: v });
      else onSetPart(edit.splitId, edit.index, v, edit.parts);
    }
    setEdit(null);
  };
  /** The split part a drawn cell width / height belongs to (for typed chain dimensions). */
  const partOf = (c, dir) => {
    for (const [splitId, parts] of extents) {
      const node = findSplitDir(design.root, splitId);
      if (node !== dir) continue;
      const i = parts.findIndex((p) => p && (dir === "v" ? Math.abs(p.x0 - c.x) < 1 && Math.abs(p.x1 - (c.x + c.w)) < 1 : Math.abs(p.y0 - c.y) < 1 && Math.abs(p.y1 - (c.y + c.h)) < 1));
      if (i >= 0) return { splitId, index: i, parts: parts.map((p) => (p ? (dir === "v" ? p.x1 - p.x0 : p.y1 - p.y0) : 0)) };
    }
    return null;
  };

  const dimH = (x1, x2, y, key, opts = {}) => (
    <g key={key} className={`${opts.strong ? st.dimStrong : st.dim} ${opts.edit ? st.dimEditable : ""}`} onPointerUp={opts.edit ? (e) => e.stopPropagation() : undefined} onClick={opts.edit ? (e) => openEdit(e, { ...opts.edit, x: (x1 + x2) / 2, y, value: x2 - x1, value0: x2 - x1 }) : undefined}>
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={k * 1.1} />
      <line x1={x1} y1={y - 9 * k} x2={x1} y2={y + 9 * k} strokeWidth={k * 1.1} />
      <line x1={x2} y1={y - 9 * k} x2={x2} y2={y + 9 * k} strokeWidth={k * 1.1} />
      {opts.edit && <rect x={(x1 + x2) / 2 - 40 * k} y={y - 24 * k} width={80 * k} height={20 * k} fill="transparent" />}
      <text x={(x1 + x2) / 2} y={y - 7 * k} fontSize={(opts.strong ? 16 : 14) * k} textAnchor="middle">{fmt(x2 - x1)}</text>
    </g>
  );
  const dimV = (y1, y2, x, key, opts = {}) => (
    <g key={key} className={`${opts.strong ? st.dimStrong : st.dim} ${opts.edit ? st.dimEditable : ""}`} onPointerUp={opts.edit ? (e) => e.stopPropagation() : undefined} onClick={opts.edit ? (e) => openEdit(e, { ...opts.edit, x, y: (y1 + y2) / 2, value: y2 - y1, value0: y2 - y1 }) : undefined}>
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={k * 1.1} />
      <line x1={x - 9 * k} y1={y1} x2={x + 9 * k} y2={y1} strokeWidth={k * 1.1} />
      <line x1={x - 9 * k} y1={y2} x2={x + 9 * k} y2={y2} strokeWidth={k * 1.1} />
      {opts.edit && <rect x={x - 24 * k} y={(y1 + y2) / 2 - 40 * k} width={20 * k} height={80 * k} fill="transparent" />}
      <text x={x - 7 * k} y={(y1 + y2) / 2} fontSize={(opts.strong ? 16 : 14) * k} textAnchor="middle" transform={`rotate(-90 ${x - 7 * k} ${(y1 + y2) / 2})`}>{fmt(y2 - y1)}</text>
    </g>
  );

  const leafSymbol = (r) => {
    const l = r.x; const t = r.y; const rr = r.x + r.w; const b = r.y + r.h; const cx = (l + rr) / 2; const cy = (t + b) / 2;
    const o = String(r.opening || "");
    const lines = [];
    if (r.slide) {
      const a = Math.min(r.w * 0.22, 140);
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
    return lines.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={st.opening} strokeWidth={k * 1.5} strokeDasharray={`${12 * k} ${7 * k}`} />);
  };

  const isSel = (r) => selected && r.node === selected;
  const bottom = jour ? [...new Map(cells.filter((c) => Math.abs(c.y + c.h - (jour.y + jour.h)) < 1).map((c) => [`${c.x}|${c.w}`, c])).values()].sort((a, b) => a.x - b.x) : [];
  const right = jour ? [...new Map(cells.filter((c) => Math.abs(c.x + c.w - (jour.x + jour.w)) < 1).map((c) => [`${c.y}|${c.h}`, c])).values()].sort((a, b) => a.y - b.y) : [];
  const yb = frame.y + frame.h + M * 0.36;
  const xr = frame.x + frame.w + M * 0.36;
  const hc = hover?.cell;
  const hi = hover?.item;
  const leaves = layout.filter((r) => r.type === "leaf");
  const inLeaf = (gl) => leaves.some((l) => gl.id.startsWith(`${l.id}_`));

  return (
    <div ref={wrapRef} className={st.canvasWrap} onDragLeave={(e) => { if (e.currentTarget === e.target) setHover(null); }}>
      <svg ref={svgRef} className={st.canvas} viewBox={g.vb.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Vue de face"
        onDragOver={onDragOver} onDrop={onDrop} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (!drag && armed) setHover(null); }}
        onClick={(e) => { if (e.target === svgRef.current) onSelect(null); }}
        style={{ cursor: armed ? "copy" : "default" }}>
        <defs>
          <linearGradient id="cadFrame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--cad-frame-1)" /><stop offset="1" stopColor="var(--cad-frame-2)" />
          </linearGradient>
          <linearGradient id="cadGlass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--cad-glass-1)" /><stop offset="0.55" stopColor="var(--cad-glass-2)" /><stop offset="1" stopColor="var(--cad-glass-1)" />
          </linearGradient>
          <filter id="cadGlow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="0" stdDeviation={6 * k} floodColor="#4c8dff" floodOpacity="0.85" /></filter>
          <pattern id="cadGrid" width={100} height={100} patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--cad-grid)" strokeWidth={k} /></pattern>
        </defs>
        <rect x={g.vb[0]} y={g.vb[1]} width={g.vb[2]} height={g.vb[3]} fill="url(#cadGrid)" pointerEvents="none" />
        {/* frame (dormant) */}
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={2 * k} fill="url(#cadFrame)" className={`${st.frameRect} ${selected === "frame" ? st.selGlow : ""}`} strokeWidth={k * 1.4}
          onClick={(e) => { e.stopPropagation(); onSelect("frame"); }} />
        {jour && <rect x={jour.x} y={jour.y} width={jour.w} height={jour.h} className={st.jour} strokeWidth={k} pointerEvents="none" />}
        {/* infill outside the leaves */}
        {layout.filter((r) => (r.type === "glass" || r.type === "panel") && !inLeaf(r)).map((gl) => (
          <rect key={gl.id} x={gl.x} y={gl.y} width={gl.w} height={gl.h} fill={gl.type === "glass" ? "url(#cadGlass)" : "var(--cad-panel)"} className={st.infillRect} strokeWidth={k * 0.8} pointerEvents="none" />
        ))}
        {/* cases: click / drop targets */}
        {cells.map((c) => (
          <rect key={c.id} x={c.x} y={c.y} width={c.w} height={c.h} className={`${st.cell} ${isSel(c) ? st.cellSel : ""} ${hc?.id === c.id ? st.cellHover : ""}`}
            onClick={(e) => { e.stopPropagation(); if (!armed) onSelect(c.node); }} />
        ))}
        {/* leaves */}
        {leaves.map((r) => (
          <g key={r.id} onClick={(e) => { e.stopPropagation(); if (!armed) onSelect(r.node); }} className={st.leafG}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2 * k} fill="url(#cadFrame)" className={`${st.leafRect} ${isSel(r) ? st.selGlow : ""}`} strokeWidth={k * 1.5} />
            {layout.filter((gl) => (gl.type === "glass" || gl.type === "panel") && gl.id.startsWith(`${r.id}_`)).map((gl) => (
              <rect key={gl.id} x={gl.x} y={gl.y} width={gl.w} height={gl.h} fill={gl.type === "glass" ? "url(#cadGlass)" : "var(--cad-panel)"} className={st.infillRect} strokeWidth={k * 0.8} />
            ))}
            {leafSymbol(r)}
            {/* handle on the lock side */}
            {!r.slide && (r.opening?.endsWith("left") || r.opening?.endsWith("right")) && (
              <rect x={r.opening.endsWith("left") ? r.x + r.w - 26 * k : r.x + 14 * k} y={r.y + r.h / 2 - 40 * k} width={12 * k} height={80 * k} rx={5 * k} className={st.handleBar} />
            )}
          </g>
        ))}
        {/* meneaux / traverses: drag to move */}
        {layout.filter((r) => r.type === "mullion" || r.type === "transom").map((m) => {
          const dragged = drag?.kind === "divider" && drag.r.id === m.id;
          const off = dragged ? delta : 0;
          return (
            <g key={m.id} className={st.dividerG} style={{ cursor: m.type === "mullion" ? "ew-resize" : "ns-resize" }} onPointerDown={(e) => startDivider(e, m)}>
              <rect x={m.x - (m.type === "mullion" ? 10 * k : 0)} y={m.y - (m.type === "transom" ? 10 * k : 0)} width={m.w + (m.type === "mullion" ? 20 * k : 0)} height={m.h + (m.type === "transom" ? 20 * k : 0)} fill="transparent" />
              <rect x={m.x + (m.type === "mullion" ? off : 0)} y={m.y + (m.type === "transom" ? off : 0)} width={m.w} height={m.h} rx={2 * k} fill="url(#cadFrame)"
                className={`${st.dividerRect} ${isSel(m) ? st.selGlow : ""} ${dragged ? st.dividerDragging : ""}`} strokeWidth={k * 1.2} />
            </g>
          );
        })}
        {/* case numbers */}
        {cells.map((c) => <text key={`n${c.id}`} x={c.x + 16 * k} y={c.y + 28 * k} fontSize={16 * k} className={st.cellNo} pointerEvents="none">{c.no}</text>)}
        {/* infill sizes */}
        {!drag && layout.filter((r) => r.type === "glass" || r.type === "panel").map((gl) => (
          <text key={`t${gl.id}`} x={gl.x + gl.w / 2} y={gl.y + gl.h / 2} fontSize={13 * k} textAnchor="middle" className={st.label} pointerEvents="none">{fmt(gl.w)} × {fmt(gl.h)}</text>
        ))}

        {/* drop preview */}
        {hc && hi && (hi.t === "mullion" || hi.t === "transom") && (() => {
          const v = hi.t === "mullion";
          const p = v ? Math.min(Math.max(hover.pt[0], hc.x + 100), hc.x + hc.w - 100) : Math.min(Math.max(hover.pt[1], hc.y + 100), hc.y + hc.h - 100);
          return (
            <g pointerEvents="none">
              {v ? <rect x={p - 30} y={hc.y} width={60} height={hc.h} className={st.ghost} /> : <rect x={hc.x} y={p - 30} width={hc.w} height={60} className={st.ghost} />}
              {v ? dimH(hc.x, p - 30, hc.y + hc.h / 2, "g1") : dimV(hc.y, p - 30, hc.x + hc.w / 2, "g1")}
              {v ? dimH(p + 30, hc.x + hc.w, hc.y + hc.h / 2, "g2") : dimV(p + 30, hc.y + hc.h, hc.x + hc.w / 2, "g2")}
            </g>
          );
        })()}
        {hc && hi && !(hi.t === "mullion" || hi.t === "transom") && (
          <g pointerEvents="none">
            <rect x={hc.x} y={hc.y} width={hc.w} height={hc.h} className={st.ghostCell} />
            <text x={hc.x + hc.w / 2} y={hc.y + hc.h / 2} fontSize={22 * k} textAnchor="middle" className={st.ghostText}>{ITEM_LABEL(hi)}</text>
          </g>
        )}

        {/* frame resize handles */}
        {[["frameW", frame.x + frame.w + frameD.dx, frame.y + frame.h / 2], ["frameH", frame.x + frame.w / 2, frame.y + frame.h + frameD.dy], ["frameWH", frame.x + frame.w + frameD.dx, frame.y + frame.h + frameD.dy]].map(([kind, x, y]) => (
          <circle key={kind} cx={x} cy={y} r={11 * k} className={st.handle} style={{ cursor: kind === "frameW" ? "ew-resize" : kind === "frameH" ? "ns-resize" : "nwse-resize" }} onPointerDown={(e) => startFrame(e, kind)} />
        ))}
        {drag && drag.kind !== "divider" && <rect x={frame.x} y={frame.y} width={frame.w + frameD.dx} height={frame.h + frameD.dy} className={st.ghostFrame} pointerEvents="none" />}

        {/* cotes */}
        {dimH(0, drag && drag.kind !== "divider" ? L + frameD.dx : L, frame.y - M * 0.45, "L", { strong: true, edit: { kind: "L" } })}
        {dimV(0, drag && drag.kind !== "divider" ? H + frameD.dy : H, frame.x - M * 0.45, "H", { strong: true, edit: { kind: "H" } })}
        {!drag && bottom.length > 1 && bottom.map((c, i) => { const p = partOf(c, "v"); return dimH(c.x, c.x + c.w, yb, `b${i}`, p ? { edit: { kind: "part", ...p } } : {}); })}
        {!drag && right.length > 1 && right.map((c, i) => { const p = partOf(c, "h"); return dimV(c.y, c.y + c.h, xr, `r${i}`, p ? { edit: { kind: "part", ...p } } : {}); })}
        {drag?.kind === "divider" && (() => {
          const ext = extents.get(drag.splitId) || [];
          const a = ext[drag.idx];
          const b = ext[drag.idx + 1];
          if (!a || !b) return null;
          return drag.v
            ? <>{dimH(a.x0, a.x1 + delta, yb, "da", { strong: true })}{dimH(b.x0 + delta, b.x1, yb, "db", { strong: true })}</>
            : <>{dimV(a.y0, a.y1 + delta, xr, "da", { strong: true })}{dimV(b.y0 + delta, b.y1, xr, "db", { strong: true })}</>;
        })()}
      </svg>
      {edit && (
        <input className={st.dimInput} style={{ left: edit.sx, top: edit.sy }} autoFocus value={edit.value}
          onChange={(e) => setEdit({ ...edit, value: e.target.value })} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEdit(null); }} />
      )}
    </div>
  );
}

function findSplitDir(root, id) {
  if (!root) return null;
  if (root.id === id) return root.dir || null;
  if (root.kind === "split") for (const p of root.parts) { const d = findSplitDir(p.node, id); if (d) return d; }
  return null;
}
