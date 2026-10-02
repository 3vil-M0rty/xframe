import { describe, it, expect, vi, beforeEach } from "vitest";
const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => { req.user = currentUser; next(); } };

const Supplier = require("../models/Supplier");
const router = require("./suppliers");
const COMPANY = "507f1f77bcf86cd799439201";
const app = () => { const a = express(); a.use(express.json()); a.use("/api/suppliers", router); return a; };

describe("supplier list access", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Supplier, "find").mockReturnValue({ sort: () => ({ limit: async () => [{ name: "AcierPlus" }] }) });
  });

  it("production can READ the list (to pick a supplier for an article's prices)", async () => {
    currentUser = { id: "p", role: "user", department: "production" };
    const res = await request(app()).get(`/api/suppliers?companyId=${COMPANY}&active=true`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toBe("AcierPlus");
  });

  it("SECURITY: production can't create or edit suppliers; outsiders can't even read", async () => {
    currentUser = { id: "p", role: "user", department: "production" };
    expect((await request(app()).post("/api/suppliers").send({ company: COMPANY, name: "X" })).status).toBe(403);
    currentUser = { id: "e", role: "user", department: undefined };
    expect((await request(app()).get(`/api/suppliers?companyId=${COMPANY}`)).status).toBe(403);
  });
});
