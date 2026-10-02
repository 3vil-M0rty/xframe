/**
 * ============================================================
 * RESET DATABASE — empty everything, keep the platform account(s)
 * ============================================================
 * Deletes every document of every collection (clients, companies,
 * users, employees, payroll, sales, stock, production…) EXCEPT the
 * platform operator account(s) (User.role = "platform_admin") — the
 * login that creates and manages clients from the "Plateforme" page.
 *
 * Collections are emptied, not dropped: their indexes stay in place.
 * Files stored on Cloudinary (photos, logos, documents) are NOT
 * deleted — only the database records pointing to them.
 *
 * Usage (from backend/):
 *   npm run reset:db                     → shows what would be deleted, deletes nothing
 *   npm run reset:db -- --yes            → really deletes (asks you to type the database name)
 *   npm run reset:db -- --yes --force    → really deletes, no question (scripts / CI)
 *
 * If no platform account exists, the script refuses to run (you would
 * lock yourself out); create one first:
 *   npm run create:platform-admin -- --email=you@frame.ma --password="S0me-strong-pass"
 * ============================================================
 */
const path = require("path");
const readline = require("readline");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const KEEP_USERS = { role: "platform_admin" };
const args = process.argv.slice(2);
const really = args.includes("--yes");
const force = args.includes("--force");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing (backend/.env).");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // Raw driver on purpose: no models, no client-isolation plugin — this
    // script works on the whole database, whatever collections exist.
    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    const keepers = await db.collection("users").find(KEEP_USERS, { projection: { email: 1 } }).toArray();
    if (!keepers.length) {
      console.error("✗ No platform account (role platform_admin) found — nothing deleted.");
      console.error('  Create one first: npm run create:platform-admin -- --email=you@frame.ma --password="S0me-strong-pass"');
      process.exit(1);
    }

    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .filter((name) => !name.startsWith("system."))
      .sort();

    console.log(`\nDatabase: ${dbName}`);
    console.log(`Kept: ${keepers.map((u) => u.email).join(", ")} (platform account${keepers.length > 1 ? "s" : ""})\n`);
    let total = 0;
    const plan = [];
    for (const name of collections) {
      const filter = name === "users" ? { role: { $ne: "platform_admin" } } : {};
      const count = await db.collection(name).countDocuments(filter);
      plan.push({ name, filter, count });
      total += count;
      if (count) console.log(`  ${name.padEnd(28)} ${String(count).padStart(7)} to delete`);
    }
    console.log(`\nTotal: ${total} document(s) in ${plan.filter((p) => p.count).length} collection(s).`);

    if (!really) {
      console.log("\nDry run — nothing deleted. Run again with --yes to delete.");
      process.exit(0);
    }
    if (!force) {
      const answer = await ask(`\nType the database name (${dbName}) to confirm: `);
      if (answer !== dbName) {
        console.log("Not confirmed — nothing deleted.");
        process.exit(1);
      }
    }

    for (const { name, filter, count } of plan) {
      if (!count) continue;
      const r = await db.collection(name).deleteMany(filter);
      console.log(`  ✓ ${name}: ${r.deletedCount} deleted`);
    }
    // The kept platform account(s) belong to no client.
    await db.collection("users").updateMany(KEEP_USERS, { $set: { tenant: null } });

    console.log(`\n✓ Database emptied. Log in with ${keepers.map((u) => u.email).join(" / ")} and create your clients from the Plateforme page.`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
})();
