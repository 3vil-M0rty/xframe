import { describe, it, expect, beforeAll } from "vitest";

const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Company = require("../models/Company");
const { main, COMPANY } = require("./seedSchunoCompany");

describe("seed — SCHUNO ALUMINIUM SARL for the client SCHUCO MAROC", () => {
  let tenant;
  beforeAll(async () => {
    fake.connect();
    await tenantScope.runAsSystem(async () => {
      tenant = await Tenant.create({ name: "SCHUCO MAROC" });
      await User.create({ firstName: "Admin", lastName: "Schuco", email: "admin@schuco.ma", password: "secret-123", role: "admin", tenant: tenant._id });
    });
  });

  it("creates the company with every field, owned by the client's admin", async () => {
    await tenantScope.runAsSystem(main);
    const list = await tenantScope.runAsSystem(() => Company.find({ tenant: tenant._id }).lean());
    expect(list).toHaveLength(1);
    const c = list[0];
    expect(c).toMatchObject({
      name: "SCHUNO ALUMINIUM SARL", shortName: "SCHUNO", size: "small", activityCode: "2512",
      ice: "999999999999999", cnssNumber: "9999999", phone: "0612345678", secondaryPhone: "0524000000",
      address: { region: "Marrakech-Safi", country: "Maroc", postalCode: "40000" },
      location: { latitude: 31.6295, longitude: -8.0083 },
      bank: { swift: "XXXXXXXXXXX" }, fiscalYear: { startMonth: 1, startDay: 1 },
      localization: { language: "fr", dateFormat: "DD/MM/YYYY", timeFormat: "24h" },
    });
    expect(new Date(c.registrationDate).toISOString().slice(0, 10)).toBe("2024-03-15");
    expect(c.owner).toBeTruthy();
  });

  it("running it again updates instead of duplicating, and keeps colours set in the app", async () => {
    await tenantScope.runAsSystem(() => Company.updateOne({ tenant: tenant._id }, { $set: { "branding.primaryColor": "#123456", tradeName: "old" } }));
    await tenantScope.runAsSystem(main);
    const list = await tenantScope.runAsSystem(() => Company.find({ tenant: tenant._id }).lean());
    expect(list).toHaveLength(1);
    expect(list[0].tradeName).toBe(COMPANY.tradeName);
    expect(list[0].branding.primaryColor).toBe("#123456");
  });
});
