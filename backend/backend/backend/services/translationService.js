/**
 * ============================================================
 * TRANSLATION SERVICE
 * ============================================================
 * Thin, pluggable wrapper around whichever external translation
 * API the deployment is configured with. Nothing else in the
 * codebase talks to a translation vendor directly — the
 * `translatable` Mongoose plugin (plugins/translatable.js) and the
 * manual "regenerate" route both go through `translateText` /
 * `detectLanguage` here, so swapping providers or adding a new one
 * never touches models or routes.
 *
 * Supported providers (set TRANSLATION_PROVIDER in .env):
 *   - "mymemory"       MyMemory (https://mymemory.translated.net) — free,
 *                       no signup/card/API key. 5,000 chars/day anonymous,
 *                       50,000/day with MYMEMORY_EMAIL set. Good default.
 *   - "google"         Google Cloud Translation API v2 (REST, API key)
 *   - "libretranslate"  Self-hosted / hosted LibreTranslate instance
 *   - "deepl"          DeepL API (free or pro key)
 *
 * If TRANSLATION_PROVIDER is unset (or unknown), the service logs a
 * warning and returns null from every translate call instead of
 * throwing — new content is saved with its translation slots simply
 * left empty (shown as "not translated yet" in the UI) rather than
 * the app breaking or business data failing to save because a
 * translation vendor is down or not configured yet. This is the
 * single most important property for a "production-ready" system:
 * translation is an enhancement layer, never a write-blocking
 * dependency.
 * ============================================================
 */

const { CONTENT_LANGUAGES, isContentLanguage } = require("../config/i18nContent");

// Read live from process.env on every call rather than freezing a
// value at module-load time. Node's `require` cache means this
// module is only evaluated ONCE per process — if these were plain
// top-level constants, a value baked in before .env finished
// loading (or before a config change was picked up) would silently
// stick for the entire lifetime of the process, long after the
// actual environment variable changed. That exact class of bug is
// also why editing .env alone often isn't enough during development:
// most file watchers (nodemon's default config included) don't
// watch .env, so the process has to be fully stopped and restarted,
// not just auto-reloaded, for a new provider/key to take effect.
const getTimeoutMs = () => Number(process.env.TRANSLATION_TIMEOUT_MS) || 8000;
const getMaxRetries = () => Number(process.env.TRANSLATION_MAX_RETRIES) || 2;

class TranslationServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = "TranslationServiceError";
  }
}

// ------------------------------------------------------------
// Small fetch helpers: every provider call gets the same
// timeout + retry (on network errors / 5xx only, never on 4xx —
// a bad API key or bad request will never succeed by retrying it).
// ------------------------------------------------------------

async function fetchWithTimeout(url, fetchOptions, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(fn) {
  const maxRetries = getMaxRetries();
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (error) {
      lastError = error;
      const isClientError = error.status && error.status >= 400 && error.status < 500;
      if (isClientError || attempt === maxRetries) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

// ------------------------------------------------------------
// Providers — each exposes translate({ text, target, source }) and
// (optionally) detect({ text }). All return plain strings/null.
// ------------------------------------------------------------

const providers = {
  google: {
    async translate({ text, target, source }) {
      const key = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!key) throw new TranslationServiceError("GOOGLE_TRANSLATE_API_KEY is not set");

      return requestWithRetry(async () => {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              q: text,
              target,
              source: source || undefined,
              format: "text",
            }),
          },
          getTimeoutMs()
        );
        if (!response.ok) {
          const body = await readErrorBody(response);
          const error = new Error(`Google Translate API error ${response.status}: ${body}`);
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        return data?.data?.translations?.[0]?.translatedText ?? null;
      });
    },

    async detect({ text }) {
      const key = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!key) return null;
      try {
        const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${encodeURIComponent(key)}`;
        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: text }),
          },
          getTimeoutMs()
        );
        if (!response.ok) return null;
        const data = await response.json();
        const detected = data?.data?.detections?.[0]?.[0]?.language;
        return detected ? detected.split("-")[0].toLowerCase() : null;
      } catch (error) {
        console.warn("[translationService] Google language detection failed:", error.message);
        return null;
      }
    },
  },

  libretranslate: {
    async translate({ text, target, source }) {
      const base = process.env.LIBRETRANSLATE_URL;
      if (!base) throw new TranslationServiceError("LIBRETRANSLATE_URL is not set");

      return requestWithRetry(async () => {
        const response = await fetchWithTimeout(
          `${base.replace(/\/$/, "")}/translate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              q: text,
              source: source || "auto",
              target,
              format: "text",
              api_key: process.env.LIBRETRANSLATE_API_KEY || undefined,
            }),
          },
          getTimeoutMs()
        );
        if (!response.ok) {
          const body = await readErrorBody(response);
          const error = new Error(`LibreTranslate error ${response.status}: ${body}`);
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        return data?.translatedText ?? null;
      });
    },

    async detect({ text }) {
      const base = process.env.LIBRETRANSLATE_URL;
      if (!base) return null;
      try {
        const response = await fetchWithTimeout(
          `${base.replace(/\/$/, "")}/detect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: text, api_key: process.env.LIBRETRANSLATE_API_KEY || undefined }),
          },
          getTimeoutMs()
        );
        if (!response.ok) return null;
        const data = await response.json();
        return Array.isArray(data) && data[0]?.language ? data[0].language.toLowerCase() : null;
      } catch (error) {
        console.warn("[translationService] LibreTranslate language detection failed:", error.message);
        return null;
      }
    },
  },

  deepl: {
    async translate({ text, target, source }) {
      const key = process.env.DEEPL_API_KEY;
      if (!key) throw new TranslationServiceError("DEEPL_API_KEY is not set");
      const host = process.env.DEEPL_API_HOST
        || (key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
      const DEEPL_TARGET = { en: "EN-US", fr: "FR", ar: "AR", es: "ES", pt: "PT-PT", de: "DE" };

      return requestWithRetry(async () => {
        const params = new URLSearchParams();
        params.append("text", text);
        params.append("target_lang", DEEPL_TARGET[target] || target.toUpperCase());
        if (source) params.append("source_lang", source.toUpperCase());

        const response = await fetchWithTimeout(
          `${host}/v2/translate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `DeepL-Auth-Key ${key}`,
            },
            body: params,
          },
          getTimeoutMs()
        );
        if (!response.ok) {
          const body = await readErrorBody(response);
          const error = new Error(`DeepL error ${response.status}: ${body}`);
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        return data?.translations?.[0]?.text ?? null;
      });
    },
    // DeepL's detection only comes bundled with a translate call, not
    // as a standalone endpoint — fall through to the local heuristic.
  },

  // MyMemory (https://mymemory.translated.net) — genuinely free, no
  // signup, no credit card, no API key. Anonymous usage is capped at
  // 5,000 chars/day per IP; setting MYMEMORY_EMAIL (any address —
  // it's never verified) raises that to 50,000 chars/day. Good
  // default for getting auto-translation working immediately;
  // swap to Google/DeepL later if volume or quality demands it.
  mymemory: {
    async translate({ text, target, source }) {
      // MyMemory's `q` parameter is capped at ~500 bytes per request.
      // UGC fields here (names, titles, short notes) are almost
      // always well under that, but split defensively on sentence/
      // word boundaries and stitch the results back together so a
      // longer note doesn't just get silently truncated.
      const chunks = chunkForMyMemory(text);
      const translated = await Promise.all(
        chunks.map((chunk) => translateChunkViaMyMemory({ text: chunk, target, source }))
      );
      if (translated.some((t) => t === null)) return null;
      return translated.join(" ");
    },
    // MyMemory has no standalone detect endpoint — falls through to
    // the local heuristic below.
  },
};

async function translateChunkViaMyMemory({ text, target, source }) {
  return requestWithRetry(async () => {
    const params = new URLSearchParams({
      q: text,
      langpair: `${source || "auto"}|${target}`,
    });
    if (process.env.MYMEMORY_EMAIL) params.append("de", process.env.MYMEMORY_EMAIL);

    const response = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      { method: "GET" },
      getTimeoutMs()
    );
    if (!response.ok) {
      const body = await readErrorBody(response);
      const error = new Error(`MyMemory error ${response.status}: ${body}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    // MyMemory returns HTTP 200 even for quota/param errors, signalled
    // via responseStatus instead — treat non-200 responseStatus as a
    // client error (won't be retried) rather than a silent bad translation.
    const status = Number(data?.responseStatus) || 200;
    if (status !== 200) {
      const error = new Error(`MyMemory error ${status}: ${data?.responseDetails || "unknown"}`);
      error.status = status >= 400 && status < 600 ? status : 400;
      throw error;
    }
    return data?.responseData?.translatedText ?? null;
  });
}

function chunkForMyMemory(text, maxBytes = 450) {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const chunks = [];
  let current = "";
  sentences.forEach((sentence) => {
    if (Buffer.byteLength(current + sentence, "utf8") > maxBytes && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  });
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function getActiveProvider() {
  const provider = (process.env.TRANSLATION_PROVIDER || "").toLowerCase();
  return providers[provider] ? provider : null;
}

// ------------------------------------------------------------
// Local, dependency-free language heuristic. Used (a) as the ONLY
// detector when no provider is configured / provider detection
// fails, and (b) as a fast, free pre-check. Covers all 6 languages
// this app ships with (en/fr/ar/es/pt/de) well enough for short UGC
// strings (names, titles, notes) — not general-purpose language ID.
// When it can't tell confidently, it abstains (returns null) rather
// than guess: callers fall back to DEFAULT_CONTENT_LANGUAGE in that
// case, which is always a safe, non-broken outcome.
// ------------------------------------------------------------

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

// Characters that (almost) only show up in one of these languages —
// checked before falling back to stopword scoring, since a single
// occurrence is already a strong signal.
const UNIQUE_CHAR_HINTS = [
  { lang: "de", re: /[ß]/ },
  { lang: "es", re: /[ñ¿¡]/i },
  { lang: "pt", re: /[ãõ]/i },
];

const STOPWORDS = {
  fr: new Set([
    "le", "la", "les", "de", "des", "du", "un", "une", "et", "est",
    "pour", "avec", "sur", "dans", "au", "aux", "ce", "cette", "que",
    "qui", "en", "par", "pas", "plus", "ou", "son", "sa", "ses",
  ]),
  en: new Set([
    "the", "a", "an", "of", "and", "is", "for", "with", "on", "in",
    "to", "this", "that", "are", "was", "were", "be", "or", "as",
  ]),
  // Stored already stripped of accents — see detectLanguageHeuristic,
  // which normalizes the text the same way before matching (e.g.
  // Spanish "más" is "mas" here, Portuguese "não" is "nao").
  es: new Set([
    "el", "la", "los", "las", "de", "del", "un", "una", "y", "es",
    "para", "con", "en", "por", "que", "se", "su", "no", "mas", "al",
  ]),
  pt: new Set([
    "o", "a", "os", "as", "de", "do", "da", "um", "uma", "e",
    "para", "com", "em", "por", "que", "se", "seu", "nao", "mais",
  ]),
  de: new Set([
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "und",
    "ist", "fur", "mit", "auf", "in", "zu", "von", "nicht", "oder", "als",
  ]),
};

function detectLanguageHeuristic(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  if (ARABIC_RE.test(trimmed)) return "ar";

  const uniqueHit = UNIQUE_CHAR_HINTS.find(({ re }) => re.test(trimmed));
  if (uniqueHit) return uniqueHit.lang;

  // Strip accents/diacritics via Unicode decomposition (NFD splits
  // "é" into "e" + a combining acute accent, which the regex below
  // then discards) rather than trying to enumerate every accented
  // character a word-splitting regex would need to preserve —
  // "está", "être", "für" all become plain-ASCII "esta"/"etre"/"fur",
  // matched against the (also accent-stripped) stopword lists above.
  const normalized = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const words = normalized.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length === 0) return null;

  let bestLang = null;
  let bestRatio = 0;
  Object.entries(STOPWORDS).forEach(([lang, set]) => {
    const hits = words.filter((w) => set.has(w)).length;
    const ratio = hits / words.length;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestLang = lang;
    }
  });

  // No confident signal either way (e.g. a short, unaccented,
  // stopword-free phrase like "Ciment blanc" or "Blue Widget") —
  // abstain rather than guess.
  return bestRatio >= 0.2 ? bestLang : null;
}

/**
 * Best-effort source-language detection. Never throws — falls back
 * to the local heuristic on any provider failure.
 */
async function detectLanguage(text) {
  if (!(text || "").trim()) return null;

  const provider = getActiveProvider();
  if (provider && typeof providers[provider].detect === "function") {
    const detected = await providers[provider].detect({ text });
    if (detected && isContentLanguage(detected)) return detected;
  }
  return detectLanguageHeuristic(text);
}

/**
 * Translates `text` into `target` (one of CONTENT_LANGUAGES), from
 * `source` if known. Returns the translated string, or `null` if no
 * provider is configured or the call ultimately failed — callers
 * treat `null` as "translation unavailable right now", never throw
 * it up into a request that's just trying to save a record.
 */
async function translateText({ text, target, source }) {
  const trimmed = (text || "").toString().trim();
  if (!trimmed) return "";
  if (!isContentLanguage(target)) {
    throw new TranslationServiceError(`Unsupported target language "${target}"`);
  }
  if (source && source === target) return trimmed;

  const provider = getActiveProvider();
  if (!provider) {
    console.warn(
      `[translationService] No translation provider configured ` +
      `(TRANSLATION_PROVIDER=${JSON.stringify(process.env.TRANSLATION_PROVIDER || "")}) — ` +
      `skipping auto-translation. Set TRANSLATION_PROVIDER to "mymemory" (free, no key needed), ` +
      `"google", "libretranslate", or "deepl", and restart the server so the new value is read.`
    );
    return null;
  }

  try {
    const result = await providers[provider].translate({ text: trimmed, target, source });
    return typeof result === "string" ? result : null;
  } catch (error) {
    console.error(
      `[translationService] "${provider}" translation failed (${source || "auto"} -> ${target}): ${error.message}`
    );
    return null;
  }
}

module.exports = {
  translateText,
  detectLanguage,
  detectLanguageHeuristic,
  getActiveProvider,
  CONTENT_LANGUAGES,
  TranslationServiceError,
};
