// First: the client-isolation plugin must be registered before models load.
require('../services/tenantScope');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

/**
 * Creates the platform operator account (role platform_admin): it
 * belongs to no client, manages clients from the "Platform" page,
 * and cannot see any client's business data.
 *
 *   npm run create:platform-admin -- --email=you@frame.ma --password="S0me-strong-pass"
 */
function arg(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : '';
}

(async () => {
  const email = arg('email').trim().toLowerCase();
  const password = arg('password');
  if (!email || !password) {
    console.error('Usage: npm run create:platform-admin -- --email=you@example.com --password="..."');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Use a password of at least 10 characters for the platform account.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    if (await User.exists({ email })) {
      console.error(`A user with ${email} already exists.`);
      process.exit(1);
    }
    await User.create({
      firstName: 'Platform',
      lastName: 'Admin',
      email,
      password,
      role: 'platform_admin',
      tenant: null,
    });
    console.log(`✓ Platform admin created: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating platform admin:', error.message);
    process.exit(1);
  }
})();
