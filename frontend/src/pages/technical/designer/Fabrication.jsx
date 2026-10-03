import { useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, AlertTriangle, Info, Wrench, Drill } from "lucide-react";
import { useI18n } from "../../../hooks/useI18n";
import st from "./Designer.module.css";

const fmt = (v, d = 1) => (v === null || v === undefined ? "—" : (Math.round(Number(v) * 10 ** d) / 10 ** d).toLocaleString("fr-FR"));
const COLORS = ["#ef5350", "#42a5f5", "#66bb6a", "#ffa726", "#ab47bc", "#26c6da"];
const SECTIONS = ["plan", "pieces", "bars", "machining", "accessories", "glass"];

/** A piece drawn as a bar with its machining marks (positions from the left end). */
function MachinedBar({ piece }) {
  const [aL, aR] = String(piece.angle || "90/90").split("/").map(Number);
  const cutL = aL && aL < 90 ? 3 : 0;
  const cutR = aR && aR < 90 ? 3 : 0;
  return (
    <div className={st.mBar} style={{ clipPath: `polygon(0 0, 100% 0, calc(100% - ${cutR * 4}px) 100%, ${cutL * 4}px 100%)` }}>
      {piece.ops.map((o, i) => o.positions.map((x) => (
        <span key={`${i}-${x}`} className={st.mMark} style={{ left: `${(x / piece.length) * 100}%`, background: COLORS[i % COLORS.length] }} title={`${o.label} — ${fmt(x)} mm`} />
      )))}
    </div>
  );
}

/**
 * FABRICATION tab of the CAD (LogiKal-like): what the series' rules add
 * to this chassis — vantaux (weight, hardware that fits), each profile
 * piece with its machining, accessories — plus the dossier de fabrication.
 */
export default function Fabrication({ preview, quantity, seriesId, onPdf, pdfBusy }) {
  const { t } = useI18n();
  const [sections, setSections] = useState(SECTIONS);
  const fab = preview?.fabrication;
  if (!preview) return <p className={st.muted}>{t("common.loading")}</p>;
  if (!fab) return <p className={st.muted}>{t("fab.none")}</p>;
  const ruleLines = (preview.lines || []).filter((l) => l.fromRule);
  const byRule = new Map();
  for (const l of ruleLines) {
    const key = `${l.product}|${l.label}`;
    if (!byRule.has(key)) byRule.set(key, { name: l.productName || l.label, rule: l.label, measure: l.measure, pieces: 0, meters: 0, where: new Set() });
    const g = byRule.get(key);
    g.pieces += l.pieces;
    if (l.measure === "length") g.meters += (l.length * l.pieces) / 1000;
    g.where.add(l.ruleWhere);
  }
  const warnings = [...new Set([...(fab.checks || []).map((c) => c.message), ...(preview.warnings || []).filter((w) => !/aucun modèle choisi/.test(w.message)).map((w) => w.message)])];
  const byCode = new Map();
  for (const p of fab.pieces) { if (!byCode.has(p.code)) byCode.set(p.code, []); byCode.get(p.code).push(p); }
  const opsCount = fab.pieces.reduce((s, p) => s + p.ops.reduce((a, o) => a + o.positions.length, 0) * p.totalQty, 0);
  const noRules = !fab.rules?.accessories && !fab.rules?.machining;

  return (
    <div className={st.cut}>
      {/* dossier de fabrication */}
      <div className={st.fabBar}>
        <div className={st.totals} style={{ flex: 1 }}>
          <div><span>{t("fab.pieces")}</span><strong>{fab.pieces.reduce((s, p) => s + p.totalQty, 0)}</strong></div>
          <div><span>{t("fab.operations")}</span><strong>{opsCount}</strong></div>
          <div><span>{t("fab.accessories")}</span><strong>{byRule.size}</strong></div>
          <div><span>{t("fab.leaves")}</span><strong>{fab.leaves.length}</strong></div>
        </div>
        <div className={st.pdfBox}>
          <div className={st.pdfSections}>
            {SECTIONS.map((k) => (
              <label key={k}><input type="checkbox" checked={sections.includes(k)} onChange={() => setSections(sections.includes(k) ? sections.filter((x) => x !== k) : SECTIONS.filter((x) => x === k || sections.includes(x)))} /> {t(`fab.sections.${k}`)}</label>
            ))}
          </div>
          <button type="button" className="btnPrimary" disabled={pdfBusy || !sections.length} onClick={() => onPdf(sections)}><FileDown size={14} /> {pdfBusy ? t("common.loading") : t("fab.dossier")}</button>
        </div>
      </div>

      {noRules && (
        <div className={st.warnBanner} style={{ color: "var(--color-text-secondary)" }}>
          <Info size={14} /> {t("fab.noRules")} <Link to={`/technical/series/${seriesId}`}>{t("cad.openSeries")}</Link>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className={st.issues}>{warnings.map((m) => <li key={m}><AlertTriangle size={12} /> {m}</li>)}</ul>
      )}

      {/* vantaux */}
      {fab.leaves.length > 0 && (
        <>
          <h3 className={st.h3}>{t("fab.leavesTitle")}</h3>
          <div className={st.barCard}>
            <table className={st.cutTable}>
              <thead><tr><th>{t("cad.cell")}</th><th>{t("cad.opening")}</th><th>{t("fab.leafSize")}</th><th>{t("fab.glassSize")}</th><th>{t("fab.weight")}</th><th>{t("fab.fits")}</th></tr></thead>
              <tbody>
                {fab.leaves.map((l, i) => (
                  <tr key={i}>
                    <td><strong>{l.no}{l.leaves === 2 ? `.${l.index + 1}` : ""}</strong> <span className={st.codeTag}>{l.code}</span></td>
                    <td>{t(`cad.openings.${l.opening}`)}{l.leaves === 2 && <span className={st.muted}> · {l.active ? t("fab.active") : t("fab.passive")}</span>}</td>
                    <td><strong>{fmt(l.lw, 0)} × {fmt(l.lh, 0)}</strong></td>
                    <td>{l.infill === "none" ? "—" : `${fmt(l.gw, 0)} × ${fmt(l.gh, 0)}`}</td>
                    <td title={`${t("fab.profilesKg")} ${fmt(l.profileKg)} kg · ${t("fab.glassKg")} ${fmt(l.glassKg)} kg`}><strong>{l.poids ? `${fmt(l.poids)} kg` : "—"}</strong></td>
                    <td className={st.muted}>{Object.entries(l.fits || {}).map(([g, names]) => `${g} : ${names.filter(Boolean).join(", ") || "✓"}`).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* pieces + machining */}
      <h3 className={st.h3}><Drill size={14} /> {t("fab.piecesTitle")}</h3>
      {[...byCode.entries()].map(([code, rows]) => (
        <div key={code} className={st.barCard}>
          <div className={st.barHead}><span><span className={st.codeTag}>{code}</span> <strong>{rows[0].productName || t("fab.missingProfile")}</strong></span></div>
          <table className={st.cutTable}>
            <thead><tr><th>{t("fab.position")}</th><th>{t("cad.length")}</th><th>{t("cad.angle")}</th><th>{t("cad.qty")}</th><th style={{ width: "34%" }}>{t("fab.machining")}</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.role}>
                  <td>{p.label}</td>
                  <td><strong>{fmt(p.length)}</strong></td>
                  <td>{p.angle}</td>
                  <td>{fmt(p.totalQty, 3)}</td>
                  <td>
                    {p.ops.length ? (
                      <>
                        <MachinedBar piece={p} />
                        <div className={st.mLegend}>
                          {p.ops.map((o, i) => <span key={i}><i style={{ background: COLORS[i % COLORS.length] }} />{o.label}{o.size ? ` ${o.size}` : ""} : {o.positions.map((x) => fmt(x)).join(" · ")}</span>)}
                        </div>
                      </>
                    ) : <span className={st.muted}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* accessories */}
      <h3 className={st.h3}><Wrench size={14} /> {t("fab.accessoriesTitle")}</h3>
      {!byRule.size && <p className={st.muted}>{t("fab.noAccessories")}</p>}
      {byRule.size > 0 && (
        <div className={st.barCard}>
          <table className={st.cutTable}>
            <thead><tr><th>{t("rules.article")}</th><th>{t("rules.for")}</th><th>{t("cad.qty")}</th></tr></thead>
            <tbody>
              {[...byRule.values()].map((g, i) => (
                <tr key={i}>
                  <td><strong>{g.name}</strong>{g.rule !== g.name && <div className={st.muted}>{g.rule}</div>}</td>
                  <td className={st.muted}>{[...g.where].join(", ")}</td>
                  <td><strong>{g.measure === "length" ? `${fmt(g.meters, 2)} m` : fmt(g.pieces, 3)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={st.muted}>{t("fab.quantityNote").replace("{q}", quantity)}</p>
    </div>
  );
}
