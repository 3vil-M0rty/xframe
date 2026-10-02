import { describe, it, expect, beforeAll } from "vitest";
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

describe("general rate limiter", () => {
  let app;
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.RATE_LIMIT_USER_MAX = "5";
    process.env.RATE_LIMIT_IP_MAX = "3";
    delete require.cache[require.resolve("./rateLimitMiddleware")];
    const { generalRateLimiter } = require("./rateLimitMiddleware");
    app = express();
    app.use("/api", generalRateLimiter);
    app.get("/api/ping", (req, res) => res.json({ ok: true }));
  });
  const tok = (id, extra = {}) => `Bearer ${jwt.sign({ id, ...extra }, process.env.JWT_SECRET)}`;

  it("counts each signed-in user separately (an office shares one IP)", async () => {
    for (let i = 0; i < 5; i += 1) await request(app).get("/api/ping").set("Authorization", tok("u1")).expect(200);
    await request(app).get("/api/ping").set("Authorization", tok("u1")).expect(429);
    // a colleague on the same IP is not blocked
    await request(app).get("/api/ping").set("Authorization", tok("u2")).expect(200);
  });

  it("counts anonymous calls and 2FA challenge tokens per IP with a lower ceiling", async () => {
    for (let i = 0; i < 2; i += 1) await request(app).get("/api/ping").expect(200);
    await request(app).get("/api/ping").set("Authorization", tok("u3", { purpose: "2fa_challenge" })).expect(200);
    await request(app).get("/api/ping").set("Authorization", "Bearer forged").expect(429);
    await request(app).get("/api/ping").set("Authorization", tok("u3")).expect(200);
  });
});
