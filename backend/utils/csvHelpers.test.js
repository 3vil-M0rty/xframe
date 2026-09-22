import { describe, it, expect } from "vitest";

const { toCsv } = require("./csvHelpers");

describe("toCsv", () => {
  it("quotes fields containing a comma", () => {
    const csv = toCsv([["name", "note"], ["Sara, Amrani", "Has a comma"]]);
    expect(csv).toContain('"Sara, Amrani"');
  });

  it("doubles internal quotes and wraps the field", () => {
    const csv = toCsv([["name"], ['Karim "Le Boss"']]);
    expect(csv).toContain('"Karim ""Le Boss"""');
  });

  it("quotes fields containing a newline", () => {
    const csv = toCsv([["note"], ["Line 1\nLine 2"]]);
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it("leaves simple fields unquoted", () => {
    const csv = toCsv([["name"], ["Yassine"]]);
    expect(csv).toContain("Yassine");
    expect(csv).not.toContain('"Yassine"');
  });

  it("joins rows with CRLF, as Excel expects", () => {
    const csv = toCsv([["a"], ["b"]]);
    expect(csv).toBe("a\r\nb");
  });
});
