import { CONTENT_LANGUAGES, DEFAULT_CONTENT_LANGUAGE, isContentLanguage } from "../config/contentLanguages";

// ======================================================
// TRANSLATED CONTENT — pure read helpers
// ======================================================
// Mirrors backend/plugins/translatable.js's storage shape exactly:
//
//   doc.translations.<field> = {
//     en, fr, ar,
//     sourceLang: "en" | "fr" | "ar" | null,
//     auto: { en, fr, ar },
//     updatedAt,
//   }
//
// These are pure, synchronous, no-network functions: everything
// they need is already sitting in the document the app fetched.
// That's what makes switching languages instant — there is no
// re-translation call on language change, just re-reading the
// already-loaded `translations` object with a different key.
// ======================================================

/**
 * Returns the best available text for `field` on `doc`, in `lang`.
 * Falls back: requested lang -> default content language -> the
 * plain base field (works even for documents saved before this
 * system existed, or for a field that hasn't been auto-translated
 * yet) -> "".
 */
export function getTranslatedField(doc, field, lang) {
  if (!doc) return "";
  const base = doc[field] || "";
  const bucket = doc.translations && doc.translations[field];
  if (!bucket) return base;

  if (lang && isContentLanguage(lang) && bucket[lang]) return bucket[lang];
  if (bucket[DEFAULT_CONTENT_LANGUAGE]) return bucket[DEFAULT_CONTENT_LANGUAGE];
  return base;
}

/** Whether `field`/`lang` on `doc` was machine-translated (vs. manually entered/corrected, or the original). */
export function isAutoTranslated(doc, field, lang) {
  const bucket = doc?.translations?.[field];
  return !!(bucket && bucket.auto && bucket.auto[lang]);
}

/** Whether `field`/`lang` on `doc` has any stored value at all (as opposed to falling back). */
export function hasStoredTranslation(doc, field, lang) {
  const bucket = doc?.translations?.[field];
  return !!(bucket && bucket[lang]);
}

/** The language `field` on `doc` was originally authored in, if known. */
export function getSourceLanguage(doc, field) {
  return doc?.translations?.[field]?.sourceLang || null;
}

/**
 * Quick "does this document have anything left to translate"
 * check across one or more fields — handy for a small badge/warning
 * in a list view.
 */
export function hasMissingTranslations(doc, fields) {
  return fields.some((field) =>
    CONTENT_LANGUAGES.some((lang) => !getTranslatedField(doc, field, lang)?.trim?.())
  );
}
