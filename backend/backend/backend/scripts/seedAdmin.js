// First: the client-isolation plugin must be registered before models load.
require('../services/tenantScope');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Tenant = require('../models/Tenant');
const User = require('../models/User');

/**
 * Creates the first client (tenant) and its admin account on an
 * empty database:
 *
 *   npm run seed:admin
 *   npm run seed:admin -- --client="Atlas Group"
 *
 * The admin then creates companies, departments, employees... from
 * the app; all of it belongs to this client automatically.
 * For the platform operator account, see scripts/createPlatformAdmin.js.
 */
const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminExists = await User.findOne({ email: 'admin@company.com' });
    if (adminExists) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const clientArg = process.argv.find((a) => a.startsWith('--client='));
    const clientName = clientArg ? clientArg.split('=').slice(1).join('=').trim() : 'My company';
    const tenant = await Tenant.create({ name: clientName || 'My company' });

    const admin = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@company.com',
      password: 'Admin@123',
      role: 'owner',
      tenant: tenant._id,
    });

    await admin.save();
    console.log(`✓ Client "${tenant.name}" created`);
    console.log('✓ Admin user created successfully');
    console.log('  Email: admin@company.com');
    console.log('  Password: Admin@123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();
