import { useEffect, useState } from "react";
import { Languages, X, Check, Loader2, Sparkles, AlertTriangle } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { CONTENT_LANGUAGES, CONTENT_LANGUAGE_LABELS } from "../../config/contentLanguages";
import {
  getContentTranslations,
  updateContentTranslation,
  regenerateContentTranslation,
} from "../../services/contentTranslationService";

import styles from "./TranslationEditorModal.module.css";

/**
 * Generic translations editor for any resource made translatable on
 * the backend (see backend/plugins/translatable.js). Works for any
 * model/field combination — callers just point it at a resource:
 *
 *   <TranslationEditorModal
 *     isOpen={showTranslations}
 *     onClose={() => setShowTranslations(false)}
 *     resourceType="product"
 *     resourceId={product._id}
 *     fields={[{ key: "name", label: t("inventory.fields.name") }]}
 *     onSaved={(field, bucket) => { ...update local list state... }}
 *   />
 *
 * Fetches the current translations once on open, lets the user edit
 * or regenerate any field/language cell, and reports each successful
 * change back via `onSaved` so the caller can patch its already-
 * loaded list/detail state (no full reload needed, and the language
 * switcher elsewhere in the app reflects the change immediately).
 */
export default function TranslationEditorModal({
  isOpen,
  onClose,
  resourceType,
  resourceId,
  fields, // [{ key, label }]
  onSaved,
}) {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [translations, setTranslations] = useState({});
  const [drafts, setDrafts] = useState({}); // `${field}:${lang}` -> string
  const [savingKey, setSavingKey] = useState(null);
  const [regeneratingKey, setRegeneratingKey] = useState(null);
  const [rowError, setRowError] = useState({}); // `${field}:${lang}` -> message

  useEffect(() => {
    if (!isOpen || !resourceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await getContentTranslations(resourceType, resourceId);
        if (cancelled) return;
        setTranslations(data.translations || {});
        const nextDrafts = {};
        Object.entries(data.translations || {}).forEach(([field, bucket]) => {
          CONTENT_LANGUAGES.forEach((lang) => {
            nextDrafts[`${field}:${lang}`] = bucket[lang] || "";
          });
        });
        setDrafts(nextDrafts);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.response?.data?.message || t("contentTranslation.errors.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, resourceId, resourceType, t]);

  if (!isOpen) return null;

  const keyOf = (field, lang) => `${field}:${lang}`;

  const isDirty = (field, lang) => {
    const bucket = translations[field] || {};
    return (drafts[keyOf(field, lang)] || "") !== (bucket[lang] || "");
  };

  const handleSave = async (field, lang) => {
    const key = keyOf(field, lang);
    setSavingKey(key);
    setRowError((prev) => ({ ...prev, [key]: "" }));
    try {
      const bucket = await updateContentTranslation(resourceType, resourceId, field, lang, drafts[key] || "");
      setTranslations((prev) => ({ ...prev, [field]: bucket }));
      onSaved?.(field, bucket);
    } catch (error) {
      setRowError((prev) => ({ ...prev, [key]: error.response?.data?.message || t("contentTranslation.errors.saveFailed") }));
    } finally {
      setSavingKey(null);
    }
  };

  const handleRegenerate = async (field, lang) => {
    const key = keyOf(field, lang);
    setRegeneratingKey(key);
    setRowError((prev) => ({ ...prev, [key]: "" }));
    try {
      const bucket = await regenerateContentTranslation(resourceType, resourceId, field, lang);
      setTranslations((prev) => ({ ...prev, [field]: bucket }));
      setDrafts((prev) => ({ ...prev, [key]: bucket[lang] || "" }));
      onSaved?.(field, bucket);
    } catch (error) {
      setRowError((prev) => ({ ...prev, [key]: error.response?.data?.message || t("contentTranslation.errors.regenerateFailed") }));
    } finally {
      setRegeneratingKey(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Languages size={18} />
            <h3>{t("contentTranslation.title")}</h3>
          </div>
          <button type="button" className={styles.closeIcon} onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className={styles.stateBlock}>
            <Loader2 size={20} className={styles.spinner} />
            <span>{t("common.loading")}</span>
          </div>
        )}

        {!loading && loadError && (
          <div className={styles.stateBlock}>
            <AlertTriangle size={20} />
            <span>{loadError}</span>
          </div>
        )}

        {!loading && !loadError && (
          <div className={styles.body}>
            {fields.map(({ key: field, label }) => {
              const bucket = translations[field] || {};
              return (
                <div key={field} className={styles.fieldSection}>
                  <h4 className={styles.fieldLabel}>{label}</h4>

                  {CONTENT_LANGUAGES.map((lang) => {
                    const cellKey = keyOf(field, lang);
                    const isSource = bucket.sourceLang === lang;
                    const auto = !!(bucket.auto && bucket.auto[lang]);
                    const hasValue = !!(bucket[lang] || "").trim();
                    const dirty = isDirty(field, lang);
                    const saving = savingKey === cellKey;
                    const regenerating = regeneratingKey === cellKey;

                    let badge = null;
                    if (isSource) badge = { text: t("contentTranslation.original"), cls: styles.badgeOriginal };
                    else if (!hasValue) badge = { text: t("contentTranslation.missing"), cls: styles.badgeMissing };
                    else if (auto) badge = { text: t("contentTranslation.auto"), cls: styles.badgeAuto };
                    else badge = { text: t("contentTranslation.manual"), cls: styles.badgeManual };

                    return (
                      <div key={lang} className={styles.langRow}>
                        <div className={styles.langRowHead}>
                          <span className={styles.langName}>{CONTENT_LANGUAGE_LABELS[lang]}</span>
                          <span className={`${styles.badge} ${badge.cls}`}>{badge.text}</span>
                        </div>

                        <textarea
                          className={styles.textarea}
                          dir={lang === "ar" ? "rtl" : "ltr"}
                          value={drafts[cellKey] ?? ""}
                          placeholder={t("contentTranslation.placeholder")}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [cellKey]: e.target.value }))}
                          rows={field.toLowerCase().includes("desc") || field.toLowerCase().includes("note") ? 3 : 1}
                        />

                        {rowError[cellKey] && <p className={styles.rowError}>{rowError[cellKey]}</p>}

                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.regenerateBtn}
                            onClick={() => handleRegenerate(field, lang)}
                            disabled={isSource || regenerating || saving}
                            title={isSource ? t("contentTranslation.originalHint") : t("contentTranslation.regenerate")}
                          >
                            {regenerating ? <Loader2 size={13} className={styles.spinner} /> : <Sparkles size={13} />}
                            {t("contentTranslation.regenerate")}
                          </button>

                          <button
                            type="button"
                            className={styles.saveBtn}
                            onClick={() => handleSave(field, lang)}
                            disabled={!dirty || saving || regenerating}
                          >
                            {saving ? <Loader2 size={13} className={styles.spinner} /> : <Check size={13} />}
                            {saving ? t("contentTranslation.saving") : t("contentTranslation.save")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.footer}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("contentTranslation.close")}</button>
        </div>
      </div>
    </div>
  );
}
