const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const jwt = require("jsonwebtoken");

/**
 * ============================================================
 * RATE LIMITING
 * ============================================================
 * Every other route in this backend sits behind the `auth`
 * middleware (a valid JWT is required first), which already limits
 * who can even attempt abuse. POST /api/auth/login is the one
 * genuinely public, unauthenticated endpoint in the whole API —
 * anyone can throw password guesses at it with no rate limiting at
 * all today. This is that fix.
 * ============================================================
 */

/**
 * Strict limiter for the login endpoint itself: 10 attempts per 15
 * minutes per IP. `skipSuccessfulRequests: true` means only FAILED
 * attempts count toward the limit — a legitimate user who gets it
 * right on the 3rd try isn't penalized for the 2 typos, but 10
 * WRONG passwords in a row from the same IP is a brute-force
 * pattern, not normal human behavior.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  // Matches authController.login's own response shape (`{ message }`,
  // not the rest of the app's `{ success, message }` convention) —
  // consistency with the ONE endpoint this sits in front of, rather
  // than the app as a whole.
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many login attempts. Please wait a few minutes and try again.",
    });
  },
});

/**
 * General, defense-in-depth limiter for the whole API.
 *
 * Counted PER SIGNED-IN USER (the user id in a valid JWT), not per IP:
 * a whole office behind one internet box shares a single IP, and one
 * screen of the app easily makes 10–20 calls (notifications, counters,
 * lists…) — a per-IP budget of a few hundred was used up in minutes by
 * normal work and every page then failed with "Too many requests".
 * Requests without a valid token (login page, public endpoints) are
 * still counted per IP, with a lower ceiling.
 *
 * Budgets (per 15 minutes) can be tuned without code changes:
 *   RATE_LIMIT_USER_MAX (default 3000 ≈ 200 calls / minute per user)
 *   RATE_LIMIT_IP_MAX   (default 600 for anonymous calls per IP)
 */
function userIdFromToken(req) {
  const header = req.headers?.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.purpose) return null; // 2FA challenge token: not a session, counted per IP
    return decoded?.id || decoded?._id || decoded?.userId || null;
  } catch {
    return null;
  }
}

const positive = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (userIdFromToken(req)
    ? positive(process.env.RATE_LIMIT_USER_MAX, 3000)
    : positive(process.env.RATE_LIMIT_IP_MAX, 600)),
  keyGenerator: (req) => {
    const userId = userIdFromToken(req);
    return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip || "")}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please slow down and try again shortly.",
    });
  },
});

module.exports = { loginRateLimiter, generalRateLimiter };
