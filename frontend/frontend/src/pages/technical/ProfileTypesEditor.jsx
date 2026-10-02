import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import styles from "../production/Production.module.css";
import s from "../sales/Sales.module.css";

// Usual profile types of an aluminium series — one click adds the row.
const PRESETS = ["Dormant", "Ouvrant", "Ouvrant porte", "Traverse", "Meneau", "Battement", "Parclose", "Rail", "Montant", "Seuil"];
const NUM_FIELDS = ["ch", "ae", "ai", "lp", "barLength", "weightPerMeter", "perimeter"];

const slug = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const emptyRow = (label = "") => ({ key: "", label, keywords: "", ch: "", ae: "", ai: "", lp: "", barLength: "", weightPerMeter: "", perimeter: "" });

/** Series profile types ↔ form rows (numbers as strings, keywords as "a, b"). */
export const typesToForm = (types = []) => types.map((t) => ({
  ...emptyRow(),
  ...Object.fromEntries(NUM_FIELDS.map((f) => [f, t[f] ?? ""])),
  key: t.key, label: t.label, keywords: (t.keywords || []).join(", "),
}));
export const typesFromForm = (rows = []) => rows.filter((r) => r.label.trim()).map((r) => ({
  key: r.key || undefined,
  label: r.label.trim(),
  keywords: r.keywords.split(",").map((k) => k.trim()).filter(Boolean),
  ...Object.fromEntries(NUM_FIELDS.map((f) => [f, r[f] === "" ? null : Number(r[f])])),
}));

/**
 * Profile types of a series: the geometry shared by all its ouvrants,
 * dormants… Typed once here, given to every article attached to the type
 * (Technique › Données techniques). counts = { typeKey: number of articles }.
 */
export default function ProfileTypesEditor({ rows, onChange, counts = {} }) {
  const { t } = useI18n();
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const present = new Set(rows.map((r) => slug(r.label)));
  const height = (r) => (["ch", "ae", "ai"].some((f) => r[f] !== "") ? ["ch", "ae", "ai"].reduce((a, f) => a + (Number(r[f]) || 0), 0) : "");
  const numInput = (r, i, f, w = 62) => (
    <input type="number" min="0" step="any" value={r[f]} onChange={(e) => set(i, { [f]: e.target.value })}
      style={{ width: w, padding: "5px 6px", fontSize: "0.8rem" }} aria-label={t(`ptypes.fields.${f}`)} />
  );

  return (
    <div>
      <div className={styles.chips} style={{ marginBottom: 8 }}>
        {PRESETS.filter((p) => !present.has(slug(p))).map((p) => (
          <button key={p} type="button" className={styles.chip} onClick={() => onChange([...rows, emptyRow(p)])}><Plus size={11} /> {p}</button>
        ))}
        <button type="button" className={styles.chip} onClick={() => onChange([...rows, emptyRow("")])}><Plus size={11} /> {t("ptypes.other")}</button>
      </div>
      {rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.needTable}>
            <thead>
              <tr>
                <th>{t("ptypes.type")}</th>
                <th className={styles.num} title={t("ptypes.fields.ch")}>ch</th>
                <th className={styles.num} title={t("ptypes.fields.ae")}>ae</th>
                <th className={styles.num} title={t("ptypes.fields.ai")}>ai</th>
                <th className={styles.num} title={t("ptypes.fields.hp")}>hp</th>
                <th className={styles.num} title={t("ptypes.fields.lp")}>lp</th>
                <th className={styles.num}>{t("ptypes.fields.barLength")}</th>
                <th className={styles.num}>{t("ptypes.fields.weightPerMeter")}</th>
                <th className={styles.num}>{t("ptypes.fields.perimeter")}</th>
                <th>{t("ptypes.keywords")}</th>
                <th className={styles.num}>{t("ptypes.articles")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key || `new-${i}`}>
                  <td><input value={r.label} required onChange={(e) => set(i, { label: e.target.value })} placeholder="Ouvrant" style={{ width: 130, padding: "5px 6px", fontSize: "0.8rem" }} /></td>
                  <td className={styles.num}>{numInput(r, i, "ch")}</td>
                  <td className={styles.num}>{numInput(r, i, "ae")}</td>
                  <td className={styles.num}>{numInput(r, i, "ai")}</td>
                  <td className={styles.num}><strong>{height(r)}</strong></td>
                  <td className={styles.num}>{numInput(r, i, "lp")}</td>
                  <td className={styles.num}>{numInput(r, i, "barLength", 72)}</td>
                  <td className={styles.num}>{numInput(r, i, "weightPerMeter")}</td>
                  <td className={styles.num}>{numInput(r, i, "perimeter")}</td>
                  <td><input value={r.keywords} onChange={(e) => set(i, { keywords: e.target.value })} placeholder={t("ptypes.keywordsPlaceholder")} style={{ width: 130, padding: "5px 6px", fontSize: "0.8rem" }} /></td>
                  <td className={styles.num}>{r.key ? counts[r.key] || 0 : "—"}</td>
                  <td><button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={s.muted} style={{ fontSize: "0.76rem", marginTop: 6 }}>{t("ptypes.legend")}</p>
    </div>
  );
}
