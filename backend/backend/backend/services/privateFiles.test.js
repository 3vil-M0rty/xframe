import { describe, it, expect } from "vitest";

process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "demo-cloud";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "123456";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "test-secret";

const cloudinary = require("../config/cloudinary");
cloudinary.config({ cloud_name: "demo-cloud", api_key: "123456", api_secret: "test-secret" });
const { privateFileUrl } = require("./cloudinaryService");

describe("private file links", () => {
  it("a private file gets a signed link that expires", () => {
    const before = Math.floor(Date.now() / 1000);
    const url = privateFileUrl({ private: true, publicId: "purchasing/abc/invoice", resourceType: "image", format: "pdf" }, { ttlSeconds: 120 });
    const u = new URL(url);
    expect(u.hostname).toMatch(/cloudinary\.com$/);
    expect(u.searchParams.get("type")).toBe("authenticated");
    expect(u.searchParams.get("signature")).toBeTruthy();
    const expiresAt = Number(u.searchParams.get("expires_at"));
    expect(expiresAt).toBeGreaterThanOrEqual(before + 120);
    expect(expiresAt).toBeLessThanOrEqual(before + 125);
  });

  it("files uploaded before private storage keep their URL; nothing → null", () => {
    expect(privateFileUrl({ url: "https://res.cloudinary.com/x/old.pdf" })).toBe("https://res.cloudinary.com/x/old.pdf");
    expect(privateFileUrl(null)).toBeNull();
    expect(privateFileUrl({ private: true })).toBeNull();
  });
});
