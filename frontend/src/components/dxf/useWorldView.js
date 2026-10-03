import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Zoom / pan of an SVG drawing in WORLD coordinates (mm, Y up).
 *   bounds   { x0, y0, x1, y1 } to fit (re-fitted when it changes, until the user zooms)
 * Returns { viewBox, px (mm per screen pixel), toWorld(evt), fit(), bind (svg props), panning }
 * The SVG draws the world inside <g transform="scale(1,-1)">.
 */
export default function useWorldView(svgRef, bounds, { margin = 0.12, interactive = true } = {}) {
  const [view, setView] = useState(null);
  const [size, setSize] = useState({ w: 600, h: 300 });
  const touched = useRef(false);
  const pan = useRef(null);
  const key = bounds ? [bounds.x0, bounds.y0, bounds.x1, bounds.y1].map((v) => Math.round(v)).join(",") : "";

  const fitTo = useCallback((b) => {
    if (!b) return;
    const w = Math.max(1, b.x1 - b.x0);
    const h = Math.max(1, b.y1 - b.y0);
    const m = Math.max(w, h) * margin + 2;
    setView({ x: b.x0 - m, y: b.y0 - m, w: w + 2 * m, h: h + 2 * m });
  }, [margin]);

  useEffect(() => { if (!touched.current) fitTo(bounds); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 600, h: el.clientHeight || 300 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [svgRef]);

  const toWorld = useCallback((evt) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, -p.y];
  }, [svgRef]);

  // wheel zoom around the cursor (native listener: React's is passive)
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      touched.current = true;
      const [wx, wy] = toWorld(e);
      const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      setView((v) => (v ? { x: wx - (wx - v.x) * f, y: wy - (wy - v.y) * f, w: v.w * f, h: v.h * f } : v));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [svgRef, toWorld, interactive]);

  const startPan = useCallback((e) => {
    if (!interactive) return;
    pan.current = { sx: e.clientX, sy: e.clientY, v: view };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [view, interactive]);
  const movePan = useCallback((e) => {
    if (!pan.current || !view) return false;
    const pxs = Math.max(pan.current.v.w / size.w, pan.current.v.h / size.h);
    const dx = (e.clientX - pan.current.sx) * pxs;
    const dy = (e.clientY - pan.current.sy) * pxs;
    touched.current = true;
    setView({ ...pan.current.v, x: pan.current.v.x - dx, y: pan.current.v.y + dy });
    return true;
  }, [view, size]);
  const endPan = useCallback(() => { const was = !!pan.current; pan.current = null; return was; }, []);

  const px = view ? Math.max(view.w / size.w, view.h / size.h) : 1;
  return {
    view,
    viewBox: view ? `${view.x} ${-(view.y + view.h)} ${view.w} ${view.h}` : "0 0 100 100",
    px,
    toWorld,
    fit: () => { touched.current = false; fitTo(bounds); },
    startPan, movePan, endPan,
    panning: () => !!pan.current,
  };
}
