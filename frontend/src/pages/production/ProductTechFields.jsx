import CustomSelect from "../../components/useful/CustomSelect";
import { useI18n } from "../../hooks/useI18n";
import { MATERIAL_TYPES, STOCK_MODES } from "./prodShared";

export const TECH_KEYS = ["materialType", "stockMode", "barLength", "profileChamber", "profileOuterFin", "profileInnerFin", "profileWidth", "sheetWidth", "sheetHeight", "packSize", "weightPerMeter", "perimeter", "paintSurface", "powderPerUnit", "coverage", "thickness"];

/** Article fields → form values (strings) and back. */
export const techToForm = (p = {}) => Object.fromEntries(TECH_KEYS.map((k) => [k, p[k] ?? (k === "stockMode" ? "unit" : "")]));
export const techFromForm = (f = {}) => Object.fromEntries(TECH_KEYS.map((k) => [k, ["materialType", "stockMode"].includes(k) ? f[k] || (k === "stockMode" ? "unit" : null) : f[k] === "" || f[k] === undefined ? null : Number(f[k])]));

/**
 * Technical data of an inventory article for the aluminium catalogue:
 * what it is (profile, glass, powder…), how it is stocked (bars, m, m²,
 * sheets, units, kg) and the sizes the formulas need.
 */
export default function ProductTechFields({ value, onChange, fieldClass, inputClass, gridClass }) {
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
