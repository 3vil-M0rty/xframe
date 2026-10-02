const mongoose = require("mongoose");

const { CONTENT_LANGUAGES } = require("../config/i18nContent");
const { logAudit } = require("../services/auditLogger");

/**
 * ============================================================
 * attachTranslationRoutes
 * ============================================================
 * Mounts three generic endpoints on an existing router for any
 * model that used the `translatable` plugin:
 *
 *   GET  /:id/translations
 *     -> { fields: [...], translations: { <field>: { base, en, fr, ar, sourceLang, auto, updatedAt } } }
 *
 *   PUT  /:id/translations/:field/:lang     body: { text }
 *     -> manual edit/correction; marks that slot as no longer
 *        machine-generated so future auto-translation passes leave
 *        it alone.
 *
 *   POST /:id/translations/:field/:lang/regenerate
 *     -> forces a fresh machine translation for that one slot.
 *
 * This is the ONE place that implements these three endpoints —
 * every route file that has a translatable model calls this once,
 * instead of hand-rolling the same three handlers per resource.
 *
 * IMPORTANT: this does not add its own auth. Most routers in this
 * app already do `router.use(auth, ...)` before any route is
 * defined, so by the time these routes are reached the request is
 * already authenticated (and, where relevant, already coarsely
 * permission-checked). If a router does its own per-route `auth`
 * instead (e.g. companies.js), pass `middleware: [auth]`.
 *
 * Per-record authorization (e.g. "does this user manage the
 * company this record belongs to") is delegated to `authorize`,
 * mirroring whatever check that resource's other routes already
 * perform — this file intentionally has no opinion of its own
 * about who's allowed to edit what.
 * ============================================================
 *
 * @param {import('express').Router} router
 * @param {import('mongoose').Model} Model - a model with `.plugin(translatable, {...})`
 * @param {Object} [options]
 * @param {string} [options.resourceType] - label used in error messages / audit log (defaults to Model.modelName)
 * @param {Function[]} [options.middleware] - extra per-route middleware (e.g. [auth]) if the router doesn't already apply it globally
 * @param {(req, doc) => (boolean|Promise<boolean>)} [options.authorize] - per-record access check; defaults to "allow" (relies on router-level middleware)
 * @param {string|string[]} [options.populate] - passed straight to `.populate()` when loading the record, so the same shape other routes return is preserved
 * @param {(doc) => *} [options.companyId] - how to resolve the `company` field for the audit log; defaults to `doc.company` (override for a model that IS the company, e.g. Company itself: `(doc) => doc._id`)
 */
function attachTranslationRoutes(router, Model, options = {}) {
  const {
    resourceType = Model.modelName,
    middleware = [],
    authorize = async () => true,
    populate,
    companyId = (doc) => doc.company,
  } = options;

  const fields = Model.translatableFields || [];
  if (fields.length === 0) {
    console.warn(
      `[attachTranslationRoutes] ${Model.modelName} has no translatableFields — ` +
      `did you forget to apply the translatable plugin? Skipping route registration.`
    );
    return;
  }

  const loadAuthorizedDoc = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: `Invalid ${resourceType} ID` });
      return null;
    }

    let query = Model.findById(req.params.id);
    if (populate) query = query.populate(populate);
    const doc = await query;

    if (!doc) {
      res.status(404).json({ success: false, message: `${resourceType} not found` });
      return null;
    }
    if (!(await authorize(req, doc))) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return null;
    }
    return doc;
  };

  // ======================================================
  // GET /:id/translations
  // ======================================================
  router.get(`/:id/translations`, ...middleware, async (req, res) => {
    try {
      const doc = await loadAuthorizedDoc(req, res);
      if (!doc) return;

      const translations = {};
      fields.forEach((field) => {
        const bucket = (doc.translations && doc.translations[field]) || {};
        const perLang = {};
        const autoPerLang = {};
        CONTENT_LANGUAGES.forEach((lang) => {
          perLang[lang] = bucket[lang] || "";
          autoPerLang[lang] = !!(bucket.auto && bucket.auto[lang]);
        });
        translations[field] = {
          base: doc[field] || "",
          ...perLang,
          sourceLang: bucket.sourceLang || null,
          auto: autoPerLang,
          updatedAt: bucket.updatedAt || null,
        };
      });

      res.json({ success: true, data: { fields, translations } });
    } catch (error) {
      console.error(`GET ${resourceType} translations error:`, error);
      res.status(500).json({ success: false, message: "Error fetching translations", error: error.message });
    }
  });

  // ======================================================
  // PUT /:id/translations/:field/:lang   { text }
  // ======================================================
  router.put(`/:id/translations/:field/:lang`, ...middleware, async (req, res) => {
    try {
      const { field, lang } = req.params;
      const { text } = req.body;

      if (!fields.includes(field)) {
        return res.status(400).json({ success: false, message: `"${field}" is not a translatable field of ${resourceType}` });
      }
      if (!CONTENT_LANGUAGES.includes(lang)) {
        return res.status(400).json({ success: false, message: `Unsupported content language "${lang}"` });
      }
      if (text === undefined || text === null) {
        return res.status(400).json({ success: false, message: '"text" is required (use an empty string to clear it)' });
      }

      const doc = await loadAuthorizedDoc(req, res);
      if (!doc) return;

      doc.setTranslation(field, lang, text);
      if ("updatedBy" in Model.schema.paths) doc.updatedBy = req.user?.id;
      await doc.save();

      logAudit(req, {
        company: companyId(doc),
        action: "update",
        resourceType: `${resourceType}Translation`,
        resourceId: doc._id,
        resourceLabel: `${field}.${lang}`,
        after: { field, lang, text },
      }).catch(() => {});

      res.json({ success: true, data: doc.translations[field], message: "Translation saved" });
    } catch (error) {
      console.error(`PUT ${resourceType} translation error:`, error);
      res.status(500).json({ success: false, message: "Error saving translation", error: error.message });
    }
  });

  // ======================================================
  // POST /:id/translations/:field/:lang/regenerate
  // ======================================================
  router.post(`/:id/translations/:field/:lang/regenerate`, ...middleware, async (req, res) => {
    try {
      const { field, lang } = req.params;

      if (!fields.includes(field)) {
        return res.status(400).json({ success: false, message: `"${field}" is not a translatable field of ${resourceType}` });
      }
      if (!CONTENT_LANGUAGES.includes(lang)) {
        return res.status(400).json({ success: false, message: `Unsupported content language "${lang}"` });
      }

      const doc = await loadAuthorizedDoc(req, res);
      if (!doc) return;

      await doc.retranslateField(field, lang);

      res.json({ success: true, data: doc.translations[field], message: "Translation regenerated" });
    } catch (error) {
      console.error(`POST ${resourceType} regenerate translation error:`, error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Error regenerating translation",
      });
    }
  });
}

module.exports = { attachTranslationRoutes };
