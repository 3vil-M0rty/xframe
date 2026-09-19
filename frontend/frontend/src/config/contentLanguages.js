import { SUPPORTED_LANGUAGES } from "./i18n.config";

// ======================================================
// CONTENT (UGC) LANGUAGE CONFIG
// ======================================================
// User-generated content (product names, job titles, descriptions,
// notes...) is translated into every language the UI itself
// supports — CONTENT_LANGUAGES is derived directly from
// SUPPORTED_LANGUAGES in ./i18n.config.js, so adding/removing a UI
// language automatically adds/removes it from content translation
// too, with nothing else in the app to update. Keep this file's
// exported NAMES in sync with backend/config/i18nContent.js's
// CONTENT_LANGUAGES (same list, same order) — the backend can't
// import this frontend file directly, so that's a separate .env-
// configurable list that should just match this one.
// ======================================================

export const CONTENT_LANGUAGES = [...SUPPORTED_LANGUAGES];

export const DEFAULT_CONTENT_LANGUAGE = SUPPORTED_LANGUAGES.includes("fr") ? "fr" : SUPPORTED_LANGUAGES[0];

// Display name for each language, shown in the translations editor.
// Keep this in sync with LanguageSwitcher.jsx's LANGUAGE_META — same
// data, kept separate so this config has no dependency on a UI
// component. Any SUPPORTED_LANGUAGES entry missing here just falls
// back to showing its raw code (see CONTENT_LANGUAGE_LABELS usage
// below), so an unlabeled new language never breaks anything.
const LANGUAGE_NAMES = {
  en: "English",
  fr: "Français",
  ar: "العربية",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
};

export const CONTENT_LANGUAGE_LABELS = CONTENT_LANGUAGES.reduce((acc, lang) => {
  acc[lang] = LANGUAGE_NAMES[lang] || lang.toUpperCase();
  return acc;
}, {});

export const isContentLanguage = (lang) => CONTENT_LANGUAGES.includes(lang);

/**
 * Maps the current UI language to a supported CONTENT language.
 * Since CONTENT_LANGUAGES now mirrors SUPPORTED_LANGUAGES exactly,
 * this is normally a no-op passthrough — it only matters as a
 * fallback for any language not (yet) in the list.
 */
export const resolveContentLanguage = (uiLanguage) =>
  (isContentLanguage(uiLanguage) ? uiLanguage : DEFAULT_CONTENT_LANGUAGE);
