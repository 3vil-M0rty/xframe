const express = require('express');
const { 
  registerCompany, 
  login, 
  getCurrentUser,
  changePassword
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', registerCompany);
router.post('/login', login);

// Protected routes
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
