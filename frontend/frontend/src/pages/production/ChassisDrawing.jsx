import { sketchChassis } from "../../utils/chassisSketch";

/**
 * Small schematic of a chassis, drawn from its model's `drawing` hint
 * ({ type, leaves, opening… }), its L × H ratio and its parameters
 * (number of leaves, grid…). Purely visual — the real quantities come
 * from the model's formulas. The same shapes are drawn in the devis /
 * facture PDFs (backend/services/chassisSketch.js).
 *
 * When the model has an uploaded picture (`image` = its URL), the
 * picture is shown instead of the schematic.
 */
const FILLS = { glass: "rgba(110, 168, 254, 0.18)", solid: "rgba(127, 127, 127, 0.12)", ink: "currentColor" };

export default function ChassisDrawing({ drawing = {}, L = 1200, H = 1000, params = {}, width = 150, height = 130, image = null }) {
  if (image) {
    return (
      <img src={image} alt={`${L} × ${H}`} width={width} height={height}
        style={{ width, height, objectFit: "contain", borderRadius: 4, background: "#fff" }} />
    );
  }
  const { shapes } = sketchChassis({ drawing, L, H, params, width, height });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${L} × ${H}`} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>
      {shapes.map((s, i) => {
        const common = { stroke: "currentColor", strokeWidth: s.sw, strokeDasharray: s.dash ? s.dash.join(" ") : undefined };
        if (s.t === "rect") return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill ? FILLS[s.fill] : "none"} {...common} />;
        if (s.t === "line") return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...common} />;
        return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="currentColor" />;
      })}
    </svg>
  );
}
