import { describe, it, expect, vi, beforeEach } from "vitest";

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const auth = require("./auth");
const { current } = require("../services/tenantScope");

// Deliberately exercises the REAL middleware with REAL signed tokens.
// Most route tests replace middleware/auth.js with a stub that sets
// req.user directly — convenient, but it's exactly how two bugs hid:
// the token never carried hrRole (so HR tiers weren't enforced on
// the backend), and department changes didn't take effect until the
// user logged in again (an HR account saw an empty company list).

const SECRET = "test-secret";
const USER_ID = "507f1f77bcf86cd799439091";
const TENANT_ID = "507f1f77bcf86cd7994390a1";
const COMPANY_ID = "507f1f77bcf86cd7994390b1";

function run(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  // Captures the isolation context the rest of the request runs in.
  const next = vi.fn(() => { req.ctxSeen = current(); });
  return auth(req, res, next).then(() => ({ req, res, next }));
}

describe("auth middleware", () => {
  let dbUser;
  let tenant;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    dbUser = { _id: USER_ID, email: "hr@frame.test", role: "user", department: "hr", hrRole: "hr_assistant", employee: null, status: "active", tenant: TENANT_ID };
    tenant = { _id: TENANT_ID, status: "active" };
    vi.restoreAllMocks();
    vi.spyOn(User, "findById").mockImplementation((id) => ({
      select() { return this; },
      lean: async () => (dbUser && String(id) === USER_ID ? dbUser : null),
    }));
    vi.spyOn(Tenant, "findById").mockImplementation(() => ({
      select() { return this; },
      lean: async () => tenant,
    }));
    vi.spyOn(Company, "find").mockImplementation((filter) => ({
      select() { return this; },
      lean: async () => (String(filter.tenant) === TENANT_ID ? [{ _id: COMPANY_ID }] : []),
    }));
  });

  it("REGRESSION: uses the CURRENT department/hrRole from the database, not stale token claims", async () => {
    const staleToken = jwt.sign({ id: USER_ID, department: "sales" }, SECRET);
    const { req, next } = await run(staleToken);
    expect(next).toHaveBeenCalled();
    expect(req.user.department).toBe("hr");
    expect(req.user.hrRole).toBe("hr_assistant");
    expect(req.user.id).toBe(USER_ID);
  });

  it("SECURITY: rejects the 2FA challenge token as a session token", async () => {
    const challenge = jwt.sign({ id: USER_ID, purpose: "2fa_challenge" }, SECRET);
    const { res, next } = await run(challenge);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("cuts off a suspended or inactive account immediately", async () => {
    for (const status of ["suspended", "inactive"]) {
      dbUser.status = status;
      const { res, next } = await run(jwt.sign({ id: USER_ID }, SECRET));
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    }
  });

  it("rejects a token for an account that no longer exists", async () => {
    dbUser = null;
    const { res, next } = await run(jwt.sign({ id: USER_ID }, SECRET));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects missing and invalid tokens", async () => {
    expect((await run(null)).res.statusCode).toBe(401);
    expect((await run("garbage")).res.statusCode).toBe(401);
    expect((await run(jwt.sign({ id: USER_ID }, "wrong-secret"))).res.statusCode).toBe(401);
  });

  it("runs the rest of the request inside the client's isolation context", async () => {
    const { req, next } = await run(jwt.sign({ id: USER_ID }, SECRET));
    expect(next).toHaveBeenCalled();
    expect(req.user.tenant).toBe(TENANT_ID);
    expect(req.ctxSeen.kind).toBe("tenant");
    expect(String(req.ctxSeen.tenantId)).toBe(TENANT_ID);
    expect(req.ctxSeen.companyIds.map(String)).toEqual([COMPANY_ID]);
  });

  it("cuts off every account of a suspended client, even mid-session", async () => {
    tenant.status = "suspended";
    const { res, next } = await run(jwt.sign({ id: USER_ID }, SECRET));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401); // session ends → the app logs out
  });

  it("refuses an account that is not attached to any client", async () => {
    dbUser.tenant = null;
    const { res, next } = await run(jwt.sign({ id: USER_ID }, SECRET));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("gives a platform_admin the platform context (no client data by default)", async () => {
    dbUser = { ...dbUser, role: "platform_admin", tenant: null, department: null };
    const { req, next } = await run(jwt.sign({ id: USER_ID }, SECRET));
    expect(next).toHaveBeenCalled();
    expect(req.ctxSeen.kind).toBe("platform");
  });
});
