import { useI18n } from "../../../hooks/useI18n";
import st from "./Designer.module.css";

const fmt = (v, d = 1) => (v === null || v === undefined ? "—" : (Math.round(Number(v) * 10 ** d) / 10 ** d).toLocaleString("fr-FR"));

/**
 * DÉBIT of the design at the chosen size × quantity: the bars of each
 * profile (optimised cutting patterns, saw list), the glass panes and
 * sheets — the same calculation as the workshop printouts.
 */
export default function CutList({ report, lines = [], panes = [], hasGlassTypes = true, quantity }) {
  const { t } = useI18n();
  if (!report) return <p className={st.muted}>{t("common.loading")}</p>;
  const glassPanes = panes.filter((g) => g.type === "glass");
  const codeOf = new Map(lines.filter((l) => l.product).map((l) => [String(l.product), l.seriesCode]));
  return (
    <div className={st.cut}>
      <div className={st.totals}>
        <div><span>{t("cad.totalBars")}</span><strong>{report.totals?.bars ?? 0}</strong></div>
        <div><span>{t("cad.totalPanes")}</span><strong>{glassPanes.reduce((a, g) => a + g.qty, 0)}</strong></div>
        <div><span>{t("cad.glassArea")}</span><strong>{fmt(glassPanes.reduce((a, g) => a + (g.width * g.height * g.qty) / 1e6, 0), 2)} m²</strong></div>
        <div><span>{t("cad.quantity")}</span><strong>{quantity}</strong></div>
      </div>

      <h3 className={st.h3}>{t("cad.barsTitle")}</h3>
      {!report.bars.length && <p className={st.muted}>{t("cad.noBars")}</p>}
      {report.bars.map((b) => (
        <div key={b.product || b.name} className={st.barCard}>
          <div className={st.barHead}>
            <span>{codeOf.get(String(b.product)) && <span className={st.codeTag}>{codeOf.get(String(b.product))}</span>} <strong>{b.name}</strong> {b.ref && <small className={st.muted}>{b.ref}</small>}</span>
            <span className={st.muted}>{t("cad.barOf").replace("{len}", fmt(b.barLength, 0))} · <strong>{b.plan?.bars ?? "—"} {t("cad.bars")}</strong> · {fmt(b.plan?.efficiency)} %</span>
          </div>
          <table className={st.cutTable}>
            <thead><tr><th>{t("cad.length")}</th><th>{t("cad.angle")}</th><th>{t("cad.qty")}</th><th>{t("cad.where")}</th></tr></thead>
            <tbody>
              {b.cuts.map((c, i) => (
                <tr key={i}><td><strong>{fmt(c.length)}</strong></td><td>{c.angle || "90/90"}</td><td>{c.qty}</td><td className={st.muted}>{c.label}{c.ops?.length ? <span title={c.ops.map((o) => `${o.label} : ${o.positions.join(" · ")}`).join("\n")}> · ⚙ {c.ops.map((o) => o.label).join(", ")}</span> : null}</td></tr>
              ))}
            </tbody>
          </table>
          {b.plan?.patterns?.map((p, i) => (
            <div key={i} className={st.pattern}>
              <span className={st.patternCount}>× {p.count}</span>
              <div className={st.barStock}>
                {p.cuts.map((c, j) => (
                  <span key={j} className={st.barCut} style={{ left: `${(c.pos / b.barLength) * 100}%`, width: `${(c.length / b.barLength) * 100}%` }} title={`${c.label || ""} ${fmt(c.length)} (${c.angle || "90/90"})`}>
                    {c.length / b.barLength > 0.06 ? fmt(c.length, 0) : ""}
                  </span>
                ))}
              </div>
              <span className={st.muted}>{t("cad.offcut")} {fmt(p.offcut, 0)}</span>
            </div>
          ))}
        </div>
      ))}

      <h3 className={st.h3}>{t("cad.glassTitle")}</h3>
      {!panes.length && <p className={st.muted}>{t("cad.noGlass")}</p>}
      {!hasGlassTypes && panes.some((x) => x.type === "glass") && <p className={st.muted}>{t("cad.noComposition")}</p>}
      {panes.length > 0 && (
        <table className={st.cutTable}>
          <thead><tr><th>{t("cad.infill")}</th><th>{t("cad.size")}</th><th>{t("cad.qty")}</th><th>{t("cad.cells")}</th></tr></thead>
          <tbody>
            {panes.map((g, i) => (
              <tr key={i}><td>{t(`cad.infills.${g.type}`)}</td><td><strong>{fmt(g.width, 0)} × {fmt(g.height, 0)}</strong></td><td>{g.qty}</td><td className={st.muted}>{g.cells.join(", ")}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {report.glassPieces?.length > 0 && (
        <table className={st.cutTable}>
          <thead><tr><th>{t("cad.glass")}</th><th>{t("cad.size")}</th><th>{t("cad.qty")}</th></tr></thead>
          <tbody>
            {report.glassPieces.map((g, i) => (
              <tr key={i}><td>{g.glass}<small className={st.muted}> {g.layer}</small></td><td><strong>{fmt(g.width, 0)} × {fmt(g.height, 0)}</strong></td><td>{g.qty}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {report.glass?.filter((g) => g.plan).map((g) => (
        <p key={g.product || g.name} className={st.muted}>{g.name} : {g.plan.count} {t("cad.sheets")} {fmt(g.plan.sheetWidth, 0)} × {fmt(g.plan.sheetHeight, 0)} ({fmt(g.plan.efficiency)} %)</p>
      ))}

      {report.accessories?.length > 0 && (
        <>
          <h3 className={st.h3}>{t("fab.accessoriesTitle")}</h3>
          <table className={st.cutTable}>
            <thead><tr><th>{t("rules.article")}</th><th>{t("cad.qty")}</th></tr></thead>
            <tbody>
              {report.accessories.map((a, i) => <tr key={i}><td>{a.name}{a.ref && <small className={st.muted}> {a.ref}</small>}</td><td><strong>{fmt(a.theoretical, 2)}</strong> {a.unit}</td></tr>)}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
