import { Link } from "react-router-dom";
import { WandSparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import SectionViewer from "../../../components/dxf/SectionViewer";
import CustomSelect from "../../../components/useful/CustomSelect";
import { rolesOf, allNodes } from "./designTree";
import st from "./Designer.module.css";

const ROLE_INFO = {
  frame: { label: "Dormant", hint: "Le cadre extérieur", roles: ["frame"] },
  sash: { label: "Ouvrant", hint: "Tous les vantaux", roles: ["sash"] },
  mullion: { label: "Meneau", hint: "Les divisions verticales", roles: ["mullion"] },
  transom: { label: "Traverse", hint: "Les divisions horizontales (vide = comme le meneau)", roles: ["mullion"] },
  bead: { label: "Parclose", hint: "Tient les vitrages et panneaux", roles: ["bead"] },
  meeting: { label: "Battement", hint: "Entre deux vantaux (facultatif)", roles: ["meeting"] },
};
const OPTIONAL = new Set(["transom", "bead", "meeting"]);

/**
 * STEP 2 — PROFILÉS: the drawing is done, attribute a profile of the
 * series to each kind of element (dormant, ouvrant, meneau, parclose…).
 * One choice per role; an element can still get its own profile in the
 * inspector. "Attribuer automatiquement" takes the first profile of each role.
 */
export default function ProfilesStep({ design, onChange, library, sectionByCode, seriesId }) {
  const ORDER = ["frame", "sash", "mullion", "transom", "bead", "meeting"];
  const roles = rolesOf(design).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const profiles = design.profiles || {};
  const set = (role, code) => onChange({ ...design, profiles: { ...profiles, [role]: code } });
  const optionsFor = (role) => {
    const wanted = ROLE_INFO[role].roles;
    const pref = library.filter((p) => wanted.includes(p.role));
    const rest = library.filter((p) => !wanted.includes(p.role));
    return [{ value: "", label: OPTIONAL.has(role) ? (role === "transom" ? "— comme le meneau —" : "— aucun —") : "— à choisir —" }, ...[...pref, ...rest].map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` }))];
  };
  const auto = () => {
    const next = { ...profiles };
    for (const r of roles) {
      if (next[r] || r === "transom") continue;
      const hit = library.find((p) => ROLE_INFO[r].roles.includes(p.role));
      if (hit) next[r] = hit.code;
    }
    onChange({ ...design, profiles: next });
  };
  const overrides = design.root ? allNodes(design.root).filter((n) => (n.kind === "split" && n.code) || (n.sash && n.sash.code) || n.beadCode).length + (design.frame.code ? 1 : 0) : 0;
  const clearOverrides = () => {
    const strip = (n) => (n.kind === "split" ? { ...n, code: "", parts: n.parts.map((p) => ({ ...p, node: strip(p.node) })) } : { ...n, beadCode: "", ...(n.sash ? { sash: { ...n.sash, code: "", meetingCode: "" } } : {}) });
    onChange({ ...design, frame: { ...design.frame, code: "" }, beadCode: "", root: strip(design.root) });
  };
  const missing = roles.filter((r) => !OPTIONAL.has(r) && !profiles[r]);
  const noRoles = library.length > 0 && library.every((p) => !p.role || p.role === "other");

  return (
    <div className={st.profilesStep}>
      <div className={st.profilesHead}>
        <div>
          <h3 className={st.h3} style={{ margin: 0 }}>Profilés du châssis</h3>
          <p className={st.muted} style={{ margin: "4px 0 0" }}>Un profilé de la série pour chaque type d'élément du dessin. Les cotes de débit viennent ensuite des nœuds de la série.</p>
        </div>
        <button type="button" className="btnPrimary" onClick={auto}><WandSparkles size={14} /> Attribuer automatiquement</button>
      </div>
      {missing.length > 0
        ? <div className={st.warnBanner}><AlertTriangle size={14} /> À attribuer : {missing.map((r) => ROLE_INFO[r].label).join(", ")}</div>
        : <div className={st.notice}><CheckCircle2 size={14} /> Tous les éléments ont un profilé : le débit, les coupes et la fabrication sont calculés.</div>}
      {noRoles && <div className={st.warnBanner}><AlertTriangle size={14} /> Les profilés de la série n'ont pas encore de rôle (dormant, ouvrant…) : <Link to={`/technical/series/${seriesId}`}>donnez-leur un rôle</Link> pour l'attribution automatique.</div>}
      <div className={st.roleGrid}>
        {roles.map((r) => {
          const code = profiles[r] || "";
          const shown = code || (r === "transom" ? profiles.mullion : "");
          return (
            <div key={r} className={`${st.roleCard} ${!code && !OPTIONAL.has(r) ? st.roleMissing : ""}`}>
              <div className={st.roleHead}><strong>{ROLE_INFO[r].label}</strong><span className={st.muted}>{ROLE_INFO[r].hint}</span></div>
              <CustomSelect value={code} onSelect={(v) => set(r, v)} options={optionsFor(r)} />
              <div className={st.roleThumb}>
                {shown && sectionByCode.get(shown) ? <SectionViewer section={sectionByCode.get(shown)} height={150} title={shown} /> : <span className={st.muted}>{shown ? `${shown} : pas de coupe DXF` : "Aucun profilé"}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {overrides > 0 && (
        <p className={st.muted}>{overrides} élément(s) ont leur propre profilé (choisi dans l'inspecteur). <button type="button" className={st.linkBtn} onClick={clearOverrides}>Tout ramener aux profilés ci-dessus</button></p>
      )}
    </div>
  );
}
