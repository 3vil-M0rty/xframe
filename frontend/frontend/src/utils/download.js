/**
 * Triggers a browser download for a Blob fetched via an
 * authenticated API call (e.g. api.get(url, { responseType: "blob" })).
 * A plain <a href="..."> can't be used for these endpoints since
 * they require the Authorization header the axios instance adds
 * automatically — the file has to be fetched via JS first.
 *
 * `openInNewTab` (still accepted for callers passing it, but no
 * longer changes behavior — see below) used to route PDFs through
 * `window.open(url, "_blank")` instead of a named download. That
 * technique never actually used `filename` at all: a blob opened
 * in a browser tab this way has no name attached to it, so if
 * someone later saves it from the browser's own PDF viewer, the
 * browser has nothing to go on and makes up its own (often a
 * random string) — the intended filename was silently discarded
 * every time. There's no reliable cross-browser way to open a blob
 * for preview AND guarantee what a LATER, separate save action
 * calls it, so this always triggers a real, correctly-named
 * download instead — the one thing that's actually guaranteed to
 * work.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename, _openInNewTab = false) {
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Every request that downloads a file sets `responseType: "blob"` —
 * necessary so a successful PDF/CSV response comes back as binary
 * data instead of axios trying (and failing) to parse it as JSON.
 * The catch: that setting applies to EVERY response on that
 * request, including error ones. When the backend rejects one of
 * these with a normal JSON error body (403, 404, ...), axios hands
 * back `err.response.data` as a Blob (or, in some non-browser
 * environments, a plain string) instead of the parsed
 * `{ message: "..." }` object every catch block in this app expects
 * — so `err.response?.data?.message` silently comes back
 * `undefined` and a generic fallback message shows instead of the
 * real, specific one from the server.
 *
 * Call this in the catch block of any blob-download service
 * function, and re-throw its result — it rewrites `err.response.data`
 * back into the parsed JSON object when that's what the body
 * actually is, so every existing `err.response?.data?.message` call
 * site keeps working unmodified.
 */
export async function normalizeBlobError(err) {
  const data = err?.response?.data;

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await data.text();
      err.response.data = JSON.parse(text);
    } catch {
      // Not actually JSON (a real file came back with an error
      // status, or the body was empty/malformed) — leave as-is.
    }
  } else if (typeof data === "string") {
    try {
      err.response.data = JSON.parse(data);
    } catch {
      // leave as-is
    }
  }

  return err;
}
