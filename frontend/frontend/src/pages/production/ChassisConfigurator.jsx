import { Boxes, Package } from "lucide-react";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import { useI18n } from "../../hooks/useI18n";
import ChassisDrawing from "./ChassisDrawing";
import { defaultParams, familyLabel, articleLabel } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import styles from "./Production.module.css";

/**
 * Chooses a chassis: model of the catalogue, width × height, colour and
 * the model's own parameters (leaves, fly screen, glass unit…).
 * Controlled: `value` = { model, ref, L, H, quantity, finish, params }.
 * Used by the devis lines and by the project ouvrages.
 */
export default function ChassisConfigurator({ value, onChange, models = [], finishes = [], articles = [], families = [], showQuantity = true, showRef = true }) {
  const { t, language } = useI18n();
  const model = models.find((m) => String(m._id) === String(value.model));
  const set = (patch) => onChange({ ...value, ...patch });
  const setParam = (key, v) => onChange({ ...value, params: { ...(value.params || {}), [key]: v } });

  const modelOptions = [...models]
    .sort((a, b) => `${a.family}${a.name}`.localeCompare(`${b.family}${b.name}`))
    .map((m) => ({ value: m._id, label: `${m.name}${m.series?.name ? ` — ${m.series.name}` : ""}`, searchText: `${m.name} ${m.code || ""} ${m.series?.name || ""} ${familyLabel(families, m.family, language)}` }));
  const finishOptions = [{ value: "", label: t("prod.noFinish") }, ...finishes.filter((f) => f.isActive !== false).map((f) => ({ value: f._id, label: `${f.code}${f.name ? ` — ${f.name}` : ""}` }))];
  const yesNo = [{ value: "0", label: t("common.no") }, { value: "1", label: t("common.yes") }];
  const params = value.params || {};
  const lim = model?.limits || {};
  const outOfLimits = model && ((lim.minL && value.L < lim.minL) || (lim.maxL && value.L > lim.maxL) || (lim.minH && value.H < lim.minH) || (lim.maxH && value.H > lim.maxH));

  return (
    <div className={styles.configurator}>
      <div>
        <div className={purch.formGrid}>
          <label className={purch.field} style={{ gridColumn: "1 / -1" }}>{t("prod.model")}
            <SearchSelect value={value.model || ""} options={modelOptions} icon={Boxes} placeholder={t("prod.pickModel")} noResultsLabel={t("common.noResults")}
              onSelect={(id) => { const m = models.find((x) => String(x._id) === String(id)); onChange({ ...value, model: id, params: defaultParams(m) }); }} />
          </label>
          {showRef && (
            <label className={purch.field}>{t("prod.ref")}
              <input className={purch.input} value={value.ref || ""} placeholder="F1" maxLength={30} onChange={(e) => set({ ref: e.target.value })} />
            </label>
          )}
          <label className={purch.field}>{t("prod.width")} (mm)
            <input className={purch.input} type="number" min="1" value={value.L ?? ""} onChange={(e) => set({ L: e.target.value === "" ? "" : Number(e.target.value) })} />
          </label>
          <label className={purch.field}>{t("prod.height")} (mm)
            <input className={purch.input} type="number" min="1" value={value.H ?? ""} onChange={(e) => set({ H: e.target.value === "" ? "" : Number(e.target.value) })} />
          </label>
          {showQuantity && (
            <label className={purch.field}>{t("prod.quantity")}
              <input className={purch.input} type="number" min="1" step="1" value={value.quantity ?? 1} onChange={(e) => set({ quantity: e.target.value === "" ? "" : Number(e.target.value) })} />
            </label>
          )}
          <label className={purch.field}>{t("prod.finish")}
            <CustomSelect value={value.finish || ""} onSelect={(v) => set({ finish: v })} options={finishOptions} />
          </label>
          {(model?.parameters || []).filter((p) => !p.fixed).map((p) => {
            const label = `${p.label || p.key}${p.unit ? ` (${p.unit})` : ""}`;
            const v = params[p.key];
            if (p.type === "boolean") return <label key={p.key} className={purch.field}>{label}<CustomSelect value={String(Number(v) ? 1 : 0)} onSelect={(x) => setParam(p.key, Number(x))} options={yesNo} /></label>;
            if (p.type === "choice") return <label key={p.key} className={purch.field}>{label}<CustomSelect value={String(v ?? p.default ?? "")} onSelect={(x) => setParam(p.key, Number(x))} options={(p.options || []).map((o) => ({ value: String(o.value), label: o.label }))} /></label>;
            if (p.type === "model") {
              const opts = models.filter((m) => String(m._id) !== String(model._id) && (!p.family || m.family === p.family)).map((m) => ({ value: m._id, label: m.name }));
              return <label key={p.key} className={purch.field}>{label}<CustomSelect value={v || ""} onSelect={(x) => setParam(p.key, x)} options={[{ value: "", label: "—" }, ...opts]} placeholder={t("prod.pickModel")} /></label>;
            }
            if (p.type === "product") {
              const opts = articles.filter((a) => !p.materialType || a.materialType === p.materialType).map((a) => ({ value: a._id, label: articleLabel(a) }));
              return <label key={p.key} className={purch.field}>{label}<SearchSelect value={v || ""} onSelect={(x) => setParam(p.key, x)} options={opts} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} /></label>;
            }
            return (
              <label key={p.key} className={purch.field}>{label}
                <input className={purch.input} type="number" step="any" min={p.min ?? undefined} max={p.max ?? undefined} value={v ?? ""} onChange={(e) => setParam(p.key, e.target.value === "" ? "" : Number(e.target.value))} />
              </label>
            );
          })}
        </div>
        {outOfLimits && <p className={styles.unmapped} style={{ fontSize: "0.78rem", margin: 0 }}>{t("prod.outOfLimits")} ({lim.minL || "–"}–{lim.maxL || "–"} × {lim.minH || "–"}–{lim.maxH || "–"} mm)</p>}
      </div>
      <div className={styles.drawing}>
        {model ? <ChassisDrawing drawing={model.drawing} image={model.image?.url} L={Number(value.L) || 1000} H={Number(value.H) || 1000} params={{ ...defaultParams(model), ...params }} /> : <Boxes size={36} style={{ opacity: 0.3 }} />}
      </div>
    </div>
  );
}
