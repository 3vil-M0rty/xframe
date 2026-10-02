// First: the client-isolation plugin must be registered before models load.
const tenantScope = require("../services/tenantScope");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../models/User");
const Tenant = require("../models/Tenant");

/**
 * ============================================================
 * RESET A USER'S PASSWORD (platform operator, command line)
 * ============================================================
 * For when a client's admin (or anyone) can no longer log in.
 *
 *   List the admin accounts of a client (forgot the email too?):
 *     npm run reset:password -- --client="SCHUCO MAROC"
 *
 *   Set a new password:
 *     npm run reset:password -- --email=admin@schuco.ma --password="Nouveau-Mot2Passe"
 *
 *   Without --password, a strong one is generated and printed once.
 *
 *   Options:
 *     --disable-2fa   also turns off two-factor authentication
 *                     (lost phone / authenticator app)
 *     --reactivate    also re-activates a deactivated account
 * ============================================================
 */

function arg(name) {
  const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return "";
  return a.includes("=") ? a.split("=").slice(1).join("=") : true;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function generatePassword() {
  // 14 characters, letters + digits + a symbol, no look-alikes (0/O, 1/l/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (const b of crypto.randomBytes(12)) out += chars[b % chars.length];
  return `${out.slice(0, 6)}-${out.slice(6)}!`;
}

async function listAdmins(clientName) {
  const tenants = await Tenant.find({ name: new RegExp(`^\\s*${escapeRegex(clientName)}\\s*$`, "i") }).lean();
  if (!tenants.length) {
    const all = await Tenant.find({}).select("name").sort({ name: 1 }).lean();
    throw new Error(`Client « ${clientName} » introuvable. Clients : ${all.map((t) => `« ${t.name} »`).join(", ") || "aucun"}.`);
  }
  for (const t of tenants) {
    const admins = await User.find({ tenant: t._id, role: { $in: ["owner", "admin"] } })
      .select("firstName lastName email role status twoFactor.enabled").sort({ createdAt: 1 }).lean();
    console.log(`Client « ${t.name} »${t.status === "suspended" ? " (SUSPENDU)" : ""} — comptes administrateurs :`);
    if (!admins.length) console.log("  (aucun — créez-en un depuis la page Plateforme)");
    for (const a of admins) {
      console.log(`  ${a.email}   ${a.firstName} ${a.lastName} — ${a.role}${a.status !== "active" ? ` — ${a.status}` : ""}${a.twoFactor?.enabled ? " — 2FA activée" : ""}`);
    }
  }
  console.log('\nPuis : npm run reset:password -- --email=<email> [--password="..."]');
}

async function reset({ email, password, disable2fa, reactivate }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) throw new Error(`Aucun compte avec l'email ${email}.`);

  const newPassword = password || generatePassword();
  if (newPassword.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");

  user.password = newPassword; // hashed by the model (pre-save)
  if (disable2fa) {
    user.twoFactor = { enabled: false, secret: undefined, backupCodes: undefined, enabledAt: undefined };
  }
  if (reactivate && user.status !== "active") user.status = "active";
  await user.save();

  const tenant = user.tenant ? await Tenant.findById(user.tenant).select("name status").lean() : null;
  console.log(`✓ Mot de passe changé pour ${user.email} (${user.firstName} ${user.lastName} — ${user.role}${tenant ? `, client « ${tenant.name} »` : ""})`);
  if (!password) console.log(`  Nouveau mot de passe : ${newPassword}\n  (affiché une seule fois — communiquez-le puis demandez à l'utilisateur de le changer)`);
  if (disable2fa) console.log("  Double authentification désactivée.");
  if (user.twoFactor?.enabled && !disable2fa) console.log("  ⚠ La double authentification est active : il faudra aussi le code (ou relancez avec --disable-2fa).");
  if (user.status !== "active") console.log(`  ⚠ Le compte est « ${user.status} » : relancez avec --reactivate pour pouvoir se connecter.`);
  if (tenant?.status === "suspended") console.log("  ⚠ Le client est suspendu : réactivez-le depuis la page Plateforme.");
}

async function main() {
  const email = arg("email");
  const client = arg("client");
  if (client && !email) return listAdmins(String(client));
  if (!email || email === true) {
    throw new Error('Usage : npm run reset:password -- --email=<email> [--password="..."] [--disable-2fa] [--reactivate]\n' +
      '        npm run reset:password -- --client="Nom du client"   (liste ses administrateurs)');
  }
  return reset({
    email: String(email),
    password: arg("password") === true ? "" : String(arg("password") || ""),
    disable2fa: arg("disable-2fa") === true,
    reactivate: arg("reactivate") === true,
  });
}

if (require.main === module) {
  (async () => {
    try {
      if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI manquant (fichier backend/.env).");
      await mongoose.connect(process.env.MONGODB_URI);
      await tenantScope.runAsSystem(main);
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = { reset, listAdmins, generatePassword };
