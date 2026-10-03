import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Wrench, Drill, Search, Copy, EyeOff } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useDialog } from "../../components/useful/DialogProvider";
import CustomSelect from "../../components/useful/CustomSelect";
import { updateSeries } from "../../services/productionService";
import { getProducts } from "../../services/productService";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "../production/Production.module.css";

/**
 * FABRICATION RULES of a series (like LogiKal's article / machining
 * assignment): written once, applied to every CAD chassis of the series
 * at every calculation — see backend services/chassisFabrication.js.
 *   Accessoires automatiques  ferrures, équerres, connecteurs, joints, cales…
 *   Usinages                  drainages, perçages, fraisages… with positions
 */
const TRIGGERS = ["chassis", "piece", "corner", "joint", "leaf", "pane"];
const PIECE_TAGS = ["frame", "sash", "div", "bead", "meeting", "top", "bottom", "left", "right", "vertical", "horizontal", "hinge", "lock", "mullion", "transom"];
const CORNER_TAGS = ["frame", "sash"];
const JOINT_TAGS = ["mullion", "transom"];
const OPENINGS = ["left", "right", "tilt-left", "tilt-right", "top", "bottom", "slide"];
const MACHINING_KINDS = ["drain", "drill", "mill", "slot", "notch", "other"];
const PLACES = ["ends", "pitch", "center", "at", "joints"];
const FACES = ["", "ext", "int", "top", "bottom", "side"];
const VARS = {
  chassis: ["L", "H", "perim"], piece: ["long", "nb", "L", "H"], corner: ["L", "H"], joint: ["L", "H"],
  leaf: ["lw", "lh", "gw", "gh", "poids", "perim"], pane: ["gw", "gh", "perim"],
};

const emptyRule = { label: "", product: null, kind: "accessory", trigger: "leaf", codes: [], tags: [], openings: [], leafRole: "any", infill: "any", where: "any", minW: "", maxW: "", minH: "", maxH: "", maxKg: "", condition: "", measure: "count", qty: "1", length: "", group: "", finish: "none", workshop: "", isActive: true };
const emptyOp = { label: "", kind: "drill", codes: [], tags: [], openings: [], face: "", place: "ends", offset: "0", pitch: "", at: "", size: "", tool: "", condition: "", isActive: true };

// Ready-made starting points (the article is chosen by the user)
const RULE_TEMPLATES = (pick) => [
  { key: "eqFrame", rule: { label: "Équerres de dormant", trigger: "corner", codes: [pick(["DOR"])].filter(Boolean), tags: ["frame"], qty: "1" } },
  { key: "eqSash", rule: { label: "Équerres d'ouvrant", trigger: "corner", codes: [pick(["OUV"])].filter(Boolean), tags: ["sash"], qty: "1" } },
  { key: "tee", rule: { label: "Connecteurs de meneau", trigger: "joint", codes: [pick(["MEN", "TRA"])].filter(Boolean), qty: "1" } },
  { key: "gasketSash", rule: { label: "Joint de frappe ouvrant", kind: "gasket", trigger: "piece", codes: [pick(["OUV"])].filter(Boolean), measure: "length", length: "long" } },
  { key: "gasketGlass", rule: { label: "Joint de vitrage", kind: "gasket", trigger: "pane", infill: "glass", measure: "length", qty: "2", length: "perim" } },
  { key: "setting", rule: { label: "Cales de vitrage", trigger: "pane", infill: "glass", qty: "gw > 1000 ? 8 : 6" } },
  { key: "hardware", rule: { label: "Ferrure oscillo-battant", trigger: "leaf", group: "Ferrure", openings: ["tilt-left", "tilt-right"], leafRole: "active", maxW: 900, maxH: 1600, maxKg: 90, qty: "1" } },
  { key: "hinges", rule: { label: "Paumelles", trigger: "leaf", openings: ["left", "right"], qty: "lh > 1500 ? 3 : 2" } },
  { key: "handle", rule: { label: "Poignée", trigger: "leaf", leafRole: "active", openings: ["left", "right", "tilt-left", "tilt-right"], qty: "1", finish: "project" } },
  { key: "screws", rule: { label: "Vis de fixation", kind: "consumable", trigger: "chassis", qty: "ceil(perim / 600) + 4" } },
];
const OP_TEMPLATES = (pick) => [
  { key: "drainFrame", op: { label: "Drainage", kind: "drain", codes: [pick(["DOR"])].filter(Boolean), tags: ["bottom"], face: "ext", place: "pitch", offset: "100", pitch: "600", size: "30 × 5" } },
  { key: "drainSash", op: { label: "Drainage ouvrant", kind: "drain", codes: [pick(["OUV"])].filter(Boolean), tags: ["bottom"], face: "ext", place: "pitch", offset: "80", pitch: "600", size: "25 × 5" } },
  { key: "hinge", op: { label: "Perçage paumelles", kind: "drill", codes: [pick(["OUV"])].filter(Boolean), tags: ["hinge"], place: "at", at: "150; -150", size: "Ø 8" } },
  { key: "lock", op: { label: "Fraisage crémone", kind: "mill", codes: [pick(["OUV"])].filter(Boolean), tags: ["lock"], face: "int", place: "at", at: "long/2", size: "120 × 24" } },
  { key: "tee", op: { label: "Perçage fixation meneau", kind: "drill", codes: [pick(["DOR"])].filter(Boolean), tags: ["top", "bottom", "left", "right"], place: "joints", size: "Ø 5,5" } },
  { key: "fixing", op: { label: "Trous de fixation (pose)", kind: "drill", codes: [pick(["DOR"])].filter(Boolean), tags: ["vertical", "horizontal"], face: "side", place: "pitch", offset: "150", pitch: "700", size: "Ø 10" } },
];

const fieldIn = { width: "100%", padding: "6px 8px", fontSize: "0.82rem" };
const mono = { ...fieldIn, fontFamily: "ui-monospace, monospace" };

function Chips({ options, value = [], onChange, label, disabled }) {
  return (
    <div className={styles.chips}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" disabled={disabled} className={styles.chip}
            style={on ? { borderColor: "var(--tone-6ea8fe)", color: "var(--color-text-primary)", background: "rgba(59,130,246,0.15)" } : undefined}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>{label ? label(o) : o}</button>
        );
      })}
    </div>
  );
}

function Seg({ options, value, onChange, label }) {
  return (
    <div className={styles.chips}>
      {options.map((o) => (
        <button key={o} type="button" className={styles.chip}
          style={value === o ? { borderColor: "var(--tone-6ea8fe)", color: "var(--color-inverse-fg)", background: "var(--color-inverse-bg)" } : undefined}
          onClick={() => onChange(o)}>{label(o)}</button>
      ))}
    </div>
  );
}

export default function SeriesRules({ series, codes, canEdit, onSaved }) {
  const { t } = useI18n();
  const dialog = useDialog();
  const [editRule, setEditRule] = useState(null); // { index, rule }
  const [editOp, setEditOp] = useState(null);
  const [error, setError] = useState("");
  const rules = series.rules || [];
  const machining = series.machining || [];
  const pick = (prefixes) => prefixes.map((p) => codes.find((c) => c.startsWith(p))).find(Boolean) || codes[0] || "";

  const toBody = (r) => ({ ...r, product: r.product?._id || r.product });
  const save = async (patch) => {
    setError("");
    try {
      await updateSeries(series._id, patch);
      await onSaved(t("rules.saved"));
      return true;
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.save"));
      return false;
    }
  };
  const saveRules = (list) => save({ rules: list.map(toBody) });
  const saveOps = (list) => save({ machining: list });

  const ruleScope = (r) => {
    const parts = [t(`rules.triggers.${r.trigger}`)];
    if (r.codes?.length) parts.push(r.codes.join(", "));
    if (r.tags?.length) parts.push(r.tags.map((x) => t(`rules.tags.${x}`)).join(", "));
    if (r.openings?.length) parts.push(r.openings.map((o) => t(`cad.openings.${o}`)).join(", "));
    if (r.leafRole && r.leafRole !== "any") parts.push(t(`rules.leafRoles.${r.leafRole}`));
    if (r.infill && r.infill !== "any") parts.push(t(`cad.infills.${r.infill}`));
    const range = (a, b, u = "") => (a !== null && a !== undefined && a !== "") || (b !== null && b !== undefined && b !== "") ? `${a ?? "…"}–${b ?? "…"}${u}` : null;
    const w = range(r.minW, r.maxW);
    const h = range(r.minH, r.maxH);
    if (w || h) parts.push(`${w || "…"} × ${h || "…"} mm`);
    if (r.maxKg) parts.push(`≤ ${r.maxKg} kg`);
    if (r.condition) parts.push(`si ${r.condition}`);
    return parts.join(" · ");
  };
  const opPlace = (m) => {
    if (m.place === "pitch") return `${t("rules.places.pitch")} ≤ ${m.pitch}, ${t("rules.from")} ${m.offset}`;
    if (m.place === "at") return `${t("rules.places.at")} ${m.at}`;
    if (m.place === "ends") return `${t("rules.places.ends")} ${m.offset}`;
    return t(`rules.places.${m.place}`) + (m.offset && m.offset !== "0" ? ` ${m.offset > 0 ? "+" : ""}${m.offset}` : "");
  };

  return (
    <>
      {error && <div className="errorMessage">{error}</div>}
      {/* ---------- accessories ---------- */}
      <section className={purch.panel}>
        <div className={purch.sectionHeader}>
          <h3 className={purch.subTitle} style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}><Wrench size={16} /> {t("rules.accessories")} ({rules.length})</h3>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 230 }}>
                <CustomSelect value="" placeholder={t("rules.fromTemplate")} onSelect={(k) => { const tp = RULE_TEMPLATES(pick).find((x) => x.key === k); if (tp) setEditRule({ index: -1, rule: { ...emptyRule, ...tp.rule } }); }}
                  options={RULE_TEMPLATES(pick).map((x) => ({ value: x.key, label: x.rule.label }))} />
              </div>
              <button type="button" className="btnPrimary" onClick={() => setEditRule({ index: -1, rule: { ...emptyRule } })}><Plus size={15} /> {t("rules.addRule")}</button>
            </div>
          )}
        </div>
        <p className={s.muted}>{t("rules.accessoriesHint")}</p>
        <div className={styles.tableWrap}>
          <table className={styles.needTable}>
            <thead><tr><th>{t("rules.article")}</th><th>{t("rules.for")}</th><th>{t("rules.quantity")}</th><th>{t("rules.group")}</th><th /></tr></thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r._id || i} style={r.isActive === false ? { opacity: 0.5 } : undefined}>
                  <td><strong>{r.label || r.product?.name}</strong>{r.label && <small>{r.product?.name}{r.product?.internalReference ? ` · ${r.product.internalReference}` : ""}</small>}</td>
                  <td className={s.muted} style={{ fontSize: "0.78rem" }}>{ruleScope(r)}</td>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>{r.measure === "length" ? `${r.qty !== "1" ? `${r.qty} × ` : ""}${r.length || (r.trigger === "piece" ? "long" : "perim")} mm` : r.qty}</td>
                  <td>{r.group && <span className={styles.chip}>{r.group}</span>}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {r.isActive === false && <EyeOff size={13} style={{ opacity: 0.6, marginRight: 4 }} />}
                    {canEdit && <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => setEditRule({ index: i, rule: { ...emptyRule, ...r } })}><Pencil size={13} /></button>}
                    {canEdit && <button type="button" className="tableActionBtn" title={t("rules.duplicate")} onClick={() => setEditRule({ index: -1, rule: { ...emptyRule, ...r, _id: undefined, label: `${r.label || ""} (copie)` } })}><Copy size={13} /></button>}
                    {canEdit && <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={async () => { if (await dialog.confirm(t("rules.deleteConfirm"))) saveRules(rules.filter((_, j) => j !== i)); }}><Trash2 size={13} /></button>}
                  </td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan={5} className={s.muted}>{t("rules.noRules")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- machining ---------- */}
      <section className={purch.panel}>
        <div className={purch.sectionHeader}>
          <h3 className={purch.subTitle} style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}><Drill size={16} /> {t("rules.machining")} ({machining.length})</h3>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 230 }}>
                <CustomSelect value="" placeholder={t("rules.fromTemplate")} onSelect={(k) => { const tp = OP_TEMPLATES(pick).find((x) => x.key === k); if (tp) setEditOp({ index: -1, op: { ...emptyOp, ...tp.op } }); }}
                  options={OP_TEMPLATES(pick).map((x) => ({ value: x.key, label: x.op.label }))} />
              </div>
              <button type="button" className="btnPrimary" onClick={() => setEditOp({ index: -1, op: { ...emptyOp } })}><Plus size={15} /> {t("rules.addOp")}</button>
            </div>
          )}
        </div>
        <p className={s.muted}>{t("rules.machiningHint")}</p>
        <div className={styles.tableWrap}>
          <table className={styles.needTable}>
            <thead><tr><th>{t("rules.operation")}</th><th>{t("rules.onPieces")}</th><th>{t("rules.positions")}</th><th>{t("rules.sizeTool")}</th><th /></tr></thead>
            <tbody>
              {machining.map((m, i) => (
                <tr key={m._id || i} style={m.isActive === false ? { opacity: 0.5 } : undefined}>
                  <td><strong>{m.label}</strong><small>{t(`rules.kinds.${m.kind}`)}{m.face ? ` · ${t(`rules.faces.${m.face}`)}` : ""}</small></td>
                  <td className={s.muted} style={{ fontSize: "0.78rem" }}>{[m.codes?.join(", "), m.tags?.map((x) => t(`rules.tags.${x}`)).join(", "), m.openings?.map((o) => t(`cad.openings.${o}`)).join(", ")].filter(Boolean).join(" · ")}</td>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>{opPlace(m)}</td>
                  <td className={s.muted}>{[m.size, m.tool].filter(Boolean).join(" · ")}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {canEdit && <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => setEditOp({ index: i, op: { ...emptyOp, ...m } })}><Pencil size={13} /></button>}
                    {canEdit && <button type="button" className="tableActionBtn" title={t("rules.duplicate")} onClick={() => setEditOp({ index: -1, op: { ...emptyOp, ...m, _id: undefined, label: `${m.label} (copie)` } })}><Copy size={13} /></button>}
                    {canEdit && <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={async () => { if (await dialog.confirm(t("rules.deleteConfirm"))) saveOps(machining.filter((_, j) => j !== i)); }}><Trash2 size={13} /></button>}
                  </td>
                </tr>
              ))}
              {!machining.length && <tr><td colSpan={5} className={s.muted}>{t("rules.noOps")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editRule && (
        <RuleModal series={series} codes={codes} initial={editRule.rule} onClose={() => setEditRule(null)}
          onSave={async (rule) => {
            const list = editRule.index >= 0 ? rules.map((r, j) => (j === editRule.index ? rule : r)) : [...rules, rule];
            if (await saveRules(list)) setEditRule(null);
          }} />
      )}
      {editOp && (
        <OpModal codes={codes} initial={editOp.op} onClose={() => setEditOp(null)}
          onSave={async (op) => {
            const list = editOp.index >= 0 ? machining.map((m, j) => (j === editOp.index ? op : m)) : [...machining, op];
            if (await saveOps(list)) setEditOp(null);
          }} />
      )}
    </>
  );
}

// ------------------------------------------------------------------
// Accessory rule editor
// ------------------------------------------------------------------
function RuleModal({ series, codes, initial, onClose, onSave }) {
  const { t } = useI18n();
  const [r, setR] = useState(initial);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setR((x) => ({ ...x, ...patch }));
  useEffect(() => {
    if (!search.trim()) { setFound([]); return undefined; }
    const h = setTimeout(() => getProducts({ companyId: series.company, search, limit: 8 }).then((x) => setFound(x.products)).catch(() => setFound([])), 250);
    return () => clearTimeout(h);
  }, [search, series.company]);
  const tagOptions = r.trigger === "corner" ? CORNER_TAGS : r.trigger === "joint" ? JOINT_TAGS : PIECE_TAGS;
  const sizeLabels = r.trigger === "leaf" ? [t("rules.leafW"), t("rules.leafH")] : r.trigger === "pane" ? [t("rules.paneW"), t("rules.paneH")] : r.trigger === "piece" ? [t("rules.pieceLong"), null] : r.trigger === "chassis" ? ["L", "H"] : [null, null];
  const submit = async () => { setBusy(true); await onSave(r); setBusy(false); };

  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={purch.modalCard} style={{ maxWidth: 760, maxHeight: "92vh", overflow: "auto" }}>
        <div className={purch.sectionHeader}><h3 style={{ margin: 0 }}>{t("rules.ruleTitle")}</h3><button type="button" className="tableActionBtn" onClick={onClose}><X size={14} /></button></div>

        <div className={purch.field}>{t("rules.article")}
          {r.product ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>{r.product.name}</strong>{r.product.internalReference && <small className={s.muted}>{r.product.internalReference}</small>}
              <button type="button" className="tableActionBtn" onClick={() => set({ product: null })}><X size={12} /></button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, opacity: 0.6 }} />
              <input className={purch.input} style={{ paddingLeft: 30 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("rules.searchArticle")} autoFocus />
              {found.length > 0 && (
                <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, marginTop: 4, maxHeight: 200, overflow: "auto" }}>
                  {found.map((p) => (
                    <button key={p._id} type="button" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", background: "transparent", border: "none", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-primary)", cursor: "pointer" }}
                      onClick={() => { set({ product: p, label: r.label || p.name, ...(p.materialType === "gasket" || p.stockMode === "meter" ? { measure: "length", kind: "gasket" } : {}) }); setSearch(""); }}>
                      {p.name} <small className={s.muted}>{p.internalReference} · {p.unit}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className={purch.formGrid}>
          <label className={purch.field}>{t("rules.label")}<input style={fieldIn} value={r.label} onChange={(e) => set({ label: e.target.value })} /></label>
          <label className={purch.field}>{t("rules.group")}<input style={fieldIn} value={r.group} onChange={(e) => set({ group: e.target.value })} placeholder="Ferrure" title={t("rules.groupHint")} /></label>
        </div>

        <div className={purch.field}>{t("rules.trigger")}
          <Seg options={TRIGGERS} value={r.trigger} onChange={(v) => set({ trigger: v, tags: [] })} label={(o) => t(`rules.triggers.${o}`)} />
          <small className={s.muted}>{t(`rules.triggerHints.${r.trigger}`)}</small>
        </div>
        {["piece", "corner", "joint", "leaf"].includes(r.trigger) && codes.length > 0 && (
          <div className={purch.field}>{t("rules.codes")}<Chips options={codes} value={r.codes} onChange={(v) => set({ codes: v })} /><small className={s.muted}>{t("rules.allIfEmpty")}</small></div>
        )}
        {["piece", "corner", "joint"].includes(r.trigger) && (
          <div className={purch.field}>{t("rules.positionsFilter")}<Chips options={tagOptions} value={r.tags} onChange={(v) => set({ tags: v })} label={(o) => t(`rules.tags.${o}`)} /></div>
        )}
        {r.trigger === "leaf" && (
          <>
            <div className={purch.field}>{t("cad.opening")}<Chips options={OPENINGS} value={r.openings} onChange={(v) => set({ openings: v })} label={(o) => t(`cad.openings.${o}`)} /><small className={s.muted}>{t("rules.allIfEmpty")}</small></div>
            <div className={purch.field}>{t("rules.leafRole")}<Seg options={["any", "active", "passive"]} value={r.leafRole} onChange={(v) => set({ leafRole: v })} label={(o) => t(`rules.leafRoles.${o}`)} /></div>
          </>
        )}
        {r.trigger === "pane" && (
          <div className={purch.formGrid}>
            <div className={purch.field}>{t("cad.infill")}<Seg options={["any", "glass", "panel"]} value={r.infill} onChange={(v) => set({ infill: v })} label={(o) => (o === "any" ? t("rules.any") : t(`cad.infills.${o}`))} /></div>
            <div className={purch.field}>{t("rules.where")}<Seg options={["any", "fixed", "sash"]} value={r.where} onChange={(v) => set({ where: v })} label={(o) => t(`rules.wheres.${o}`)} /></div>
          </div>
        )}
        {(sizeLabels[0] || sizeLabels[1]) && (
          <div className={purch.formGrid}>
            {sizeLabels[0] && <label className={purch.field}>{sizeLabels[0]} min / max (mm)<span style={{ display: "flex", gap: 6 }}><input type="number" style={fieldIn} value={r.minW ?? ""} onChange={(e) => set({ minW: e.target.value })} /><input type="number" style={fieldIn} value={r.maxW ?? ""} onChange={(e) => set({ maxW: e.target.value })} /></span></label>}
            {sizeLabels[1] && <label className={purch.field}>{sizeLabels[1]} min / max (mm)<span style={{ display: "flex", gap: 6 }}><input type="number" style={fieldIn} value={r.minH ?? ""} onChange={(e) => set({ minH: e.target.value })} /><input type="number" style={fieldIn} value={r.maxH ?? ""} onChange={(e) => set({ maxH: e.target.value })} /></span></label>}
            {r.trigger === "leaf" && <label className={purch.field}>{t("rules.maxKg")}<input type="number" style={fieldIn} value={r.maxKg ?? ""} onChange={(e) => set({ maxKg: e.target.value })} /></label>}
          </div>
        )}

        <div className={purch.field}>{t("rules.measure")}<Seg options={["count", "length"]} value={r.measure} onChange={(v) => set({ measure: v, kind: v === "length" ? "gasket" : r.kind === "gasket" ? "accessory" : r.kind })} label={(o) => t(`rules.measures.${o}`)} /></div>
        <div className={purch.formGrid}>
          <label className={purch.field}>{r.measure === "length" ? t("rules.qtyPieces") : t("rules.qtyFormula")}<input style={mono} value={r.qty} onChange={(e) => set({ qty: e.target.value })} placeholder="1" /></label>
          {r.measure === "length" && <label className={purch.field}>{t("rules.lengthFormula")}<input style={mono} value={r.length} onChange={(e) => set({ length: e.target.value })} placeholder={r.trigger === "piece" ? "long" : "perim"} /></label>}
          <label className={purch.field}>{t("rules.condition")}<input style={mono} value={r.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="lh > 2000" /></label>
        </div>
        <p className={s.muted} style={{ marginTop: -4 }}>{t("rules.varsAvailable")} {VARS[r.trigger].map((v) => <code key={v} style={{ marginRight: 6 }} title={t(`rules.vars.${v}`)}>{v}</code>)} · {t("rules.varsAlso")}</p>
        <div className={purch.formGrid}>
          <label className={purch.field}>{t("rules.kind")}<CustomSelect value={r.kind} onSelect={(v) => set({ kind: v })} options={["accessory", "gasket", "consumable"].map((k) => ({ value: k, label: t(`rules.kindsArt.${k}`) }))} /></label>
          <label className={purch.field}>{t("rules.workshop")}<input style={fieldIn} value={r.workshop} onChange={(e) => set({ workshop: e.target.value.toUpperCase() })} placeholder="ALU" /></label>
          <label className={purch.field} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={r.finish === "project"} onChange={(e) => set({ finish: e.target.checked ? "project" : "none" })} /> {t("rules.followsColour")}</label>
          <label className={purch.field} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={r.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> {t("rules.active")}</label>
        </div>
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btnPrimary" disabled={!r.product || busy} onClick={submit}>{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Machining rule editor
// ------------------------------------------------------------------
function OpModal({ codes, initial, onClose, onSave }) {
  const { t } = useI18n();
  const [m, setM] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setM((x) => ({ ...x, ...patch }));
  const submit = async () => { setBusy(true); await onSave(m); setBusy(false); };
  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={purch.modalCard} style={{ maxWidth: 720, maxHeight: "92vh", overflow: "auto" }}>
        <div className={purch.sectionHeader}><h3 style={{ margin: 0 }}>{t("rules.opTitle")}</h3><button type="button" className="tableActionBtn" onClick={onClose}><X size={14} /></button></div>
        <div className={purch.formGrid}>
          <label className={purch.field}>{t("rules.opName")}<input style={fieldIn} value={m.label} onChange={(e) => set({ label: e.target.value })} placeholder="Drainage" autoFocus /></label>
          <label className={purch.field}>{t("rules.opSize")}<input style={fieldIn} value={m.size} onChange={(e) => set({ size: e.target.value })} placeholder="30 × 5" /></label>
          <label className={purch.field}>{t("rules.opTool")}<input style={fieldIn} value={m.tool} onChange={(e) => set({ tool: e.target.value })} placeholder="Fraise Ø 5" /></label>
        </div>
        <div className={purch.field}>{t("rules.opKind")}<Seg options={MACHINING_KINDS} value={m.kind} onChange={(v) => set({ kind: v })} label={(o) => t(`rules.kinds.${o}`)} /></div>
        {codes.length > 0 && <div className={purch.field}>{t("rules.codes")}<Chips options={codes} value={m.codes} onChange={(v) => set({ codes: v })} /></div>}
        <div className={purch.field}>{t("rules.positionsFilter")}<Chips options={PIECE_TAGS} value={m.tags} onChange={(v) => set({ tags: v })} label={(o) => t(`rules.tags.${o}`)} /><small className={s.muted}>{t("rules.tagsHint")}</small></div>
        <div className={purch.field}>{t("rules.openingsOnly")}<Chips options={OPENINGS} value={m.openings} onChange={(v) => set({ openings: v })} label={(o) => t(`cad.openings.${o}`)} /></div>
        <div className={purch.field}>{t("rules.face")}<Seg options={FACES} value={m.face} onChange={(v) => set({ face: v })} label={(o) => t(`rules.faces.${o || "none"}`)} /></div>
        <div className={purch.field}>{t("rules.placement")}<Seg options={PLACES} value={m.place} onChange={(v) => set({ place: v })} label={(o) => t(`rules.places.${o}`)} /><small className={s.muted}>{t(`rules.placeHints.${m.place}`)}</small></div>
        <div className={purch.formGrid}>
          {m.place !== "at" && <label className={purch.field}>{m.place === "ends" || m.place === "pitch" ? t("rules.offsetEnds") : t("rules.offsetShift")}<input style={mono} value={m.offset} onChange={(e) => set({ offset: e.target.value })} placeholder="0" /></label>}
          {m.place === "pitch" && <label className={purch.field}>{t("rules.pitch")}<input style={mono} value={m.pitch} onChange={(e) => set({ pitch: e.target.value })} placeholder="600" /></label>}
          {m.place === "at" && <label className={purch.field} style={{ gridColumn: "span 2" }}>{t("rules.atList")}<input style={mono} value={m.at} onChange={(e) => set({ at: e.target.value })} placeholder="150; long/2; -150" /></label>}
          <label className={purch.field}>{t("rules.condition")}<input style={mono} value={m.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="long > 1200" /></label>
        </div>
        <p className={s.muted} style={{ marginTop: -4 }}>{t("rules.varsAvailable")} <code>long</code> <code>lw</code> <code>lh</code> <code>poids</code> · {t("rules.varsAlso")}</p>
        <label className={purch.field} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={m.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> {t("rules.active")}</label>
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btnPrimary" disabled={!m.label.trim() || busy} onClick={submit}>{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}
