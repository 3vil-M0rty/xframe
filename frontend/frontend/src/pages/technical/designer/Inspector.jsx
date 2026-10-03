import { Columns2, Rows2, Trash2, Plus, Minus, MousePointerClick } from "lucide-react";
import { useI18n } from "../../../hooks/useI18n";
import CustomSelect from "../../../components/useful/CustomSelect";
import { findNode, updateNode, splitCell, unsplit, pickCode, newCell, newId } from "./designTree";
import SectionViewer from "../../../components/dxf/SectionViewer";
import st from "./Designer.module.css";

const OPENINGS = ["left", "right", "tilt-left", "tilt-right", "bottom", "top", "slide"];

/**
 * Properties of the selected element of the CAD: frame, cell (fixed /
 * sash, opening, infill, profiles, split into meneaux / traverses) or a
 * split (profile, sizes of its parts).
 */
/** The DXF section of the chosen profile, with its dimensions. */
function ProfilePeek({ code, sectionByCode }) {
  const sec = sectionByCode?.get(code);
  if (!code) return <p className={st.muted} style={{ marginTop: 6 }}>Profilé pas encore attribué (étape 2 · Profilés).</p>;
  return (
    <div className={st.inspectorSection}>
      {sec ? <SectionViewer section={sec} height={150} title={code} /> : <p className={st.muted}>{code} : pas encore de coupe DXF (fiche profilé).</p>}
    </div>
  );
}

export default function Inspector({ design, selected, library, onChange, onSelect, sectionByCode }) {
  const { t } = useI18n();
  const codes = library.map((p) => p.code);
  // "" = the profile attributed to the role (step Profilés)
  const codeOptions = (allowNone = "— profilé de l'étape Profilés —") => [
    { value: "", label: allowNone },
    ...library.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
  ];
  const setRoot = (root) => onChange({ ...design, root });
  const patchNode = (id, patch) => setRoot(updateNode(design.root, id, (n) => ({ ...n, ...patch })));

  if (!selected) {
    return <div className={st.inspectorEmpty}><MousePointerClick size={18} /> {t("cad.selectHint")}</div>;
  }

  if (selected === "frame") {
    return (
      <div className={st.inspector}>
        <h4>{t("cad.frame")}</h4>
        <label className={st.prop}>{t("cad.profile")}<CustomSelect value={design.frame.code} onSelect={(v) => onChange({ ...design, frame: { ...design.frame, code: v } })} options={codeOptions()} /></label>
        <ProfilePeek code={design.frame.code || design.profiles?.frame} sectionByCode={sectionByCode} />
        <div className={st.prop}>{t("cad.joint")}
          <div className={st.seg}>
            {["45", "90"].map((j) => <button key={j} type="button" className={design.frame.joint === j ? st.segOn : ""} onClick={() => onChange({ ...design, frame: { ...design.frame, joint: j } })}>{j}°</button>)}
          </div>
        </div>

        <p className={st.muted}>{t("cad.frameHint")}</p>
      </div>
    );
  }

  const hit = findNode(design.root, selected);
  if (!hit) return null;
  const { node, parent, index } = hit;

  if (node.kind === "split") {
    const v = node.dir === "v";
    const setPart = (i, size) => patchNode(node.id, { parts: node.parts.map((p, j) => (j === i ? { ...p, size: size === "" ? null : Number(size) } : p)) });
    return (
      <div className={st.inspector}>
        <h4>{v ? t("cad.mullions") : t("cad.transoms")}</h4>
        <label className={st.prop}>{t("cad.profile")}<CustomSelect value={node.code} onSelect={(c) => patchNode(node.id, { code: c })} options={codeOptions()} /></label>
        <ProfilePeek code={node.code || (node.dir === "h" ? design.profiles?.transom || design.profiles?.mullion : design.profiles?.mullion)} sectionByCode={sectionByCode} />
        <div className={st.prop}>{v ? t("cad.partWidths") : t("cad.partHeights")}
          {node.parts.map((p, i) => (
            <div key={p.node.id} className={st.partRow}>
              <button type="button" className={st.linkBtn} onClick={() => onSelect(p.node.id)}>{t("cad.part")} {i + 1}</button>
              <input type="number" min="1" step="1" placeholder={t("cad.auto")} value={p.size ?? ""} onChange={(e) => setPart(i, e.target.value)} />
              <span className={st.muted}>mm</span>
            </div>
          ))}
          <small className={st.muted}>{t("cad.partHint")}</small>
        </div>
        <div className={st.actions}>
          <button type="button" className="btnEdit" disabled={node.parts.length >= 8} onClick={() => patchNode(node.id, { parts: [...node.parts, { size: null, node: newCell() }] })}><Plus size={13} /> {t("cad.addPart")}</button>
          <button type="button" className="btnEdit" disabled={node.parts.length <= 2} onClick={() => patchNode(node.id, { parts: node.parts.slice(0, -1) })}><Minus size={13} /> {t("cad.removePart")}</button>
        </div>
        <button type="button" className="btnDelete" onClick={() => { setRoot(unsplit(design.root, node.id)); onSelect(null); }}><Trash2 size={13} /> {t("cad.removeSplit")}</button>
      </div>
    );
  }

  // ---------- cell ----------
  const sash = node.sash;
  const type = node.fill === "sash" ? (sash?.leaves === 2 ? "sash2" : "sash1") : "fixed";
  const setType = (tp) => {
    if (tp === "fixed") return patchNode(node.id, { fill: "fixed", sash: undefined });
    const base = sash || { code: "", opening: "left", meetingCode: "", overlap: "", glass: "", clear: "", meeting: "" };
    return patchNode(node.id, { fill: "sash", sash: { ...base, leaves: tp === "sash2" ? 2 : 1 } });
  };
  const setSash = (patch) => patchNode(node.id, { sash: { ...sash, ...patch } });
  const split = (dir, n) => {
    const sid = newId();
    setRoot(splitCell(design.root, node.id, dir, n, "", sid));
    onSelect(sid);
  };
  return (
    <div className={st.inspector}>
      <h4>{t("cad.cell")}</h4>
      {parent && (
        <div className={st.partRow} style={{ marginBottom: 6 }}>
          <button type="button" className={st.linkBtn} onClick={() => onSelect(parent.id)}>{parent.dir === "v" ? t("cad.mullions") : t("cad.transoms")} · {t("cad.part")} {index + 1}</button>
          <input type="number" min="1" placeholder={t("cad.auto")} value={parent.parts[index].size ?? ""} title={parent.dir === "v" ? t("cad.partWidths") : t("cad.partHeights")}
            onChange={(e) => patchNode(parent.id, { parts: parent.parts.map((p, j) => (j === index ? { ...p, size: e.target.value === "" ? null : Number(e.target.value) } : p)) })} />
          <span className={st.muted}>mm</span>
        </div>
      )}
      <div className={st.prop}>{t("cad.cellType")}
        <div className={st.seg}>
          {["fixed", "sash1", "sash2"].map((tp) => <button key={tp} type="button" className={type === tp ? st.segOn : ""} onClick={() => setType(tp)}>{t(`cad.types.${tp}`)}</button>)}
        </div>
      </div>
      {sash && (
        <>
          <div className={st.prop}>{t("cad.opening")}
            <div className={st.seg} style={{ flexWrap: "wrap" }}>
              {OPENINGS.map((o) => <button key={o} type="button" className={sash.opening === o ? st.segOn : ""} onClick={() => setSash({ opening: o })}>{t(`cad.openings.${o}`)}</button>)}
            </div>
          </div>
          <label className={st.prop}>{t("cad.sashProfile")}<CustomSelect value={sash.code} onSelect={(v) => setSash({ code: v })} options={codeOptions()} /></label>
          <ProfilePeek code={sash.code || design.profiles?.sash} sectionByCode={sectionByCode} />
          {sash.leaves === 2 && <label className={st.prop}>{t("cad.meetingProfile")}<CustomSelect value={sash.meetingCode || ""} onSelect={(v) => setSash({ meetingCode: v })} options={codeOptions(t("cad.none"))} /></label>}
        </>
      )}
      <div className={st.prop}>{t("cad.infill")}
        <div className={st.seg}>
          {["glass", "panel", "none"].map((f) => <button key={f} type="button" className={node.infill === f ? st.segOn : ""} onClick={() => patchNode(node.id, { infill: f })}>{t(`cad.infills.${f}`)}</button>)}
        </div>
      </div>
      {node.infill !== "none" && (
        <label className={st.prop}>{t("cad.bead")}<CustomSelect value={node.beadCode || ""} onSelect={(v) => patchNode(node.id, { beadCode: v })} options={codeOptions(`${t("cad.beadSame")} (${design.beadCode || t("cad.none")})`)} /></label>
      )}
      <div className={st.prop}>{t("cad.divide")}
        <div className={st.actions}>
          {[2, 3, 4].map((n) => <button key={`v${n}`} type="button" className="btnEdit" onClick={() => split("v", n)} title={t("cad.splitV")}><Columns2 size={13} /> {n}</button>)}
          {[2, 3].map((n) => <button key={`h${n}`} type="button" className="btnEdit" onClick={() => split("h", n)} title={t("cad.splitH")}><Rows2 size={13} /> {n}</button>)}
        </div>
        <small className={st.muted}>{t("cad.divideHint")}</small>
      </div>
    </div>
  );
}
