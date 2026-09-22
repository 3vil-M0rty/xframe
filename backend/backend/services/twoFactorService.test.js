import { describe, it, expect } from "vitest";

const speakeasy = require("speakeasy");
const {
  generateSecret,
  verifyToken,
  generateBackupCodes,
  findMatchingBackupCode,
} = require("./twoFactorService");

describe("twoFactorService", () => {
  describe("generateSecret", () => {
    it("returns a base32 secret and a valid QR code data URL", async () => {
      const { base32, qrCodeDataUrl } = await generateSecret("sara.bennis@company.frame");
      expect(typeof base32).toBe("string");
      expect(base32.length).toBeGreaterThan(10);
      expect(qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    });
  });

  describe("verifyToken", () => {
    it("accepts a genuinely current TOTP code generated from the same secret", async () => {
      const { base32 } = await generateSecret("test@company.frame");
      const currentCode = speakeasy.totp({ secret: base32, encoding: "base32" });
      expect(verifyToken(base32, currentCode)).toBe(true);
    });

    it("rejects an incorrect code", async () => {
      const { base32 } = await generateSecret("test@company.frame");
      const currentCode = speakeasy.totp({ secret: base32, encoding: "base32" });
      const wrongCode = String((parseInt(currentCode, 10) + 1) % 1000000).padStart(6, "0");
      expect(verifyToken(base32, wrongCode)).toBe(false);
    });

    it("handles missing inputs safely without throwing", () => {
      expect(verifyToken("", "123456")).toBe(false);
      expect(verifyToken("SOMESECRET", "")).toBe(false);
      expect(verifyToken(null, null)).toBe(false);
    });
  });

  describe("generateBackupCodes / findMatchingBackupCode", () => {
    it("generates 8 unique, readable-format codes", async () => {
      const { plainCodes } = await generateBackupCodes();
      expect(plainCodes.length).toBe(8);
      expect(new Set(plainCodes).size).toBe(8);
      plainCodes.forEach((code) => expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/));
    });

    it("matches the correct code at the correct index", async () => {
      const { plainCodes, hashed } = await generateBackupCodes();
      const matchIndex = await findMatchingBackupCode(hashed, plainCodes[3]);
      expect(matchIndex).toBe(3);
    });

    it("never matches an already-used code (single-use enforcement)", async () => {
      const { plainCodes, hashed } = await generateBackupCodes();
      hashed[3].used = true;
      const matchIndex = await findMatchingBackupCode(hashed, plainCodes[3]);
      expect(matchIndex).toBe(-1);
    });

    it("does not match a code that was never generated", async () => {
      const { hashed } = await generateBackupCodes();
      const matchIndex = await findMatchingBackupCode(hashed, "FFFF-FFFF");
      expect(matchIndex).toBe(-1);
    });
  });
});
