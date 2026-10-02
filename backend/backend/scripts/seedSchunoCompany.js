// First: the client-isolation plugin must be registered before models load.
const tenantScope = require("../services/tenantScope");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Company = require("../models/Company");
const { companyQuotaError } = require("../services/tenantLimits");

/**
 * ============================================================
 * SEED — company "SCHUNO ALUMINIUM SARL" for the client "SCHUCO MAROC"
 * ============================================================
 * Adds the company (every field of the company form) to a client that
 * already exists on the platform. Safe to run again: if the company is
 * already there (same ICE or same name in this client) it is UPDATED
 * with the values below instead of being duplicated. Logo, colours and
 * workflow settings already set from the app are left untouched.
 *
 *   npm run seed:schuno
 *   npm run seed:schuno -- --client="SCHUCO MAROC"     (client name, default)
 *   npm run seed:schuno -- --dry-run                    (show what would happen)
 *
 * The company owner is the client's owner account (or, without one,
 * its admin) — the same rule the platform uses.
 *
 * ⚠️ The bank details are deliberately fictitious: never use them
 *    for transfers.
 * ============================================================
 */

function arg(name, fallback = "") {
  const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return fallback;
  return a.includes("=") ? a.split("=").slice(1).join("=") : true;
}

const CLIENT_NAME = String(arg("client", "SCHUCO MAROC")).trim();
const DRY_RUN = arg("dry-run", false) === true;

const COMPANY = {
  // ---------- Identité ----------
  name: "SCHUNO ALUMINIUM SARL",
  tradeName: "SCHUNO ALUMINIUM",
  shortName: "SCHUNO",
  legalForm: "SARL",
  legalFormOther: "",
  industry: "Menuiserie aluminium",
  businessActivity: "Fabrication, pose et vente de menuiseries aluminium",
  activityCode: "2512",
  size: "small", // Petite
  description:
    "SCHUNO ALUMINIUM est une entreprise spécialisée dans la conception, la fabrication, la vente et la pose de menuiseries en aluminium. " +
    "Elle propose des solutions sur mesure pour les projets résidentiels, commerciaux et professionnels, notamment des portes, fenêtres, " +
    "baies vitrées, façades, cloisons et autres ouvrages en aluminium.",

  // ---------- Informations légales ----------
  ice: "999999999999999",
  taxId: "99999999",
  registrationNumber: "RC 99999",
  registrationCity: "Marrakech",
  registrationDate: new Date(Date.UTC(2024, 2, 15)), // 15/03/2024
  cnssNumber: "9999999",
  professionalTaxNumber: "99999999",
  taxOffice: "DGI Marrakech – Service des impôts des professionnels",

  // ---------- Contact ----------
  email: "contact@schuno-aluminium.ma",
  phone: "0612345678",
  secondaryPhone: "0524000000",
  fax: "0524000001",
  website: "www.schuno-aluminium.ma",

  // ---------- Adresse ----------
  address: {
    street: "12, Avenue Mohammed VI",
    additionalLine: "Lotissement Al Massira, Local N° 8",
    neighborhood: "Al Massira",
    city: "Marrakech",
    postalCode: "40000",
    region: "Marrakech-Safi",
    country: "Maroc",
    countryCode: "MA",
  },
  location: { latitude: 31.6295, longitude: -8.0083 },

  // ---------- Banque (FICTIVE) ----------
  bank: {
    bankName: "Attijariwafa Bank",
    accountName: "SCHUNO ALUMINIUM SARL",
    rib: "999 999 9999999999999999 99",
    iban: "MA00 9999 9999 9999 9999 9999 9999",
    swift: "XXXXXXXXXXX",
  },

  // ---------- Exercice & paramètres régionaux ----------
  currency: "MAD",
  fiscalYear: { startMonth: 1, startDay: 1 }, // 1er janvier
  localization: {
    language: "fr",
    timezone: "Africa/Casablanca",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
  },

  status: "active",
  isActive: true,
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function main() {
  // 1. The client
  const tenants = await Tenant.find({ name: new RegExp(`^\\s*${escapeRegex(CLIENT_NAME)}\\s*$`, "i") }).lean();
  if (!tenants.length) {
    const all = await Tenant.find({}).select("name").sort({ name: 1 }).lean();
    throw new Error(
      `Client « ${CLIENT_NAME} » introuvable.` +
      (all.length ? ` Clients existants : ${all.map((t) => `« ${t.name} »`).join(", ")}. Utilisez --client="Nom exact".` : " Aucun client sur la plateforme.")
    );
  }
  if (tenants.length > 1) throw new Error(`Plusieurs clients s'appellent « ${CLIENT_NAME} » — renommez-en un sur la page Plateforme.`);
  const tenant = tenants[0];
  if (tenant.status === "suspended") console.warn(`⚠ Le client « ${tenant.name} » est suspendu : ses utilisateurs ne pourront pas se connecter.`);

  // 2. Its owner (or admin) account — becomes the company owner
  const owner = await User.findOne({ tenant: tenant._id, role: { $in: ["owner", "admin"] } })
    .sort({ role: -1, createdAt: 1 }).select("firstName lastName email role").lean();
  if (!owner) throw new Error(`Le client « ${tenant.name} » n'a pas encore de compte administrateur : créez-le depuis la page Plateforme, puis relancez.`);

  // 3. Already there? (same ICE or same name in this client)
  const existing = await Company.findOne({
    tenant: tenant._id,
    $or: [{ ice: COMPANY.ice }, { name: new RegExp(`^${escapeRegex(COMPANY.name)}$`, "i") }],
  });

  // The identifiers are unique across the whole platform
  for (const key of ["ice", "taxId", "registrationNumber", "cnssNumber"]) {
    const clash = await Company.findOne({ [key]: COMPANY[key], ...(existing ? { _id: { $ne: existing._id } } : {}) })
      .select("name tenant").lean();
    if (clash) {
      throw new Error(
        `${key} « ${COMPANY[key]} » est déjà utilisé par la société « ${clash.name} »` +
        (String(clash.tenant) === String(tenant._id) ? " de ce client" : " d'un autre client") +
        ". Corrigez la valeur dans ce script."
      );
    }
  }

  console.log(`Client     : ${tenant.name} (${tenant._id})`);
  console.log(`Propriétaire: ${owner.firstName} ${owner.lastName} <${owner.email}> — ${owner.role}`);

  if (existing) {
    console.log(`Société    : « ${existing.name} » existe déjà → mise à jour`);
    if (DRY_RUN) return console.log("(--dry-run : rien n'a été modifié)");
    existing.set({ ...COMPANY, updatedBy: owner._id });
    await existing.save();
    console.log(`✓ Société mise à jour : ${existing.name} (${existing._id})`);
    return;
  }

  const quota = await companyQuotaError(tenant._id);
  if (quota) throw new Error(`${quota.message} (page Plateforme → quotas du client).`);

  console.log(`Société    : « ${COMPANY.name} » → création`);
  if (DRY_RUN) return console.log("(--dry-run : rien n'a été créé)");
  const company = await Company.create({
    ...COMPANY,
    tenant: tenant._id,
    owner: owner._id,
    createdBy: owner._id,
    updatedBy: owner._id,
    employeeCount: 0,
  });
  console.log(`✓ Société créée : ${company.name} (${company._id})`);
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI manquant (fichier backend/.env).");
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await tenantScope.runAsSystem(main);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    });
}

module.exports = { COMPANY, main };
