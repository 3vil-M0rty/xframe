/**
 * Triggers a browser download/open for a Blob fetched via an
 * authenticated API call (e.g. api.get(url, { responseType: "blob" })).
 * A plain <a href="..."> can't be used for these endpoints since
 * they require the Authorization header the axios instance adds
 * automatically — the file has to be fetched via JS first.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {boolean} [openInNewTab] - true for PDFs (view inline),
 *   false to force a save-as download (typical for CSV exports).
 */
export function downloadBlob(blob, filename, openInNewTab = false) {
  const url = window.URL.createObjectURL(blob);

  if (openInNewTab) {
    window.open(url, "_blank", "noopener,noreferrer");
    // Revoke a little later so the new tab has time to load it.
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
