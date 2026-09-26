require('../services/tenantScope'); // client-isolation plugin, before models
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { backupDatabase, stamp } = require('../services/backupService');

/**
 * Backs up the database into backups/<date>/ (or --out=folder).
 *
 *   npm run backup                          whole database
 *   npm run backup -- --tenant=<clientId>   one client only (its export)
 *   npm run backup -- --out=D:\frame-backups\today
 *
 * Keep copies OFF this machine (another disk, cloud drive). See
 * scripts/BACKUP_RESTORE.md for the schedule and the restore test.
 */
function arg(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : '';
}

(async () => {
  const tenantId = arg('tenant') || null;
  const out = arg('out') || path.join(__dirname, '..', 'backups', `${stamp()}${tenantId ? `-client-${tenantId}` : ''}`);
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Backing up ${tenantId ? `client ${tenantId}` : 'the whole database'} to ${out}`);
    const manifest = await backupDatabase(mongoose.connection.db, out, { tenantId, log: console.log });
    const total = Object.values(manifest.collections).reduce((a, b) => a + b, 0);
    console.log(`✓ Backup complete: ${Object.keys(manifest.collections).length} collections, ${total} documents`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
})();
