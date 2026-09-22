import { describe, it, expect, vi, beforeEach } from "vitest";

// download.js touches window/document directly (createObjectURL, a
// clicked <a> element) — real browser APIs vitest's default "node"
// environment doesn't provide. Rather than pull in a full jsdom
// dependency for two small functions, these tests supply the
// minimal fakes each one actually needs.

describe("downloadBlob", () => {
  let createdLink;

  beforeEach(async () => {
    vi.resetModules();
    createdLink = null;
    global.window = {
      URL: {
        createObjectURL: () => `blob:mock-url-${Math.random()}`,
        revokeObjectURL: () => {},
      },
    };
    global.document = {
      createElement: (tag) => {
        const el = { tag, clicked: false, click() { this.clicked = true; } };
        if (tag === "a") createdLink = el;
        return el;
      },
      body: { appendChild: () => {}, removeChild: () => {} },
    };
  });

  it("triggers a real, correctly-named download via a clicked <a download> element", async () => {
    const { downloadBlob } = await import("./download.js");
    downloadBlob({}, "Attestation de travail - Yassine El Amrani - EMP-0042.pdf", true);

    expect(createdLink).not.toBeNull();
    expect(createdLink.download).toBe("Attestation de travail - Yassine El Amrani - EMP-0042.pdf");
    expect(createdLink.clicked).toBe(true);
  });

  it("does not silently drop the filename regardless of the (now-unused) openInNewTab flag", async () => {
    // Regression: this function used to route PDFs through
    // window.open(blobUrl, "_blank") when openInNewTab was true,
    // which never used the filename at all — a saved file would get
    // whatever name the browser made up. Locking in that both
    // true and false honor the filename identically now.
    const { downloadBlob } = await import("./download.js");

    downloadBlob({}, "with-true.pdf", true);
    expect(createdLink.download).toBe("with-true.pdf");

    downloadBlob({}, "with-false.pdf", false);
    expect(createdLink.download).toBe("with-false.pdf");
  });
});

describe("normalizeBlobError", () => {
  it("parses a Blob-typed JSON error response back into a readable object", async () => {
    const { normalizeBlobError } = await import("./download.js");
    const jsonBlob = new Blob(
      [JSON.stringify({ success: false, message: "This employee has no contract on file yet." })],
      { type: "application/json" }
    );
    const err = { response: { status: 404, data: jsonBlob } };

    await normalizeBlobError(err);
    expect(err.response.data.message).toBe("This employee has no contract on file yet.");
  });

  it("parses a string-typed JSON error response (non-browser axios adapter shape)", async () => {
    const { normalizeBlobError } = await import("./download.js");
    const err = { response: { status: 403, data: JSON.stringify({ success: false, message: "Not authorized" }) } };

    await normalizeBlobError(err);
    expect(err.response.data.message).toBe("Not authorized");
  });

  it("leaves a genuinely non-JSON blob untouched instead of corrupting it", async () => {
    const { normalizeBlobError } = await import("./download.js");
    const binaryBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "application/octet-stream" });
    const err = { response: { status: 500, data: binaryBlob } };

    await normalizeBlobError(err);
    expect(err.response.data).toBe(binaryBlob);
  });

  it("passes through a network error (no response at all) without throwing", async () => {
    const { normalizeBlobError } = await import("./download.js");
    const err = { message: "Network Error" };

    await expect(normalizeBlobError(err)).resolves.toBe(err);
    expect(err.message).toBe("Network Error");
  });
});
