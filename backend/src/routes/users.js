const express = require('express');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserPermissions
} = require('../controllers/userController');
const { checkRole } = require('../middleware/auth');

const router = express.Router();

// All routes require admin or manager role
router.use(checkRole('admin', 'manager'));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/permissions', updateUserPermissions);

module.exports = router;
