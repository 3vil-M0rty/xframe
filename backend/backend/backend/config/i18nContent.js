/**
 * ============================================================
 * CONTENT (UGC) LANGUAGE CONFIG
 * ============================================================
 * This is deliberately separate from the frontend's UI i18n
 * dictionary (src/config/i18n.config.js), which translates static
 * interface strings ("Save", "Employees", ...). USER-GENERATED
 * CONTENT — product names, job titles, descriptions, notes — is
 * translated into every one of those same UI languages: this list
 * should always match SUPPORTED_LANGUAGES on the frontend exactly
 * (same languages, doesn't need to be the same order).
 *
 * The backend can't import the frontend's i18n.config.js directly
 * (separate codebases/processes), so CONTENT_LANGUAGES is a plain
 * env-configurable list here instead, defaulting to the same 6
 * languages the frontend ships with today. If a UI language is ever
 * added or removed, update CONTENT_LANGUAGES (either via the
 * CONTENT_LANGUAGES env var, or the default below) to match —
 * that's the only place to change: every model using the
 * `translatable` plugin and every route built on
 * `attachTranslationRoutes` reads the list from here.
 * ============================================================
 */

const DEFAULT_LANGUAGES = ["en", "fr", "ar", "es", "pt", "de"];

const CONTENT_LANGUAGES = process.env.CONTENT_LANGUAGES
  ? process.env.CONTENT_LANGUAGES.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean)
  : DEFAULT_LANGUAGES;

const rawDefault = (process.env.DEFAULT_CONTENT_LANGUAGE || "fr").toLowerCase();

const isContentLanguage = (lang) => CONTENT_LANGUAGES.includes(lang);

const DEFAULT_CONTENT_LANGUAGE = isContentLanguage(rawDefault) ? rawDefault : CONTENT_LANGUAGES[0];

module.exports = {
  CONTENT_LANGUAGES,
  DEFAULT_CONTENT_LANGUAGE,
  isContentLanguage,
};
