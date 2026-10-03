import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionViewer from "../../components/dxf/SectionViewer";
import DxfImportModal from "../../components/dxf/DxfImportModal";
import { getSection } from "../../services/productionService";
import CustomSelect from "../../components/useful/CustomSelect";
import { useI18n } from "../../hooks/useI18n";
import { MATERIAL_TYPES, STOCK_MODES } from "./prodShared";

export const TECH_KEYS = ["materialType", "stockMode", "barLength", "profileChamber", "profileOuterFin", "profileInnerFin", "profileWidth", "sheetWidth", "sheetHeight", "packSize", "weightPerMeter", "perimeter", "paintSurface", "powderPerUnit", "coverage", "thickness"];

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

/** Article fields → form values (strings) and back (with its series + code). */
export const techToForm = (p = {}) => ({
  ...Object.fromEntries(TECH_KEYS.map((k) => [k, p[k] ?? (k === "stockMode" ? "unit" : "")])),
  profileSeries: idOf(p.profileSeries), seriesCode: p.seriesCode || "",
});
export const techFromForm = (f = {}) => ({
  ...Object.fromEntries(TECH_KEYS.map((k) => [k, ["materialType", "stockMode"].includes(k) ? f[k] || (k === "stockMode" ? "unit" : null) : f[k] === "" || f[k] === undefined ? null : Number(f[k])])),
  // a profile of a series (bibliothèque): its series and its code (DOR, OUV…)
  ...(f.materialType === "profile" ? { profileSeries: f.profileSeries || null, seriesCode: f.profileSeries ? f.seriesCode || null : null } : {}),
});

/**
 * Technical data of an inventory article for the aluminium catalogue:
 * what it is (profile, glass, powder…), how it is stocked (bars, m, m²,
 * sheets, units, kg) and the sizes the formulas need.
 */
/** The DXF section of a saved profile article: thumbnail + import (inventory form). */
function SectionBlock({ productId, productName, onApplied }) {
  const [section, setSection] = useState(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { getSection(productId).then(setSection).catch(() => setSection(null)); }, [productId]);
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center", padding: 10, border: "1px dashed var(--color-border)", borderRadius: 10 }}>
      <div style={{ width: 120, height: 80 }}>{section ? <SectionViewer section={section} mini height={80} /> : <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>{section === null ? "Pas de coupe DXF" : "…"}</span>}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <strong style={{ fontSize: "0.85rem" }}>Coupe DXF du profilé</strong>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>Largeur, profondeur, poids au mètre et périmètre sont lus sur le DXF ; le CAD et les nœuds dessinent le profilé avec.</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btnEdit" onClick={() => setOpen(true)}>{section ? "Remplacer le DXF" : "Importer le DXF"}</button>
          <Link to={`/technical/profiles/${productId}`} style={{ fontSize: "0.8rem", alignSelf: "center" }}>Fiche profilé →</Link>
        </div>
      </div>
      {open && <DxfImportModal productId={productId} productName={productName} onClose={() => setOpen(false)} onDone={(r) => { setOpen(false); setSection(r.section); onApplied?.(r.product); }} />}
    </div>
  );
}

export default function ProductTechFields({ value, onChange, fieldClass, inputClass, gridClass, seriesOptions = [], productId = null, productName = "" }) {
  const { t } = useI18n();
  const set = (k, v) => onChange({ ...value, [k]: v });
  const num = (k, unit) => (
    <div className={fieldClass} key={k}>
      <label>{t(`prod.tech.${k}`)}{unit ? ` (${unit})` : ""}</label>
      <input type="number" min="0" step="any" className={inputClass} value={value[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  const type = value.materialType || "";
  const mode = value.stockMode || "unit";
  return (
    <div className={gridClass}>
      <div className={fieldClass}>
        <label>{t("prod.tech.materialType")}</label>
        <CustomSelect value={type} onSelect={(v) => onChange({ ...value, materialType: v, ...(v === "profile" && mode === "unit" ? { stockMode: "bar" } : {}), ...(v === "glass" && mode === "unit" ? { stockMode: "m2" } : {}), ...(v === "powder" && mode === "unit" ? { stockMode: "kg" } : {}) })}
          options={[{ value: "", label: t("prod.tech.none") }, ...MATERIAL_TYPES.map((m) => ({ value: m, label: t(`prod.materialTypes.${m}`) }))]} />
      </div>
      <div className={fieldClass}>
        <label>{t("prod.tech.stockMode")}</label>
        <CustomSelect value={mode} onSelect={(v) => set("stockMode", v)} options={STOCK_MODES.map((m) => ({ value: m, label: t(`prod.stockModes.${m}`) }))} />
      </div>
      {type === "profile" && (
        <div className={fieldClass}>
          <label>{t("slib.seriesField")}</label>
          <CustomSelect value={value.profileSeries || ""} onSelect={(v) => onChange({ ...value, profileSeries: v })}
            options={[{ value: "", label: t("slib.noSeries") }, ...seriesOptions]} />
        </div>
      )}
      {type === "profile" && value.profileSeries && (
        <div className={fieldClass}>
          <label title={t("slib.codeHint")}>{t("slib.codeField")}</label>
          <input className={inputClass} value={value.seriesCode || ""} placeholder="DOR, OUV, PAR…" style={{ fontFamily: "monospace", fontWeight: 700 }}
            onChange={(e) => set("seriesCode", e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} />
        </div>
      )}
      {type === "profile" && productId && (
        <SectionBlock productId={productId} productName={productName}
          onApplied={(fields) => onChange({ ...value, ...Object.fromEntries(Object.entries(fields || {}).filter(([k]) => ["profileHeight", "profileWidth", "weightPerMeter", "perimeter"].includes(k)).map(([k, v]) => [k, v ?? ""])) })} />
      )}
      {mode === "bar" && num("barLength", "mm")}
      {mode === "sheet" && num("sheetWidth", "mm")}
      {mode === "sheet" && num("sheetHeight", "mm")}
      {mode === "unit" && num("packSize", t("prod.tech.packUnit"))}
      {type === "profile" && num("profileChamber", "mm")}
      {type === "profile" && num("profileOuterFin", "mm")}
      {type === "profile" && num("profileInnerFin", "mm")}
      {type === "profile" && (
        <div className={fieldClass}>
          <label>{t("prod.tech.profileHeight")} (mm)</label>
          <input className={inputClass} readOnly tabIndex={-1} value={["profileChamber", "profileOuterFin", "profileInnerFin"].some((k) => value[k] !== "" && value[k] !== undefined && value[k] !== null) ? ["profileChamber", "profileOuterFin", "profileInnerFin"].reduce((a, k) => a + (Number(value[k]) || 0), 0) : ""} placeholder="= chambre + ailettes" />
        </div>
      )}
      {type === "profile" && num("profileWidth", "mm")}
      {(type === "profile" || mode === "kg") && num("weightPerMeter", "kg/m")}
      {(type === "profile" || type === "panel") && num("perimeter", "mm")}
      {(type === "profile" || type === "panel") && num("paintSurface", "m²")}
      {(type === "profile" || type === "panel") && num("powderPerUnit", "kg")}
      {type === "powder" && num("coverage", "kg/m²")}
      {(type === "glass" || type === "panel") && num("thickness", "mm")}
    </div>
  );
}
