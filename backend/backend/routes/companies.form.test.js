import { describe, it, expect, beforeAll } from "vitest";

/**
 * The company form sends every field of models/Company.js. These tests
 * pin down that the full payload is accepted and stored, and that an
 * empty unique identifier (ICE, IF, RC, CNSS) never blocks a second
 * company with "already exists".
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "company-form-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");

let app;
let token;
const h = () => ({ Authorization: `Bearer ${token}` });

// What pages/owner/Company.jsx#buildCompanyPayload sends for a fully filled form
const fullPayload = {
  name: "Alu Maroc",
  tradeName: "AluMa",
  shortName: "ALUMA",
  legalForm: "OTHER",
  legalFormOther: "GIE",
  industry: "Menuiserie aluminium",
  businessActivity: "Fabrication et pose de menuiserie",
  activityCode: "25.12",
  size: "medium",
  description: "Atelier de menuiserie aluminium",
  ice: "001234567000089",
  taxId: "12345678",
  registrationNumber: "RC123",
  registrationCity: "Casablanca",
  registrationDate: "2015-03-20",
  cnssNumber: "7654321",
  professionalTaxNumber: "TP-998",
  taxOffice: "DGI Casa-Anfa",
  email: "contact@aluma.ma",
  phone: "+212612345678",
  secondaryPhone: "0522123456",
  fax: "0522123457",
  website: "www.aluma.ma",
  address: {
    street: "12 rue des Industries",
    additionalLine: "Lot 4",
    neighborhood: "Aïn Sebaâ",
    city: "Casablanca",
    postalCode: "20250",
    region: "Casablanca-Settat",
    country: "Morocco",
    countryCode: "MA",
  },
  location: { latitude: 33.6, longitude: -7.53 },
  bank: { bankName: "Attijariwafa", accountName: "Alu Maroc SARL", rib: "007 780 0001234567890123 45", iban: "MA64007780000123456789012345", swift: "BCMAMAMC" },
  currency: "MAD",
  fiscalYear: { startMonth: 7, startDay: 1 },
  localization: { language: "fr", timezone: "Africa/Casablanca", dateFormat: "DD/MM/YYYY", timeFormat: "24h" },
  branding: { primaryColor: "#112233", secondaryColor: "#445566", accentColor: "#778899", darkMode: false },
};

const emptyIds = { ice: "", taxId: "", registrationNumber: "", cnssNumber: "", address: { city: "Rabat", region: "" } };

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/companies", require("./companies"));
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const owner = await User.create({ firstName: "O", lastName: "O", email: "o@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    token = jwt.sign({ id: String(owner._id) }, process.env.JWT_SECRET);
  });
});

describe("company form ↔ model", () => {
  let id;

  it("stores every field the form sends", async () => {
    const r = await request(app).post("/api/companies").set(h()).send(fullPayload);
    expect(r.status).toBe(201);
    const c = r.body.data;
    id = c._id;
    expect(c).toMatchObject({
      shortName: "ALUMA", legalFormOther: "GIE", size: "medium", cnssNumber: "7654321",
      professionalTaxNumber: "TP-998", secondaryPhone: "0522123456", fax: "0522123457",
      address: { neighborhood: "Aïn Sebaâ", region: "Casablanca-Settat", additionalLine: "Lot 4" },
      location: { latitude: 33.6, longitude: -7.53 },
      bank: { swift: "BCMAMAMC", bankName: "Attijariwafa" },
      fiscalYear: { startMonth: 7, startDay: 1 },
      branding: { primaryColor: "#112233", darkMode: false },
    });
    expect(c.registrationDate.slice(0, 10)).toBe("2015-03-20");
  });

  it("two companies with empty identifiers do not collide, and clearing an identifier works", async () => {
    const a = await request(app).post("/api/companies").set(h()).send({ ...fullPayload, name: "Sans ICE 1", ...emptyIds });
    expect(a.status).toBe(201);
    expect(a.body.data.ice).toBeUndefined();
    expect(a.body.data.address.region).toBeUndefined();
    const b = await request(app).post("/api/companies").set(h()).send({ ...fullPayload, name: "Sans ICE 2", ...emptyIds });
    expect(b.status).toBe(201);

    const cleared = await request(app).put(`/api/companies/${id}`).set(h()).send({ ...fullPayload, ice: "", cnssNumber: "" });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.ice).toBeUndefined();
    expect(cleared.body.data.cnssNumber).toBeUndefined();
    expect(cleared.body.data.taxId).toBe("12345678");
  });
});
