import { fmtMm } from "./geometry";

/**
 * Dimension lines drawn in SVG coordinates of a world view (x, -y), sized
 * in screen pixels through `px` (mm per pixel) so they read the same at
 * every zoom.
 */
export function DimH({ x1, x2, y, px, label, color = "var(--dxf-dim)", strong = false, below = false }) {
  if (!Number.isFinite(x1) || !Number.isFinite(x2)) return null;
  const sy = -y;
  const t = 5 * px;
  const text = label ?? fmtMm(Math.abs(x2 - x1));
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={sy} x2={x2} y2={sy} stroke={color} strokeWidth={(strong ? 1.6 : 1.1) * px} />
      <line x1={x1} y1={sy - t} x2={x1} y2={sy + t} stroke={color} strokeWidth={1.1 * px} />
      <line x1={x2} y1={sy - t} x2={x2} y2={sy + t} stroke={color} strokeWidth={1.1 * px} />
      <text x={(x1 + x2) / 2} y={below ? sy + 13 * px : sy - 4 * px} fontSize={(strong ? 12.5 : 11) * px} textAnchor="middle" fill={color} fontWeight={strong ? 800 : 600} paintOrder="stroke" stroke="var(--dxf-bg)" strokeWidth={3 * px}>{text}</text>
    </g>
  );
}

export function DimV({ y1, y2, x, px, label, color = "var(--dxf-dim)" }) {
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  const t = 5 * px;
  const text = label ?? fmtMm(Math.abs(y2 - y1));
  const cy = -(y1 + y2) / 2;
  return (
    <g pointerEvents="none">
      <line x1={x} y1={-y1} x2={x} y2={-y2} stroke={color} strokeWidth={1.1 * px} />
      <line x1={x - t} y1={-y1} x2={x + t} y2={-y1} stroke={color} strokeWidth={1.1 * px} />
      <line x1={x - t} y1={-y2} x2={x + t} y2={-y2} stroke={color} strokeWidth={1.1 * px} />
      <text x={x + 4 * px} y={cy} fontSize={11 * px} fill={color} fontWeight={600} dominantBaseline="middle" paintOrder="stroke" stroke="var(--dxf-bg)" strokeWidth={3 * px}>{text}</text>
    </g>
  );
}

/** A vertical reference line (cote, jour, axe…) across the drawing. */
export function RefLine({ x, y0, y1, px, label, color = "var(--dxf-ref)", active = false, onPointerDown }) {
  return (
    <g style={onPointerDown ? { cursor: "ew-resize" } : undefined} onPointerDown={onPointerDown}>
      {onPointerDown && <line x1={x} y1={-y0} x2={x} y2={-y1} stroke="transparent" strokeWidth={12 * px} />}
      <line x1={x} y1={-y0} x2={x} y2={-y1} stroke={color} strokeWidth={(active ? 2 : 1.2) * px} strokeDasharray={`${6 * px} ${4 * px}`} />
      {label && <text x={x} y={-y0 + 13 * px} fontSize={10.5 * px} fill={color} textAnchor="middle" fontWeight={700}>{label}</text>}
    </g>
  );
}
