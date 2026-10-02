import { useCallback, useEffect, useState } from "react";
import { Printer, Ruler, Layers, Package, PaintBucket, SlidersHorizontal, RotateCcw, RefreshCw, AlertTriangle, Tags } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import {
  getProjectCutting, getWorkOrderCutting, openProjectSectionPdf, openWorkOrderSectionPdf,
} from "../../services/productionService";
import { fmtQty, fmtMm } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";

/**
 * Débit of a project (all its work orders, or the forecast before
 * launch) or of one work order:
 *   bars         bar-by-bar cutting plan drawn to scale
 *   glass        panes to make, plateaux chosen from stock, layouts
 *   accessories  what to prepare
 *   powder       powder per colour + bars to lacquer
 * The cutting settings (blade, start / end of bar, space between cuts,
 * plateau border, cutting line) can be changed here to recompute — the
 * saved settings stay in Production › Configuration — and each material
 * prints on its own paper with the same values.
 */
export const SECTIONS = [
  { key: "bars", icon: Ruler },
  { key: "glass", icon: Layers },
  { key: "accessories", icon: Package },
  { key: "powder", icon: PaintBucket },
];
const BAR_FIELDS = ["kerf", "trim", "endTrim", "spacing"];
const GLASS_FIELDS = ["edgeTrim", "gap"];
const TYPE_ORDER = ["accessory", "gasket", "consumable", "panel", "profile", "glass", "other"];

export default function CuttingPlans({ projectId, orderId, initialTab = "bars", canPrint = true, sections }) {
  const { t } = useI18n();
  const shown = SECTIONS.filter((x) => !sections || sections.includes(x.key));
  const [tab, setTab] = useState(shown.some((x) => x.key === initialTab) ? initialTab : shown[0]?.key);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState(null); // the saved settings (Production › Configuration)
  const [draft, setDraft] = useState(null); // settings being edited
  const [applied, setApplied] = useState({}); // overrides sent to the API
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async (overrides) => {
    setBusy(true);
    setError("");
    try {
      const r = projectId ? await getProjectCutting(projectId, overrides) : await getWorkOrderCutting(orderId, overrides);
      setData(r);
      if (!Object.keys(overrides || {}).length) { setBase(r.report.settings); setDraft({ ...r.report.settings }); }
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.load"));
    } finally { setBusy(false); }
  }, [projectId, orderId, t]);
  useEffect(() => { load({}); }, [load]);

  const apply = () => {
    const o = {};
    for (const k of [...BAR_FIELDS, ...GLASS_FIELDS]) if (draft[k] !== "" && draft[k] !== undefined && Number(draft[k]) !== Number(base?.[k])) o[k] = Number(draft[k]);
    if ((draft.allowRotation !== false) !== (base?.allowRotation !== false)) o.allowRotation = draft.allowRotation !== false;
    if ((draft.nest !== false) !== (base?.nest !== false)) o.nest = draft.nest !== false;
    setApplied(o);
    load(o);
  };
  const reset = () => { setApplied({}); load({}); };
  const print = (section) => (projectId ? openProjectSectionPdf(projectId, section, applied) : openWorkOrderSectionPdf(orderId, section, applied)).catch(() => setError(t("prod.errors.load")));

  if (!data) return error ? <div className="errorMessage">{error}</div> : <p className={s.muted}>{t("common.loading")}</p>;
  const { report } = data;
  const counts = { bars: report.bars.length, glass: report.glass.length, accessories: report.accessories.length, powder: report.powder.length + report.lacquerOutputs.length };
  const overridden = Object.keys(applied).length > 0;

  return (
    <div>
      {error && <div className="errorMessage">{error}</div>}
      <div className={styles.cutToolbar}>
        <div className={styles.cutSummary} style={{ marginBottom: 0 }}>
          {data.source === "plan" && <span className={s.warn}>{t("cut.forecast")}</span>}
          <span><strong>{fmtQty(report.totals.bars, 0)}</strong> {t("cut.barsShort")}</span>
          <span><strong>{fmtQty(report.totals.panes, 0)}</strong> {t("cut.panes")} · {fmtQty(report.totals.glassArea, 2)} m²</span>
          <span><strong>{fmtQty(report.totals.sheets, 0)}</strong> {t("cut.sheets")}</span>
          {report.totals.powderKg > 0 && <span><strong>{fmtQty(report.totals.powderKg, 2)}</strong> kg {t("cut.powder")}</span>}
        </div>
        <div className={styles.printRow}>
          <button type="button" className="btnEdit" onClick={() => setShowSettings((v) => !v)}><SlidersHorizontal size={14} /> {t("cut.settings")}{overridden ? " •" : ""}</button>
          {canPrint && shown.map(({ key, icon: Icon }) => (
            <button key={key} type="button" className="btnEdit" title={t(`cut.print.${key}`)} onClick={() => print(key)}><Printer size={14} /><Icon size={14} /> {t(`cut.tabs.${key}`)}</button>
          ))}
          {canPrint && (shown.some((x) => x.key === "bars" || x.key === "glass")) && (
            <button type="button" className="btnEdit" title={t("cut.print.labels")} onClick={() => print("labels")}><Printer size={14} /><Tags size={14} /> {t("cut.labels")}</button>
          )}
        </div>
      </div>

      {showSettings && draft && (
        <div className={styles.cutSettings}>
          <h4>{t("cut.barSettings")}</h4>
          <div className={styles.cutSettingsGrid}>
            {BAR_FIELDS.map((k) => (
              <label key={k}>{t(`cut.fields.${k}`)} (mm)
                <input className={purch.input} type="number" min="0" step="0.5" value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              </label>
            ))}
            <label className={purch.inlineCheck} style={{ flexDirection: "row", alignItems: "center", marginTop: 18 }}>
              <input type="checkbox" checked={draft.nest !== false} onChange={(e) => setDraft({ ...draft, nest: e.target.checked })} /> {t("cut.fields.nest")}
            </label>
          </div>
          <h4 style={{ marginTop: 12 }}>{t("cut.glassSettings")}</h4>
          <div className={styles.cutSettingsGrid}>
            {GLASS_FIELDS.map((k) => (
              <label key={k}>{t(`cut.fields.${k}`)} (mm)
                <input className={purch.input} type="number" min="0" step="0.5" value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              </label>
            ))}
            <label className={purch.inlineCheck} style={{ flexDirection: "row", alignItems: "center", marginTop: 18 }}>
              <input type="checkbox" checked={draft.allowRotation !== false} onChange={(e) => setDraft({ ...draft, allowRotation: e.target.checked })} /> {t("cut.fields.allowRotation")}
            </label>
          </div>
          <p className={s.muted} style={{ fontSize: "0.74rem", margin: "10px 0 8px" }}>{t("cut.settingsHint")}</p>
          <div className={styles.printRow}>
            <button type="button" className="btnPrimary" disabled={busy} onClick={apply}><RefreshCw size={14} /> {t("cut.recompute")}</button>
            <button type="button" className="btnCancel" disabled={busy} onClick={reset}><RotateCcw size={14} /> {t("cut.reset")}</button>
          </div>
        </div>
      )}

      <div className={s.tabs}>
        {shown.map(({ key, icon: Icon }) => (
          <button key={key} type="button" className={tab === key ? s.tabActive : s.tab} onClick={() => setTab(key)}>
            <Icon size={14} /> {t(`cut.tabs.${key}`)} <span className={s.count}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {busy && <p className={s.muted}>{t("common.loading")}</p>}
      {tab === "bars" && <BarsView report={report} />}
      {tab === "glass" && data.missingGlass?.length > 0 && (
        <div className={purch.infoBanner} style={{ borderColor: "var(--color-warning)" }}>
          <AlertTriangle size={14} className={s.warn} /> {t("glassFix.title").replace("{n}", data.missingGlass.reduce((a, m) => a + (m.quantity || 1), 0))} — {t("glassFix.whereToFix")} ({data.missingGlass.map((m) => m.ref).join(", ")})
        </div>
      )}
      {tab === "glass" && <GlassView report={report} />}
      {tab === "accessories" && <AccessoriesView report={report} />}
      {tab === "powder" && <PowderView report={report} />}
    </div>
  );
}

// ------------------------------------------------------------------
function finishLabel(f) {
  return f ? `${f.code}${f.name ? ` ${f.name}` : ""}` : "";
}

function BarSvg({ pattern, barLength, settings, depth }) {
  const W = 1000;
  const k = W / barLength;
  const H = 26;
  const top = 10; // room for the cut numbers
  const last = pattern.cuts[pattern.cuts.length - 1];
  const lastEnd = last ? last.pos + last.length : settings.trim;
  const offX = (lastEnd + settings.kerf) * k;
  const offW = W - settings.endTrim * k - offX;
  // Mitre slant: the real profile width when known, else a visual 45°-ish slant.
  const offPx = depth > 0 ? Math.max(3, depth * k) : 9;
  const slant = (a, w) => (a === 90 || a === undefined ? 0 : Math.min(offPx / Math.tan((a * Math.PI) / 180), w / 2));
  return (
    <svg className={styles.barSvg} viewBox={`0 0 ${W} ${top + H + 9}`} preserveAspectRatio="none" role="img" aria-label={pattern.cuts.map((c) => c.length).join(", ")}>
      <rect x="0" y={top} width={W} height={H} fill="rgba(128,128,128,0.12)" stroke="rgba(128,128,128,0.6)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {settings.trim > 0 && <rect x="0" y={top} width={Math.max(1.5, settings.trim * k)} height={H} fill="rgba(128,128,128,0.55)" />}
      {settings.endTrim > 0 && <rect x={W - Math.max(1.5, settings.endTrim * k)} y={top} width={Math.max(1.5, settings.endTrim * k)} height={H} fill="rgba(128,128,128,0.55)" />}
      {offW > 1 && pattern.offcut > 0 && <rect x={offX} y={top} width={offW} height={H} fill={pattern.reusable ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.16)"} />}
      {pattern.cuts.map((c, i) => {
        const x0 = c.pos * k;
        const w = Math.max(1, c.length * k);
        const x1 = x0 + w;
        const oL = slant(c.angleL, w);
        const oR = slant(c.angleR, w);
        const b = top + H;
        const pts = c.longTop
          ? [[x0, top], [x1, top], [x1 - oR, b], [x0 + oL, b]]
          : [[x0 + oL, top], [x1 - oR, top], [x1, b], [x0, b]];
        return (
          <g key={i}>
            <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={c.nested ? "rgba(76,141,255,0.45)" : "rgba(76,141,255,0.32)"} stroke="rgba(76,141,255,0.95)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={x0 + w / 2} y={top - 2} textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.8">{c.n ?? i + 1}</text>
            {w > 34 && <text x={x0 + w / 2} y={top + H / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{fmtQty(c.length, 1)}</text>}
            {w > 22 && c.ref && <text x={x0 + w / 2} y={b + 8} textAnchor="middle" fontSize="7.5" fill="currentColor" opacity="0.65">{c.ref}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function BarsView({ report }) {
  const { t } = useI18n();
  if (!report.bars.length) return <p className={s.muted}>{t("cut.noBars")}</p>;
  return (
    <>
      <div className={styles.legend}>
        <span><i style={{ background: "rgba(76,141,255,0.45)" }} />{t("cut.legend.piece")}</span>
        <span><i style={{ background: "rgba(128,128,128,0.55)" }} />{t("cut.legend.trim")}</span>
        <span><i style={{ background: "rgba(16,185,129,0.3)" }} />{t("cut.legend.reusable")}</span>
        <span><i style={{ background: "rgba(239,68,68,0.25)" }} />{t("cut.legend.waste")}</span>
        <span>↻ {t("cut.legend.nested")}</span>
        <span>{t("cut.legend.longPoints")}</span>
      </div>
      {report.bars.map((b, i) => (
        <div key={`${b.need || b.name}-${i}`} className={styles.cutCard}>
          <div className={styles.cutCardHead}>
            <h3>{b.name}{b.ref && <small> · {b.ref}</small>}</h3>
            <div className={styles.cutMeta}>
              {b.finish && <span>{finishLabel(b.finish)}</span>}
              {b.workshop && <span>· {b.workshop}{b.order ? ` ${b.order}` : ""}</span>}
              {b.plan ? <>
                <span>· {t("cut.barOf")} <b>{fmtMm(b.barLength)} mm</b></span>
                <span>· <b>{b.plan.bars}</b> {t("cut.barsShort")}</span>
                <span>· {t("cut.efficiency")} <b>{fmtQty(b.plan.efficiency, 1)} %</b></span>
                {b.plan.reusableOffcuts > 0 && <span className={styles.offcutOk}>· {b.plan.reusableOffcuts} {t("cut.reusableOffcuts")}</span>}
                {b.stock !== null && <span className={b.stock < b.plan.bars ? s.bad : ""}>· {t("prod.stock")} {fmtQty(b.stock)}</span>}
              </> : <span>· {fmtQty(b.totalLength / 1000, 2)} m</span>}
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.needTable}>
              <thead><tr><th>{t("prod.ref")}</th><th>{t("prod.order.designation")}</th><th className={styles.num}>{t("cut.longPoints")} (mm)</th><th className={styles.num}>{t("cut.heel")}</th><th>{t("cut.angles")}</th><th className={styles.num}>{t("prod.quantity")}</th></tr></thead>
              <tbody>{b.cuts.map((c, j) => <tr key={j}><td><strong>{c.ref}</strong></td><td>{c.label}</td><td className={styles.num}><strong>{fmtMm(c.length)}</strong></td><td className={styles.num}>{c.heel !== null && c.heel !== undefined ? fmtMm(c.heel) : "—"}</td><td>{c.angleL ?? 90}° / {c.angleR ?? 90}°</td><td className={styles.num}>{fmtQty(c.qty)}</td></tr>)}</tbody>
            </table>
          </div>
          {b.depth > 0 && b.geometry && (
            <p className={s.muted} style={{ fontSize: "0.74rem", margin: "6px 0" }}>
              {t("cut.geometry").replace("{ch}", fmtQty(b.geometry.ch, 1)).replace("{ae}", fmtQty(b.geometry.ae, 1)).replace("{ai}", fmtQty(b.geometry.ai, 1)).replace("{hp}", fmtQty(b.geometry.hp, 1)).replace("{lp}", b.geometry.lp ? fmtQty(b.geometry.lp, 1) : "—")}
            </p>
          )}
          {!b.depth && b.plan && <p className={s.muted} style={{ fontSize: "0.74rem", margin: "6px 0" }}>{t("cut.noDepth")}</p>}
          {b.plan && b.plan.patterns.map((p, j) => (
            <div key={j}>
              <div className={styles.barRow}>
                <span className={styles.barCount} title={`× ${p.count}`}>{p.count > 1 ? `B${p.firstBar}–${p.lastBar}` : `B${p.firstBar}`}</span>
                <BarSvg pattern={p} barLength={b.plan.barLength} settings={b.plan.settings} depth={b.depth} />
              </div>
              <p className={styles.barSeq}>
                {p.cuts.map((c) => `${c.n}) ${fmtQty(c.length, 1)} ${c.angleL ?? 90}/${c.angleR ?? 90}${c.nested ? " ↻" : ""}${c.ref ? ` ${c.ref}` : ""}`).join("  ·  ")}
                {" — "}<span className={p.reusable ? styles.offcutOk : styles.offcutBad}>{t("cut.offcut")} {fmtQty(p.offcut, 1)} mm{p.reusable ? ` (${t("cut.reusable")})` : ""}</span>
              </p>
            </div>
          ))}
          {b.plan?.sawList?.length > 0 && (
            <details className={styles.sawList}>
              <summary>{t("cut.sawList")} · {b.plan.sawList.length}{b.plan.savedByNesting > 0 ? ` · ${t("cut.saved").replace("{mm}", fmtQty(b.plan.savedByNesting, 0))}` : ""}</summary>
              <table className={styles.needTable}>
                <thead><tr><th className={styles.num}>{t("cut.length")} (mm)</th><th>{t("cut.angles")}</th><th className={styles.num}>{t("prod.quantity")}</th><th>{t("prod.ref")}</th></tr></thead>
                <tbody>{b.plan.sawList.map((x, j) => <tr key={j}><td className={styles.num}><strong>{fmtMm(x.length)}</strong></td><td>{x.angle.replace("/", "° / ")}°</td><td className={styles.num}>{x.qty}</td><td>{x.refs.join(", ")}</td></tr>)}</tbody>
              </table>
            </details>
          )}
          {b.plan?.oversize?.length > 0 && <p className={s.bad}><AlertTriangle size={13} /> {t("cut.oversize")}: {b.plan.oversize.map((o) => `${fmtMm(o.length)}${o.ref ? ` ${o.ref}` : ""}`).join(", ")}</p>}
        </div>
      ))}
    </>
  );
}

function SheetSvg({ pattern, W, H, edge }) {
  const font = Math.max(W, H) / 32;
  return (
    <svg className={styles.sheetSvg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${W} × ${H}`}>
      <rect x="0" y="0" width={W} height={H} fill="rgba(128,128,128,0.14)" stroke="rgba(128,128,128,0.7)" strokeWidth={Math.max(W, H) / 400} />
      {edge > 0 && <rect x={edge} y={edge} width={W - 2 * edge} height={H - 2 * edge} fill="none" stroke="rgba(128,128,128,0.6)" strokeDasharray={`${font / 2} ${font / 3}`} strokeWidth={Math.max(W, H) / 700} />}
      {pattern.pieces.map((p, i) => {
        const dims = `${fmtQty(p.rotated ? p.h : p.w, 1)}×${fmtQty(p.rotated ? p.w : p.h, 1)}`;
        const fits = p.w > font * dims.length * 0.55 && p.h > font * 1.3;
        return (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="rgba(63,184,196,0.32)" stroke="rgba(63,184,196,0.95)" strokeWidth={Math.max(W, H) / 500} />
            {fits && <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" fontSize={font} fontWeight="700" fill="currentColor">{dims}</text>}
            {fits && p.ref && p.h > font * 2.6 && <text x={p.x + p.w / 2} y={p.y + p.h / 2 + font * 1.15} textAnchor="middle" fontSize={font * 0.8} fill="currentColor" opacity="0.7">{p.ref}{p.rotated ? " ↻" : ""}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function GlassView({ report }) {
  const { t } = useI18n();
  if (!report.glass.length && !report.panes?.length) return <p className={s.muted}>{t("cut.noGlass")}</p>;
  return (
    <>
      {report.panes?.length > 0 && (
        <section className={purch.section}>
          <h2>{t("cut.panesToMake")}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.needTable}>
              <thead><tr><th>{t("prod.ref")}</th><th>{t("cut.composition")}</th><th className={styles.num}>L</th><th className={styles.num}>H</th><th className={styles.num}>{t("prod.quantity")}</th><th className={styles.num}>m²</th></tr></thead>
              <tbody>{report.panes.map((p, i) => <tr key={i}><td><strong>{p.ref}</strong></td><td>{p.label}{p.order && <small>{p.order}</small>}</td><td className={styles.num}>{fmtMm(p.L)}</td><td className={styles.num}>{fmtMm(p.H)}</td><td className={styles.num}>{fmtQty(p.quantity)}</td><td className={styles.num}>{p.L && p.H ? fmtQty((p.L * p.H * p.quantity) / 1e6, 2) : ""}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {report.glass.length > 0 && (
        <section className={purch.section}>
          <h2>{t("cut.sheetsToUse")}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.needTable}>
              <thead><tr><th>{t("cut.sheet")}</th><th>{t("cut.format")}</th><th className={styles.num}>{t("cut.panes")}</th><th className={styles.num}>m²</th><th className={styles.num}>{t("cut.sheets")}</th><th className={styles.num}>{t("cut.occupation")}</th><th className={styles.num}>{t("prod.stock")}</th></tr></thead>
              <tbody>{report.glass.map((g, i) => (
                <tr key={i}>
                  <td>{g.name}<small>{g.label}</small>{g.toBuy > 0 && <small className={s.bad}>{g.toBuy} {t("cut.toBuy")}</small>}{g.warning && !g.toBuy && <small className={styles.unmapped}>{g.warning}</small>}</td>
                  <td>{g.plan ? `${fmtMm(g.plan.sheetWidth)} × ${fmtMm(g.plan.sheetHeight)}` : "—"}</td>
                  <td className={styles.num}>{fmtQty(g.pieces)}</td>
                  <td className={styles.num}>{fmtQty(g.area, 2)}</td>
                  <td className={styles.num}><strong>{g.plan ? g.plan.count : `${fmtQty(g.theoretical)} ${g.unit || ""}`}</strong></td>
                  <td className={styles.num}>{g.plan ? `${fmtQty(g.plan.efficiency, 1)} %` : ""}</td>
                  <td className={styles.num}>{g.stock !== null ? fmtQty(g.stock) : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
      {report.glass.map((g, i) => (
        <div key={i} className={styles.cutCard}>
          <div className={styles.cutCardHead}>
            <h3>{g.name}{g.ref && <small> · {g.ref}</small>}</h3>
            <div className={styles.cutMeta}>
              <span>{g.label}</span>
              {g.plan && <span>· <b>{g.plan.count}</b> {t("cut.sheets")} {fmtMm(g.plan.sheetWidth)} × {fmtMm(g.plan.sheetHeight)} · {t("cut.occupation")} <b>{fmtQty(g.plan.efficiency, 1)} %</b></span>}
            </div>
          </div>
          {g.candidates?.length > 1 && <p className={s.muted} style={{ fontSize: "0.74rem", margin: "0 0 6px" }}>{t("cut.allowedSheets")}: {g.candidates.join(" · ")}</p>}
          <div className={styles.tableWrap}>
            <table className={styles.needTable}>
              <thead><tr><th>{t("prod.ref")}</th><th>{t("cut.glass")}</th><th className={styles.num}>L (mm)</th><th className={styles.num}>H (mm)</th><th className={styles.num}>{t("prod.quantity")}</th></tr></thead>
              <tbody>{[...g.pieceList].sort((a, b) => String(a.ref).localeCompare(String(b.ref))).map((p, j) => <tr key={j}><td><strong>{p.ref}</strong></td><td>{p.label}</td><td className={styles.num}><strong>{fmtMm(p.width)}</strong></td><td className={styles.num}><strong>{fmtMm(p.height)}</strong></td><td className={styles.num}>{fmtQty(p.qty)}</td></tr>)}</tbody>
            </table>
          </div>
          {g.plan && (
            <div className={styles.sheetGrid}>
              {g.plan.patterns.map((p, j) => (
                <figure key={j} className={styles.sheetFig}>
                  <figcaption><strong>× {p.count}</strong><span>{t("cut.occupation")} {fmtQty(p.efficiency, 1)} %</span></figcaption>
                  <SheetSvg pattern={p} W={g.plan.sheetWidth} H={g.plan.sheetHeight} edge={g.plan.settings?.edgeTrim || 0} />
                </figure>
              ))}
            </div>
          )}
          {g.plan?.unfit > 0 && <p className={s.bad}><AlertTriangle size={13} /> {g.plan.unfit} {t("cut.unfit")}</p>}
        </div>
      ))}
    </>
  );
}

function AccessoriesView({ report }) {
  const { t } = useI18n();
  if (!report.accessories.length) return <p className={s.muted}>{t("cut.noAccessories")}</p>;
  const groups = TYPE_ORDER.map((type) => ({ type, rows: report.accessories.filter((a) => (TYPE_ORDER.includes(a.type) ? a.type : "other") === type) })).filter((g) => g.rows.length);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.needTable}>
        <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.planned")}</th><th>{t("cut.unit")}</th><th className={styles.num}>{t("prod.order.consumed")}</th><th className={styles.num}>{t("prod.stock")}</th></tr></thead>
        <tbody>
          {groups.map((g) => [
            <tr key={`g-${g.type}`} className={styles.groupRow}><td colSpan={5}>{t(`prod.materialTypes.${g.type}`, g.type)} <span className={s.muted}>· {g.rows.length}</span></td></tr>,
            ...g.rows.map((a, i) => (
              <tr key={`${g.type}-${i}`}>
                <td>{a.name}{a.ref && <small>{a.ref}</small>}{a.finish && <small>{finishLabel(a.finish)}</small>}{a.warning && <small className={styles.unmapped}>{a.warning}</small>}</td>
                <td className={styles.num}><strong>{fmtQty(a.theoretical)}</strong></td>
                <td>{a.unit}</td>
                <td className={styles.num}>{a.consumed ? fmtQty(a.consumed) : "—"}</td>
                <td className={`${styles.num} ${a.stock !== null && a.stock < a.theoretical ? s.bad : ""}`}>{a.stock !== null ? fmtQty(a.stock) : "—"}</td>
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}

function PowderView({ report }) {
  const { t } = useI18n();
  if (!report.powder.length && !report.lacquerOutputs.length) return <p className={s.muted}>{t("cut.noPowder")}</p>;
  return (
    <>
      {report.powder.length > 0 && (
        <section className={purch.section}>
          <h2>{t("cut.powderTitle")}</h2>
          <table className={styles.needTable}>
            <thead><tr><th>{t("cut.powder")}</th><th className={styles.num}>{t("cut.surface")} (m²)</th><th className={styles.num}>{t("prod.planned")} (kg)</th><th className={styles.num}>{t("prod.order.consumed")}</th><th className={styles.num}>{t("prod.stock")}</th></tr></thead>
            <tbody>{report.powder.map((p, i) => <tr key={i}><td>{p.name}<small>{p.label !== p.name ? p.label : ""}</small>{p.warning && <small className={styles.unmapped}>{p.warning}</small>}</td><td className={styles.num}>{p.surface ? fmtQty(p.surface, 2) : "—"}</td><td className={styles.num}><strong>{fmtQty(p.theoretical)}</strong></td><td className={styles.num}>{p.consumed ? fmtQty(p.consumed) : "—"}</td><td className={`${styles.num} ${p.stock !== null && p.stock < p.theoretical ? s.bad : ""}`}>{p.stock !== null ? fmtQty(p.stock) : "—"}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      {report.lacquerOutputs.length > 0 && (
        <section className={purch.section}>
          <h2>{t("cut.toLacquer")}</h2>
          <table className={styles.needTable}>
            <thead><tr><th>{t("prod.order.raw")}</th><th>{t("prod.finish")}</th><th className={styles.num}>{t("prod.quantity")}</th><th className={styles.num}>{t("cut.surface")} (m²)</th></tr></thead>
            <tbody>{report.lacquerOutputs.map((o, i) => <tr key={i}><td>{o.name}{o.ref && <small>{o.ref}</small>}</td><td>{o.finish?.color && <i className={styles.dot} style={{ background: o.finish.color }} />} {finishLabel(o.finish)}</td><td className={styles.num}><strong>{fmtQty(o.quantity)}</strong></td><td className={styles.num}>{o.paintSurface ? fmtQty(o.paintSurface, 2) : "—"}</td></tr>)}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
