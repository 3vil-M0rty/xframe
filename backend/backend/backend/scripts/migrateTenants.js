// First: the client-isolation plugin must be registered before models load.
require('../services/tenantScope');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { migrateLegacyDataToTenants } = require('../services/tenantService');

/**
 * Attaches data created before client isolation to a client.
 * The server also runs this automatically at startup; this script is
 * for running it by hand (e.g. to name the client):
 *
 *   npm run migrate:tenants
 *   npm run migrate:tenants -- --name="Atlas Group"
 */
(async () => {
  const nameArg = process.argv.find((a) => a.startsWith('--name='));
  const defaultName = nameArg ? nameArg.split('=').slice(1).join('=').trim() : 'Default client';
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const report = await migrateLegacyDataToTenants({ defaultName });
    console.log('Migration report:', JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
})();
