import { describe, it, expect } from "vitest";

const PDFDocument = require("pdfkit");
const { brandFor, textOn, inkOnWhite, formatDate, drawLetterhead } = require("./pdfHelpers");

describe("PDF branding", () => {
  it("uses the company colours, with readable text on them", () => {
    const b = brandFor({ branding: { primaryColor: "#1e3a8a", secondaryColor: "#FDE047" } });
    expect(b.primary).toBe("#1e3a8a");
    expect(b.onPrimary).toBe("#ffffff");
    expect(b.secondary).toBe("#fde047");
    expect(b.onSecondary).toBe("#000000"); // pale yellow → black text
  });

  it("falls back to the neutral look for missing or invalid colours", () => {
    expect(brandFor(null).primary).toBe("#1a1a1a");
    expect(brandFor({ branding: { primaryColor: "bleu" } }).primary).toBe("#1a1a1a");
    expect(brandFor({ branding: { primaryColor: "#123" } }).primary).toBe("#112233");
    // no secondary → same as the primary
    expect(brandFor({ branding: { primaryColor: "#1e3a8a" } }).secondary).toBe("#1e3a8a");
  });

  it("darkens a pale colour used as text on white paper", () => {
    expect(inkOnWhite("#1e3a8a")).toBe("#1e3a8a");
    expect(inkOnWhite("#ffd400")).not.toBe("#ffd400");
    expect(textOn("#000000")).toBe("#ffffff");
  });

  it("formats dates with the company's date format, per request", async () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2026");
    expect(formatDate("2026-03-05", "MM/DD/YYYY")).toBe("03/05/2026");
    expect(formatDate(null)).toBe("—");

    // Two documents built concurrently for two companies don't mix formats
    const build = (fmt) => new Promise((resolve) => setImmediate(() => {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      drawLetterhead(doc, { name: "X", localization: { dateFormat: fmt } });
      setImmediate(() => resolve(formatDate("2026-03-05")));
    }));
    const [iso, us] = await Promise.all([build("YYYY-MM-DD"), build("MM/DD/YYYY")]);
    expect(iso).toBe("2026-03-05");
    expect(us).toBe("03/05/2026");
  });
});
