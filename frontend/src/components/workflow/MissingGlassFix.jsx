import { useEffect, useState } from "react";
import { AlertTriangle, Layers } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import CustomSelect from "../useful/CustomSelect";
import { getGlassTypes, getChassisModels, updateProjectItem } from "../../services/productionService";
import purch from "../../pages/purchasing/Purchasing.module.css";
import s from "../../pages/sales/Sales.module.css";

/**
 * Chassis without a glass unit chosen produce NO glazing work. Lists them
 * and sets one glass composition / glass model on all of them at once.
 * missing = [{ item, ref, model, quantity, param, label }] (API: missingGlass)
 */
export default function MissingGlassFix({ project, missing, canEdit, onFixed, compact = false }) {
  const { t } = useI18n();
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!missing?.length || !canEdit) return;
    Promise.all([getGlassTypes(project.company, { active: "true" }).catch(() => []), getChassisModels({ companyId: project.company, family: "vitrage" }).catch(() => [])])
      .then(([gt, ms]) => setOptions([
        ...gt.map((g) => ({ value: g._id, label: `${t("glazing.composition")} ${g.name}` })),
        ...ms.filter((m) => m.family === "vitrage").map((m) => ({ value: m._id, label: m.name })),
      ]));
  }, [missing?.length, canEdit, project.company, t]);
  if (!missing?.length) return null;
  const count = missing.reduce((a, m) => a + (m.quantity || 1), 0);
  const apply = async () => {
    setBusy(true);
    setError("");
    try {
      for (const m of missing) {
        const item = (project.items || []).find((i) => String(i._id) === String(m.item));
        if (!item) continue;
        await updateProjectItem(project._id, m.item, { params: { ...(item.params || {}), [m.param]: value } });
      }
      onFixed?.();
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); } finally { setBusy(false); }
  };
  return (
    <div className={purch.infoBanner} style={{ borderColor: "var(--color-warning)", display: "block" }}>
      <strong><AlertTriangle size={14} className={s.warn} /> {t("glassFix.title").replace("{n}", count)}</strong>
      <div className={s.muted} style={{ fontSize: "0.8rem", margin: "4px 0 6px" }}>
        {t("glassFix.hint")} {missing.map((m) => `${m.ref || "?"} (${m.model})`).join(", ")}
      </div>
      {canEdit && !compact && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ minWidth: 260 }}><CustomSelect value={value} onSelect={setValue} options={options} placeholder={t("glassFix.pick")} /></div>
          <button type="button" className="btnPrimary" disabled={!value || busy} onClick={apply}><Layers size={14} /> {t("glassFix.apply").replace("{n}", count)}</button>
          {!options.length && <span className={s.muted}>{t("glassFix.none")}</span>}
        </div>
      )}
      {error && <div className="errorMessage" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
