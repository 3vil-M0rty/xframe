const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

/**
 * ============================================================
 * TWO-FACTOR AUTHENTICATION (TOTP)
 * ============================================================
 * Standard app-based 2FA (Google Authenticator, Authy, etc.) — a
 * shared secret generated once at setup, from which both the app
 * and this server independently compute the same rotating 6-digit
 * code every 30 seconds. Nothing is sent over the network at
 * verification time except that 6-digit code.
 * ============================================================
 */

const APP_NAME = "FRAME";
const BACKUP_CODE_COUNT = 8;

/**
 * Generates a new TOTP secret and its otpauth:// QR code (as a data
 * URL, ready to hand straight to an <img src>) for enrolling
 * `accountLabel` (typically the user's email). Returns the secret
 * in BOTH forms the setup screen needs: `base32` for manual entry
 * if the user can't scan the QR code, and `qrCodeDataUrl` for the
 * QR code itself.
 */
async function generateSecret(accountLabel) {
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME} (${accountLabel})`,
    length: 20,
  });

  const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

  return { base32: secret.base32, qrCodeDataUrl };
}

/**
 * Verifies a 6-digit TOTP code against `secret`. `window: 1` allows
 * the immediately-previous and -next 30-second code too, to absorb
 * ordinary clock drift between the user's phone and this server —
 * without it, a code that was valid half a second ago (very common,
 * since the user has to read it and type it) would be rejected.
 */
function verifyToken(secret, token) {
  if (!secret || !token) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(token).replace(/\s+/g, ""),
    window: 1,
  });
}

/**
 * Generates BACKUP_CODE_COUNT single-use recovery codes — for when
 * someone loses their authenticator device. Returns both the
 * plaintext codes (shown to the user exactly once, right after
 * generation — never retrievable again) and their bcrypt hashes
 * (what actually gets stored, exactly like a password).
 */
async function generateBackupCodes() {
  const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    // 4+4 digits of a cryptographically random hex string, formatted
    // like "A1B2-C3D4" — easy to read/type, hard to guess.
    crypto.randomBytes(4).toString("hex").toUpperCase().replace(/(.{4})(.{4})/, "$1-$2")
  );

  const hashed = await Promise.all(
    plainCodes.map(async (code) => ({ codeHash: await bcrypt.hash(code, 10), used: false }))
  );

  return { plainCodes, hashed };
}

/**
 * Checks `code` against the user's stored backup codes. Returns the
 * INDEX of the matching, not-yet-used code (so the caller can mark
 * it used), or -1 if there's no match. Never matches an
 * already-used code — each is genuinely single-use.
 */
async function findMatchingBackupCode(backupCodes, code) {
  if (!Array.isArray(backupCodes) || !code) return -1;
  const normalized = String(code).trim().toUpperCase();

  for (let i = 0; i < backupCodes.length; i += 1) {
    if (backupCodes[i].used) continue; // eslint-disable-line no-continue
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(normalized, backupCodes[i].codeHash)) {
      return i;
    }
  }
  return -1;
}

module.exports = {
  generateSecret,
  verifyToken,
  generateBackupCodes,
  findMatchingBackupCode,
};
