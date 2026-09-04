const express = require('express');
const {
  getCompany,
  updateCompany,
  updateSettings,
  getStats,
  inviteUser
} = require('../controllers/companyController');
const { checkRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', getCompany);
router.get('/stats', getStats);

// Admin only
router.put('/', checkRole('admin'), updateCompany);
router.put('/settings', checkRole('admin'), updateSettings);
router.post('/invite', checkRole('admin'), inviteUser);

module.exports = router;
