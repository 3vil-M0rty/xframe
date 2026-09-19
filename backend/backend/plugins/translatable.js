const mongoose = require("mongoose");

const { CONTENT_LANGUAGES, DEFAULT_CONTENT_LANGUAGE, isContentLanguage } = require("../config/i18nContent");
const { translateText, detectLanguage } = require("../services/translationService");

/**
 * ============================================================
 * TRANSLATABLE (Mongoose plugin)
 * ============================================================
 * Makes a set of existing string fields multilingual, additively.
 *
 *   productSchema.plugin(translatable, { fields: ["name", "notes"] });
 *
 * For every configured field `X`, this adds a sibling path
 * `translations.X` shaped as (one String + one auto-Boolean per
 * language in config/i18nContent.js's CONTENT_LANGUAGES — currently
 * en/fr/ar/es/pt/de, built dynamically so adding a language there
 * is the only change needed):
 *
 *   {
 *     en: String, fr: String, ar: String, es: String, pt: String, de: String,
 *     sourceLang: "en" | "fr" | "ar" | "es" | "pt" | "de" | null,
 *     auto: { en: Boolean, fr: Boolean, ar: Boolean, es: Boolean, pt: Boolean, de: Boolean },
 *     updatedAt: Date,
 *   }
 *
 * The field `X` ITSELF is completely untouched: same type, same
 * validators, same indexes, same required-ness as before. It stays
 * exactly what every existing query/sort/search/form in the app
 * already reads and writes (e.g. Product.find({ name: regex }),
 * the uniqueness index on Department.name, or a form's
 * `<input value={formData.name}>`). `translations.X` is a purely
 * additive read model on top of it, kept in sync automatically:
 *
 *   - On create, or on any update that changes `X`: the language
 *     `X` was written in is detected, that slot is set to mirror
 *     `X` verbatim (never machine-translated — it IS the original),
 *     and every OTHER content language that is either empty or
 *     still machine-generated ("auto") is (re)translated via the
 *     configured translation API.
 *   - A slot a human has manually edited or corrected (via
 *     `setTranslation`, i.e. the "edit translation" endpoint) is
 *     marked `auto: false` and is NEVER silently overwritten by a
 *     later auto-translation pass — only an explicit "Regenerate"
 *     call (`retranslateField`) touches it again.
 *   - If the translation API is unavailable, unconfigured, or
 *     errors out, the slot is simply left as it was (or blank) —
 *     saving the record itself NEVER fails because of it.
 *
 * Reading: `doc.getTranslated("name", lang)` returns the stored
 * translation for `lang`, falling back to the default content
 * language, then to the raw base field, then `""`. Nothing crashes
 * on documents saved before this plugin existed — `translations`
 * is simply empty for them until the next save, and `getTranslated`
 * falls back to the base field exactly like it would for any other
 * missing slot.
 * ============================================================
 */

function buildLocalizedFieldSchema() {
  const stringFields = {};
  const autoFields = {};
  CONTENT_LANGUAGES.forEach((lang) => {
    stringFields[lang] = { type: String, default: "", trim: true };
    // Per-locale: true = machine-generated (safe to silently
    // refresh on the next edit), false = a human typed/corrected it
    // (never touched automatically again).
    autoFields[lang] = { type: Boolean, default: false };
  });

  return new mongoose.Schema(
    {
      ...stringFields,
      // Best-guess language the current value of the base field was
      // authored in. That locale's slot mirrors the base field and
      // is never machine-translated over itself.
      sourceLang: { type: String, default: null },
      auto: autoFields,
      updatedAt: { type: Date, default: Date.now },
    },
    { _id: false }
  );
}

/**
 * Core auto-translation logic for one document, extracted from the
 * `pre('save')` hook so it can be unit-tested directly (and reused)
 * without needing a live Mongoose connection to exercise `.save()`.
 * Mutates `doc.translations` in place; does not save.
 */
async function applyAutoTranslation(doc, fields) {
  for (const field of fields) {
    if (!doc.isModified(field)) continue; // eslint-disable-line no-continue

    const value = (doc[field] || "").toString();

    if (!doc.translations) doc.translations = {};
    if (!doc.translations[field]) doc.translations[field] = {};
    const bucket = doc.translations[field];
    if (!bucket.auto) bucket.auto = {};

    if (!value.trim()) {
      CONTENT_LANGUAGES.forEach((lang) => {
        if (bucket.auto[lang]) bucket[lang] = "";
      });
      doc.markModified(`translations.${field}`);
      continue; // eslint-disable-line no-continue
    }

    // eslint-disable-next-line no-await-in-loop
    const detected = await detectLanguage(value);
    const sourceLang = isContentLanguage(detected) ? detected : DEFAULT_CONTENT_LANGUAGE;
    bucket.sourceLang = sourceLang;

    bucket[sourceLang] = value;
    bucket.auto[sourceLang] = false;

    const targets = CONTENT_LANGUAGES.filter(
      (lang) => lang !== sourceLang && (bucket.auto[lang] || !bucket[lang])
    );

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      targets.map(async (lang) => {
        const translated = await translateText({ text: value, target: lang, source: sourceLang });
        if (translated !== null) {
          bucket[lang] = translated;
          bucket.auto[lang] = true;
        }
      })
    );

    bucket.updatedAt = new Date();
    doc.markModified(`translations.${field}`);
  }
}

function translatable(schema, options = {}) {
  const fields = Array.isArray(options.fields) ? options.fields : [];
  if (fields.length === 0) {
    throw new Error('translatable plugin requires a non-empty "fields" option');
  }

  const localizedFieldSchema = buildLocalizedFieldSchema();

  const translationsPaths = {};
  fields.forEach((field) => {
    translationsPaths[field] = { type: localizedFieldSchema, default: () => ({}) };
  });
  schema.add({ translations: translationsPaths });

  // Exposed so generic tooling (route factory, admin scripts) can
  // discover which fields on a given model are translatable without
  // hardcoding a list per model.
  schema.statics.translatableFields = fields;

  // ---- Reading -----------------------------------------------------------

  schema.methods.getTranslated = function getTranslated(field, lang) {
    const base = this[field] || "";
    if (!fields.includes(field)) return base;

    const bucket = this.translations && this.translations[field];
    if (!bucket) return base;

    if (lang && isContentLanguage(lang) && bucket[lang]) return bucket[lang];
    if (bucket[DEFAULT_CONTENT_LANGUAGE]) return bucket[DEFAULT_CONTENT_LANGUAGE];
    return base;
  };

  // ---- Manual edit ---------------------------------------------------------

  /**
   * Sets one locale of one field to a human-provided value. Always
   * marks that slot `auto: false` — the entire point of this method
   * is "a person typed/corrected this, never silently overwrite it
   * again". Does NOT save; caller calls doc.save().
   */
  schema.methods.setTranslation = function setTranslation(field, lang, text) {
    if (!fields.includes(field)) {
      throw new Error(`"${field}" is not a translatable field on ${this.constructor.modelName}`);
    }
    if (!isContentLanguage(lang)) {
      throw new Error(`Unsupported content language "${lang}"`);
    }

    if (!this.translations) this.translations = {};
    if (!this.translations[field]) this.translations[field] = {};
    if (!this.translations[field].auto) this.translations[field].auto = {};

    this.translations[field][lang] = (text || "").toString();
    this.translations[field].auto[lang] = false;
    this.translations[field].updatedAt = new Date();
    this.markModified(`translations.${field}`);
  };

  // ---- Explicit regenerate ---------------------------------------------

  /**
   * Forces a fresh machine translation of one locale, regardless of
   * its current auto/manual state, and marks the result `auto:
   * true`. This is the only thing that overwrites a manually-edited
   * slot — it's an explicit "Regenerate" action, not something that
   * happens as a side effect of saving.
   */
  schema.methods.retranslateField = async function retranslateField(field, lang, opts = {}) {
    if (!fields.includes(field)) {
      throw new Error(`"${field}" is not a translatable field on ${this.constructor.modelName}`);
    }
    if (!isContentLanguage(lang)) {
      throw new Error(`Unsupported content language "${lang}"`);
    }

    const bucket = (this.translations && this.translations[field]) || {};
    const source = opts.sourceLang || bucket.sourceLang || DEFAULT_CONTENT_LANGUAGE;
    const sourceText = (source && bucket[source]) || this[field] || "";

    if (!sourceText.toString().trim()) return this;

    const translated = await translateText({ text: sourceText, target: lang, source });
    if (translated === null) {
      const error = new Error(
        "The translation service is unavailable or not configured — could not regenerate this translation."
      );
      error.status = 503;
      throw error;
    }

    if (!this.translations) this.translations = {};
    if (!this.translations[field]) this.translations[field] = {};
    if (!this.translations[field].auto) this.translations[field].auto = {};

    this.translations[field][lang] = translated;
    this.translations[field].auto[lang] = true;
    this.translations[field].updatedAt = new Date();
    this.markModified(`translations.${field}`);

    await this.save();
    return this;
  };

  // ---- Auto-translate on create/update -----------------------------------

  schema.pre("save", async function autoTranslate(next) {
    try {
      await applyAutoTranslation(this, fields);
      next();
    } catch (error) {
      // Belt-and-suspenders: even a bug in the translation layer
      // itself must never prevent the underlying business record
      // from being saved.
      console.error(`[translatable] auto-translate hook failed for ${this.constructor.modelName}:`, error);
      next();
    }
  });
}

module.exports = translatable;
module.exports.applyAutoTranslation = applyAutoTranslation;
