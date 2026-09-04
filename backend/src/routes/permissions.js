const express = require('express');
const {
  getAllPermissions,
  getUserPermissions,
  setPermission,
  deletePermission,
  getAvailablePermissions,
  bulkSetPermissions
} = require('../controllers/permissionController');
const { checkRole } = require('../middleware/auth');

const router = express.Router();

// Admin only
router.use(checkRole('admin'));

router.get('/', getAllPermissions);
router.get('/available', getAvailablePermissions);
router.get('/user/:userId', getUserPermissions);
router.post('/', setPermission);
router.post('/bulk', bulkSetPermissions);
router.delete('/:permissionId', deletePermission);

module.exports = router;
