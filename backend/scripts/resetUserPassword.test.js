import { describe, it, expect, beforeAll, vi } from "vitest";

const bcrypt = require("bcryptjs");
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const { reset, listAdmins, generatePassword } = require("./resetUserPassword");

const sys = (fn) => tenantScope.runAsSystem(fn);
const load = () => sys(() => User.findOne({ email: "admin@schuco.ma" }).select("+password +twoFactor.secret"));

describe("reset a user's password from the command line", () => {
  beforeAll(async () => {
    fake.connect();
    await sys(async () => {
      const t = await Tenant.create({ name: "SCHUCO MAROC" });
      await User.create({ firstName: "Admin", lastName: "Schuco", email: "admin@schuco.ma", password: "oublie-123", role: "admin", tenant: t._id, status: "inactive", twoFactor: { enabled: true, secret: "X" } });
    });
  });

  it("lists the client's admin accounts", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await sys(() => listAdmins("schuco maroc"));
    expect(log.mock.calls.flat().join("\n")).toMatch(/admin@schuco\.ma/);
    log.mockRestore();
  });

  it("sets the new password (hashed), and optionally turns 2FA off and reactivates", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await sys(() => reset({ email: "Admin@Schuco.ma", password: "Nouveau-Pass-2026", disable2fa: true, reactivate: true }));
    const u = await load();
    expect(u.password).not.toBe("Nouveau-Pass-2026");
    expect(await bcrypt.compare("Nouveau-Pass-2026", u.password)).toBe(true);
    expect(u.twoFactor.enabled).toBe(false);
    expect(u.status).toBe("active");
  });

  it("generates a strong password when none is given, and refuses short ones", async () => {
    expect(generatePassword()).toMatch(/^[A-Za-z2-9]{6}-[A-Za-z2-9]{6}!$/);
    await expect(sys(() => reset({ email: "admin@schuco.ma", password: "court" }))).rejects.toThrow(/8 caractères/);
    await expect(sys(() => reset({ email: "personne@x.ma", password: "Nouveau-Pass-2026" }))).rejects.toThrow(/Aucun compte/);
  });
});
