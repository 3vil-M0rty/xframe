const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const User = require("../models/User");
const auth = require("../middleware/auth");
const { loginRateLimiter } = require("../middleware/rateLimitMiddleware");
const {
  generateSecret,
  verifyToken,
  generateBackupCodes,
  findMatchingBackupCode,
} = require("../services/twoFactorService");

const CHALLENGE_TOKEN_EXPIRY = "5m";
const SESSION_TOKEN_EXPIRY = "7d";

function signSessionToken(user) {
  // Mirrors exactly what controllers/authController.js's normal
  // login issues — this is the SAME kind of token, just handed out
  // one step later (after the 2FA code checks out) instead of
  // immediately after the password.
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      department: user.department,
      employee: user.employee || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: SESSION_TOKEN_EXPIRY }
  );
}

// ======================================================
// START SETUP
// POST /api/2fa/setup
// ======================================================
// Generates a new secret and its QR code, and stores the secret on
// the user record right away — but 2FA stays OFF (enabled: false)
// until /verify-setup proves the user can actually generate a
// matching code from it, so an abandoned setup attempt never
// silently leaves the account half-configured.

router.post("/setup", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.twoFactor?.enabled) {
      return res.status(409).json({ success: false, message: "Two-factor authentication is already enabled on this account" });
    }

    const { base32, qrCodeDataUrl } = await generateSecret(user.email);

    user.twoFactor = { ...(user.twoFactor?.toObject?.() || user.twoFactor || {}), enabled: false, secret: base32 };
    await user.save();

    res.json({ success: true, data: { qrCodeDataUrl, secret: base32 } });
  } catch (error) {
    console.error("POST 2fa/setup error:", error);
    res.status(500).json({ success: false, message: "Error starting two-factor setup", error: error.message });
  }
});

// ======================================================
// CONFIRM SETUP
// POST /api/2fa/verify-setup
// body: { token }
// ======================================================
// Proves the user's authenticator app is actually configured
// correctly before 2FA is really switched on. Returns the backup
// codes IN PLAINTEXT — the only time they're ever available; only
// their bcrypt hashes are stored from this point on.

router.post("/verify-setup", auth, loginRateLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "A 6-digit code is required" });
    }

    const user = await User.findById(req.user.id).select("+twoFactor.secret");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (!user.twoFactor?.secret) {
      return res.status(400).json({ success: false, message: "Start setup first — no pending two-factor secret found" });
    }
    if (user.twoFactor.enabled) {
      return res.status(409).json({ success: false, message: "Two-factor authentication is already enabled on this account" });
    }

    if (!verifyToken(user.twoFactor.secret, token)) {
      return res.status(400).json({ success: false, message: "That code didn't match — check your authenticator app and try again" });
    }

    const { plainCodes, hashed } = await generateBackupCodes();

    user.twoFactor.enabled = true;
    user.twoFactor.enabledAt = new Date();
    user.twoFactor.backupCodes = hashed;
    await user.save();

    res.json({ success: true, data: { backupCodes: plainCodes }, message: "Two-factor authentication is now enabled" });
  } catch (error) {
    console.error("POST 2fa/verify-setup error:", error);
    res.status(500).json({ success: false, message: "Error confirming two-factor setup", error: error.message });
  }
});

// ======================================================
// DISABLE
// POST /api/2fa/disable
// body: { password }
// ======================================================
// Requires re-entering the account password — turning off 2FA is
// exactly the kind of action someone who has merely stolen a
// logged-in session (but not the password) shouldn't be able to do.

router.post("/disable", auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "Your password is required to disable two-factor authentication" });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    user.twoFactor = { enabled: false, secret: undefined, backupCodes: undefined, enabledAt: undefined };
    await user.save();

    res.json({ success: true, message: "Two-factor authentication has been disabled" });
  } catch (error) {
    console.error("POST 2fa/disable error:", error);
    res.status(500).json({ success: false, message: "Error disabling two-factor authentication", error: error.message });
  }
});

// ======================================================
// STATUS
// GET /api/2fa/status
// ======================================================

router.get("/status", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("twoFactor.enabled twoFactor.enabledAt");
    res.json({
      success: true,
      data: { enabled: !!user?.twoFactor?.enabled, enabledAt: user?.twoFactor?.enabledAt || null },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching two-factor status", error: error.message });
  }
});

// ======================================================
// VERIFY LOGIN (second step)
// POST /api/2fa/verify-login
// body: { challengeToken, token } -- token is a 6-digit TOTP code
//   OR one of the account's backup codes (format XXXX-XXXX)
// ======================================================
// This is NOT behind the `auth` middleware — by definition, the
// person calling this doesn't have a real session token yet (that's
// exactly what this endpoint hands out on success). The
// challengeToken (issued by POST /api/auth/login when it detects
// 2FA is enabled) is what stands in for "yes, this person already
// correctly proved their password" without yet trusting them with
// full access.

router.post("/verify-login", loginRateLimiter, async (req, res) => {
  try {
    const { challengeToken, token } = req.body;
    if (!challengeToken || !token) {
      return res.status(400).json({ success: false, message: "A verification code is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(challengeToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: "This login attempt has expired — please sign in again" });
    }
    if (decoded.purpose !== "2fa_challenge") {
      return res.status(401).json({ success: false, message: "Invalid verification request" });
    }

    const user = await User.findById(decoded.id).select("+twoFactor.secret +twoFactor.backupCodes");
    if (!user || !user.twoFactor?.enabled) {
      return res.status(401).json({ success: false, message: "Invalid verification request" });
    }

    const isValidTotp = verifyToken(user.twoFactor.secret, token);
    let usedBackupCodeIndex = -1;

    if (!isValidTotp) {
      usedBackupCodeIndex = await findMatchingBackupCode(user.twoFactor.backupCodes, token);
    }

    if (!isValidTotp && usedBackupCodeIndex === -1) {
      return res.status(400).json({ success: false, message: "That code wasn't recognized. Check your authenticator app, or use a backup code." });
    }

    if (usedBackupCodeIndex !== -1) {
      user.twoFactor.backupCodes[usedBackupCodeIndex].used = true;
      await user.save();
    }

    const sessionToken = signSessionToken(user);

    res.json({
      message: "Login successful",
      data: {
        token: sessionToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          department: user.department,
          employee: user.employee || null,
        },
        usedBackupCode: usedBackupCodeIndex !== -1,
      },
    });
  } catch (error) {
    console.error("POST 2fa/verify-login error:", error);
    res.status(500).json({ success: false, message: "Error verifying two-factor code", error: error.message });
  }
});

module.exports = { router, CHALLENGE_TOKEN_EXPIRY };
