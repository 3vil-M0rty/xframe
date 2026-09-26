require('../services/tenantScope'); // client-isolation plugin, before models
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { restoreDatabase, readManifest } = require('../services/backupService');

/**
 * Restores a backup folder made by scripts/backup.js.
 *
 *   npm run restore -- --from=backups/2026-09-26T10-00-00 --uri="mongodb+srv://.../frame-restore-test"
 *       into an EMPTY database (default; refuses otherwise) — use this
 *       for the monthly restore test, never on the live database
 *   npm run restore -- --from=... --drop --yes
 *       FULL restore over the live database (replaces the saved collections)
 *   npm run restore -- --from=backups/...-client-<id> --merge --yes
 *       put ONE client's data back into the live database (upsert by id)
 *
 * --uri defaults to MONGODB_URI from .env.
 */
function arg(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : '';
}
const flag = (name) => process.argv.includes(`--${name}`);

(async () => {
  const from = arg('from');
  if (!from) {
    console.error('Usage: npm run restore -- --from=<backup folder> [--uri=<mongodb uri>] [--drop|--merge] [--yes]');
    process.exit(1);
  }
  const dir = path.resolve(from);
  const mode = flag('drop') ? 'drop' : flag('merge') ? 'merge' : 'empty';
  if (mode !== 'empty' && !flag('yes')) {
    console.error(`--${mode} changes an existing database. Add --yes to confirm.`);
    process.exit(1);
  }
  const uri = arg('uri') || process.env.MONGODB_URI;
  try {
    const manifest = readManifest(dir);
    console.log(`Backup from ${manifest.createdAt} (${manifest.tenant ? `client ${manifest.tenant}` : 'whole database'}), mode: ${mode}`);
    await mongoose.connect(uri);
    console.log(`Restoring into database "${mongoose.connection.db.databaseName}"...`);
    await restoreDatabase(mongoose.connection.db, dir, { mode, log: console.log });
    console.log('✓ Restore complete and verified (every saved document is back).');
    console.log('  Start the server once: it rebuilds the indexes.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
})();
