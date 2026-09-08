const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// ============================================================
// GET CURRENT USER
// GET /api/users/me
// ============================================================

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error fetching user',
      error: error.message
    });
  }
});


// ============================================================
// GET ALL USERS
// GET /api/users
// ============================================================

router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error fetching users',
      error: error.message
    });
  }
});


// ============================================================
// CREATE USER
// POST /api/users
// ============================================================

router.post('/', auth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      status
    } = req.body;

    // --------------------------------------------------------
    // Validate required fields
    // --------------------------------------------------------

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: 'Please provide firstName, lastName, email, and password'
      });
    }

    // --------------------------------------------------------
    // Check if email already exists
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: email.toLowerCase()
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'A user with this email already exists'
      });
    }

    // --------------------------------------------------------
    // Create user
    // --------------------------------------------------------

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role: role || 'user',
      status: status || 'active'
    });

    // --------------------------------------------------------
    // Remove password from response
    // --------------------------------------------------------

    const userResponse = user.toObject();

    delete userResponse.password;

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(201).json({
      success: true,
      data: userResponse,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Create user error:', error);

    res.status(500).json({
      message: 'Error creating user',
      error: error.message
    });
  }
});


// ============================================================
// GET USER BY ID
// GET /api/users/:id
// ============================================================

router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error fetching user',
      error: error.message
    });
  }
});


// ============================================================
// UPDATE USER
// PUT /api/users/:id
// ============================================================

router.put('/:id', auth, async (req, res) => {
  try {

    // User can update themselves
    // Admin can update anyone

    if (
      req.user.id !== req.params.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        message: 'Not authorized to update this user'
      });
    }

    const {
      firstName,
      lastName,
      email
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        message: 'Please provide firstName, lastName, and email'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        firstName,
        lastName,
        email: email.toLowerCase(),
        updatedAt: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error updating user',
      error: error.message
    });
  }
});


// ============================================================
// CHANGE PASSWORD
// PUT /api/users/:id/password
// ============================================================

router.put('/:id/password', auth, async (req, res) => {
  try {

    // Only the user themselves can change their password

    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        message: 'Not authorized to change this password'
      });
    }

    const {
      currentPassword,
      newPassword
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Please provide current and new password'
      });
    }

    const user = await User.findById(req.params.id)
      .select('+password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const isPasswordCorrect =
      await user.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;

    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error changing password',
      error: error.message
    });
  }
});


// ============================================================
// DELETE USER
// DELETE /api/users/:id
// ============================================================

router.delete('/:id', auth, async (req, res) => {
  try {

    // Only admins can delete users

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Only admins can delete users'
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error deleting user',
      error: error.message
    });
  }
});


module.exports = router;