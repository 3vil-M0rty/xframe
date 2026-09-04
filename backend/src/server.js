require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/companies');
const permissionRoutes = require('./routes/permissions');
const inventoryRoutes = require('./routes/inventory');
const projectRoutes = require('./routes/projects');
const payrollRoutes = require('./routes/payroll');
const supplierRoutes = require('./routes/suppliers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const notificationRoutes = require('./routes/notifications');
const { authenticate, checkCompanyAccess } = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/frame-saas')
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('✗ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, checkCompanyAccess, userRoutes);
app.use('/api/companies', authenticate, companyRoutes);
app.use('/api/permissions', authenticate, checkCompanyAccess, permissionRoutes);
app.use('/api/inventory', authenticate, checkCompanyAccess, inventoryRoutes);
app.use('/api/projects', authenticate, checkCompanyAccess, projectRoutes);
app.use('/api/payroll', authenticate, checkCompanyAccess, payrollRoutes);
app.use('/api/suppliers', authenticate, checkCompanyAccess, supplierRoutes);
app.use('/api/purchase-orders', authenticate, checkCompanyAccess, purchaseOrderRoutes);
app.use('/api/notifications', authenticate, checkCompanyAccess, notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Frame Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
