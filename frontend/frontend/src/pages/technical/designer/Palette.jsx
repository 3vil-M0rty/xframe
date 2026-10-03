import st from "./Designer.module.css";

/** The palette item being dragged (HTML5 drag data can't be read during dragover). */
export const dragging = { current: null };

// Small drawings of each element (24 × 24)
const Icon = ({ k }) => {
  const f = <rect x="2" y="2" width="20" height="20" rx="1.5" className={st.icoFrame} />;
  const glass = <rect x="5" y="5" width="14" height="14" className={st.icoGlass} />;
  const hinge = (side) => (side === "left" ? <path d="M19 5 L5 12 L19 19" className={st.icoLine} /> : <path d="M5 5 L19 12 L5 19" className={st.icoLine} />);
  const tilt = <path d="M5 5 L12 19 L19 5" className={st.icoLine} />;
  switch (k) {
    case "frame": return <svg viewBox="0 0 24 24">{f}<rect x="5" y="5" width="14" height="14" className={st.icoJour} /></svg>;
    case "mullion": return <svg viewBox="0 0 24 24">{f}{glass}<rect x="10.5" y="5" width="3" height="14" className={st.icoBar} /></svg>;
    case "transom": return <svg viewBox="0 0 24 24">{f}{glass}<rect x="5" y="10.5" width="14" height="3" className={st.icoBar} /></svg>;
    case "fixed": return <svg viewBox="0 0 24 24">{f}{glass}<path d="M9 12 h6 M12 9 v6" className={st.icoLine} /></svg>;
    case "left": return <svg viewBox="0 0 24 24">{f}{glass}{hinge("left")}</svg>;
    case "right": return <svg viewBox="0 0 24 24">{f}{glass}{hinge("right")}</svg>;
    case "tilt-left": return <svg viewBox="0 0 24 24">{f}{glass}{hinge("left")}{tilt}</svg>;
    case "tilt-right": return <svg viewBox="0 0 24 24">{f}{glass}{hinge("right")}{tilt}</svg>;
    case "bottom": return <svg viewBox="0 0 24 24">{f}{glass}{tilt}</svg>;
    case "top": return <svg viewBox="0 0 24 24">{f}{glass}<path d="M5 19 L12 5 L19 19" className={st.icoLine} /></svg>;
    case "slide": return <svg viewBox="0 0 24 24">{f}{glass}<path d="M7 12 h10 M14 9 l3 3 l-3 3" className={st.icoLine} /></svg>;
    case "two": return <svg viewBox="0 0 24 24">{f}<rect x="5" y="5" width="6.5" height="14" className={st.icoGlass} /><rect x="12.5" y="5" width="6.5" height="14" className={st.icoGlass} /><path d="M11.5 5 L5 12 L11.5 19 M12.5 5 L19 12 L12.5 19" className={st.icoLine} /></svg>;
    case "twoTilt": return <svg viewBox="0 0 24 24">{f}<rect x="5" y="5" width="6.5" height="14" className={st.icoGlass} /><rect x="12.5" y="5" width="6.5" height="14" className={st.icoGlass} /><path d="M12.5 5 L19 12 L12.5 19 M12.5 5 L15.75 19 L19 5" className={st.icoLine} /></svg>;
    case "glass": return <svg viewBox="0 0 24 24">{f}{glass}<path d="M8 15 L15 8" className={st.icoShine} /></svg>;
    case "panel": return <svg viewBox="0 0 24 24">{f}<rect x="5" y="5" width="14" height="14" className={st.icoPanel} /></svg>;
    case "none": return <svg viewBox="0 0 24 24">{f}<rect x="5" y="5" width="14" height="14" className={st.icoJour} /><path d="M7 7 L17 17 M17 7 L7 17" className={st.icoLine} /></svg>;
    default: return <svg viewBox="0 0 24 24">{f}</svg>;
  }
};

const GROUPS = [
  { title: "Structure", items: [
    { key: "mullion", label: "Meneau", hint: "Divise verticalement là où vous le lâchez", item: { t: "mullion" } },
    { key: "transom", label: "Traverse", hint: "Divise horizontalement là où vous la lâchez", item: { t: "transom" } },
  ] },
  { title: "Ouvrants", items: [
    { key: "fixed", label: "Fixe", item: { t: "fixed" } },
    { key: "left", label: "Française G", hint: "Paumelles à gauche", item: { t: "sash", opening: "left" } },
    { key: "right", label: "Française D", hint: "Paumelles à droite", item: { t: "sash", opening: "right" } },
    { key: "tilt-left", label: "OB gauche", item: { t: "sash", opening: "tilt-left" } },
    { key: "tilt-right", label: "OB droite", item: { t: "sash", opening: "tilt-right" } },
    { key: "bottom", label: "Soufflet", item: { t: "sash", opening: "bottom" } },
    { key: "top", label: "Projetant", item: { t: "sash", opening: "top" } },
    { key: "slide", label: "Coulissant", item: { t: "sash", opening: "slide" } },
    { key: "two", label: "2 vantaux", item: { t: "sash", opening: "left", leaves: 2 } },
    { key: "twoTilt", label: "2 vantaux OB", item: { t: "sash", opening: "tilt-right", leaves: 2 } },
  ] },
  { title: "Remplissage", items: [
    { key: "glass", label: "Vitrage", item: { t: "infill", infill: "glass" } },
    { key: "panel", label: "Panneau", item: { t: "infill", infill: "panel" } },
    { key: "none", label: "Vide", item: { t: "infill", infill: "none" } },
  ] },
];

export const TEMPLATES = [
  { key: "fixed", label: "Fixe" }, { key: "ob", label: "1 vantail OB" }, { key: "two", label: "2 vantaux" },
  { key: "fixedOb", label: "Fixe + OB" }, { key: "obFixedOb", label: "OB + fixe + OB" }, { key: "imposte", label: "Imposte + 2 vantaux" },
  { key: "allege", label: "OB + allège" }, { key: "door", label: "Porte + imposte" },
];
const TEMPLATE_ICON = { fixed: "fixed", ob: "tilt-right", two: "two", fixedOb: "mullion", obFixedOb: "mullion", imposte: "transom", allege: "transom", door: "left" };

/**
 * PALETTE — drag an element onto the drawing (or click it, then click a
 * case). Gabarits replace the whole drawing, keeping its size.
 */
export default function Palette({ armed, onArm, onTemplate }) {
  const keyOf = (it) => JSON.stringify(it);
  return (
    <div className={st.palette}>
      {GROUPS.map((g) => (
        <div key={g.title} className={st.palGroup}>
          <div className={st.palTitle}>{g.title}</div>
          <div className={st.palGrid}>
            {g.items.map((x) => (
              <button key={x.key} type="button" draggable title={x.hint || x.label}
                className={`${st.palItem} ${armed && keyOf(armed) === keyOf(x.item) ? st.palArmed : ""}`}
                onDragStart={(e) => { dragging.current = x.item; e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", x.label); onArm(null); }}
                onDragEnd={() => { dragging.current = null; }}
                onClick={() => onArm(armed && keyOf(armed) === keyOf(x.item) ? null : x.item)}>
                <Icon k={x.key} />
                <span>{x.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className={st.palGroup}>
        <div className={st.palTitle}>Gabarits</div>
        <div className={st.palGrid}>
          {TEMPLATES.map((x) => (
            <button key={x.key} type="button" className={st.palItem} onClick={() => onTemplate(x.key)} title="Remplace le dessin (la taille est gardée)">
              <Icon k={TEMPLATE_ICON[x.key]} />
              <span>{x.label}</span>
            </button>
          ))}
        </div>
      </div>
      <p className={st.palHint}>Glissez un élément sur une case, ou cliquez-le puis cliquez la case. Déplacez les meneaux et les bords du dormant à la souris ; cliquez une cote pour la saisir. Suppr : retirer l'élément sélectionné · Ctrl+Z : annuler.</p>
    </div>
  );
}
