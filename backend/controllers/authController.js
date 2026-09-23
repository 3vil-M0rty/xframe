const User = require('../models/User');
const jwt = require('jsonwebtoken');

const CHALLENGE_TOKEN_EXPIRY = '5m';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password +twoFactor.secret');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Checked only AFTER the password is confirmed, so this can't be
    // used to probe which emails exist. middleware/auth.js enforces
    // the same rule on every request, so deactivating someone also
    // cuts off a session they already had open.
    if (user.status === 'inactive' || user.status === 'suspended') {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    // --------------------------------------------------------
    // Two-factor authentication: the password alone is only
    // "half" the login for an account with 2FA enabled. Rather
    // than issue the real session token here, hand back a
    // short-lived challenge token that only proves "this person
    // already got the password right" — routes/twoFactor.js's
    // /verify-login exchanges it (plus a correct 6-digit code, or
    // a backup code) for the real session token. Nothing about
    // this challenge token grants any actual access on its own.
    // --------------------------------------------------------

    if (user.twoFactor?.enabled) {
      const challengeToken = jwt.sign(
        { id: user._id, purpose: '2fa_challenge' },
        process.env.JWT_SECRET,
        { expiresIn: CHALLENGE_TOKEN_EXPIRY }
      );

      return res.json({
        message: 'Password verified — two-factor code required',
        data: {
          requires2FA: true,
          challengeToken,
        },
      });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        // Needed so department-scoped permission checks (e.g. "HR
        // department can manage employees/salaries/absences/advances")
        // work anywhere the request only has the decoded token to go
        // on (most routes — see middleware/auth.js). Previously this
        // was left out, so req.user.department was always undefined
        // and any department-based permission silently failed.
        department: user.department,
        // Powers the self-service space and manager-approval routing
        // (see permissions/permissions.js: canSelfService,
        // canReviewAbsence, canReviewAdvance) without an extra DB
        // round trip on every request.
        employee: user.employee || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          department: user.department,
          employee: user.employee || null,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};
