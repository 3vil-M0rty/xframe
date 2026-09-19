import { useMemo } from "react";

import { useI18n } from "./useI18n";
import { resolveContentLanguage } from "../config/contentLanguages";
import { getTranslatedField } from "../utils/translatedContent";

/**
 * Returns the text to display for a translatable field on a
 * document, in the CURRENT UI language, re-computed instantly (no
 * network call) whenever the user switches language — it just
 * re-reads `doc.translations[field][lang]`, which was already
 * fetched along with the rest of the document.
 *
 *   const name = useTranslatedField(product, "name");
 *
 * Falls back through: current language -> default content language
 * -> the plain base field -> "". Safe to call on documents that
 * predate this system (translations simply absent) or on fields
 * that haven't finished auto-translating yet.
 */
export function useTranslatedField(doc, field) {
  const { language } = useI18n();
  const contentLang = resolveContentLanguage(language);

  return useMemo(
    () => getTranslatedField(doc, field, contentLang),
    // Re-run whenever the doc's OWN translations for this field
    // change (e.g. after a manual edit updates local state), the
    // field name changes, or the language is switched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, doc?.translations?.[field]?.en, doc?.translations?.[field]?.fr, doc?.translations?.[field]?.ar, doc?.[field], field, contentLang]
  );
}
