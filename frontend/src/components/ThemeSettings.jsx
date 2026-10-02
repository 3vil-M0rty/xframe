import { Moon, Sun, Building2 } from "lucide-react";
import { useI18n } from "../hooks/useI18n";
import { useTheme } from "../hooks/useTheme";
import styles from "./ThemeSettings.module.css";

/**
 * Profile → "Apparence": the user picks dark, light, or the company's
 * default (Entreprise → "Thème sombre"). Saved on the account.
 */
export default function ThemeSettings() {
  const { t } = useI18n();
  const { theme, preference, companyTheme, setPreference } = useTheme();

  const options = [
    { value: null, icon: <Building2 size={15} />, label: t("theme.company"), hint: t(`theme.${companyTheme}`) },
    { value: "dark", icon: <Moon size={15} />, label: t("theme.dark") },
    { value: "light", icon: <Sun size={15} />, label: t("theme.light") },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        <h3>{t("theme.title")}</h3>
      </div>
      <p className={styles.hint}>{t("theme.hint")}</p>
      <div className={styles.segment} role="radiogroup" aria-label={t("theme.title")}>
        {options.map((o) => {
          const active = (preference || null) === o.value;
          return (
            <button key={String(o.value)} type="button" role="radio" aria-checked={active}
              className={`${styles.option} ${active ? styles.optionActive : ""}`}
              onClick={() => setPreference(o.value)}>
              {o.icon}
              <span>{o.label}</span>
              {o.hint && <small>({o.hint.toLowerCase()})</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
